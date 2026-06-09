const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const auditService = require('../services/audit');
const SlaService = require('../services/sla');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { Client, ClientUser, User, Ticket, TicketAttachment } = require('../db/models');

const verifyClientAccess = async (req, clientId) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin') {
    return true;
  }

  const membership = await ClientUser.findOne({
    where: { user_id: req.user.id, client_id: clientId },
  });
  return !!membership;
};

// Create a client
router.post(
  '/',
  authenticate,
  requirePermission('client:create'),
  [body('name').notEmpty().withMessage('Client name is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditService.logFailure(req, 'client_create_validation_failed', JSON.stringify(errors.array()));
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, reference_code, sla_tier, metadata } = req.body;
      const client = await Client.create({
        name,
        reference_code: reference_code || null,
        sla_tier: sla_tier || 'bronze',
        metadata: metadata || null,
      });

      await auditService.log(req, 'client_created', 'clients', client.id, {
        name,
        sla_tier,
      });

      res.status(201).json({ success: true, client });
    } catch (error) {
      await auditService.logFailure(req, 'client_create_failed', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// List clients
router.get('/', authenticate, requirePermission('client:read'), async (req, res) => {
  try {
    let clients;
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      clients = await Client.findAll({ order: [['created_at', 'DESC']] });
    } else {
      const memberships = await ClientUser.findAll({ where: { user_id: req.user.id } });
      const clientIds = memberships.map((membership) => membership.client_id);
      clients = await Client.findAll({ where: { id: clientIds }, order: [['created_at', 'DESC']] });
    }

    res.json({ success: true, clients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get client by id
router.get('/:id', authenticate, requirePermission('client:read'), async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!(await verifyClientAccess(req, client.id))) {
      await auditService.logFailure(req, 'client_read_denied', 'Access denied', 'clients', client.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, client });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List tickets for a client (portal / client access)
router.get('/:id/tickets', authenticate, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!(await verifyClientAccess(req, client.id))) {
      await auditService.logFailure(req, 'client_tickets_read_denied', 'Access denied', 'clients', client.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    const tickets = await Ticket.findAll({
      where: { client_id: client.id },
      include: [
        { model: User, as: 'assigned_agent', attributes: ['id', 'email', 'display_name'] },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, tickets });
  } catch (error) {
    await auditService.logFailure(req, 'client_tickets_read_failed', error.message, 'clients', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

// Create ticket for a client from the portal
router.post('/:id/tickets', authenticate, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!(await verifyClientAccess(req, client.id))) {
      await auditService.logFailure(req, 'client_ticket_create_denied', 'Access denied', 'clients', client.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, description, type, priority, category, subcategory, attachment } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const sla_due_at = await SlaService.computeTicketSlaDueDate({ created_at: new Date() }, client);
    const ticket = await Ticket.create({
      title,
      description: description || null,
      type: type || 'support',
      priority: priority || 'medium',
      status: 'open',
      client_id: client.id,
      approval_required: type === 'change_request',
      approval_status: type === 'change_request' ? 'pending' : 'approved',
      category: category || null,
      subcategory: subcategory || null,
      sla_due_at,
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    if (attachment && attachment.fileName) {
      await TicketAttachment.create({
        ticket_id: ticket.id,
        uploaded_by: req.user.id,
        file_name: attachment.fileName,
        file_type: attachment.fileType || null,
        metadata: {
          description: `Uploaded by portal user ${req.user.id}`,
          content: attachment.content,
        },
      });
    }

    await auditService.log(req, 'client_ticket_created', 'tickets', ticket.id, {
      client_id: client.id,
      title,
      type,
    });

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    await auditService.logFailure(req, 'client_ticket_create_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update a client
router.put(
  '/:id',
  authenticate,
  requirePermission('client:update'),
  [
    body('name').optional().trim(),
    body('reference_code').optional().trim(),
    body('sla_tier').optional().isIn(['bronze', 'silver', 'gold', 'platinum', 'custom']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditService.logFailure(req, 'client_update_validation_failed', JSON.stringify(errors.array()));
        return res.status(400).json({ errors: errors.array() });
      }

      const client = await Client.findByPk(req.params.id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      if (!(await verifyClientAccess(req, client.id))) {
        await auditService.logFailure(req, 'client_update_denied', 'Access denied', 'clients', client.id);
        return res.status(403).json({ error: 'Access denied' });
      }

      const { name, reference_code, sla_tier, metadata } = req.body;
      if (name !== undefined) client.name = name;
      if (reference_code !== undefined) client.reference_code = reference_code;
      if (sla_tier !== undefined) client.sla_tier = sla_tier;
      if (metadata !== undefined) client.metadata = metadata;

      await client.save();
      await auditService.log(req, 'client_updated', 'clients', client.id, req.body);

      res.json({ success: true, client });
    } catch (error) {
      await auditService.logFailure(req, 'client_update_failed', error.message, 'clients', req.params.id);
      res.status(500).json({ error: error.message });
    }
  }
);

// Add a user to a client
router.post('/:id/users', authenticate, requirePermission('client:update'), [body('user_id').isInt(), body('role').isIn(['client_admin', 'client_user', 'client_viewer'])], async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const user = await User.findByPk(req.body.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [membership] = await ClientUser.findOrCreate({
      where: {
        client_id: client.id,
        user_id: user.id,
      },
      defaults: {
        role: req.body.role,
      },
    });

    if (!membership.role || membership.role !== req.body.role) {
      membership.role = req.body.role;
      await membership.save();
    }

    await auditService.log(req, 'client_user_added', 'clients', client.id, {
      user_id: user.id,
      role: req.body.role,
    });

    res.status(201).json({ success: true, membership });
  } catch (error) {
    await auditService.logFailure(req, 'client_user_add_failed', error.message, 'clients', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
