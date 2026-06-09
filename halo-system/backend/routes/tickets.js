const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const router = express.Router();
const auditService = require('../services/audit');
const SlaService = require('../services/sla');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  Ticket,
  Client,
  ClientUser,
  User,
  TicketTimeEntry,
  TicketApproval,
  TicketComment,
} = require('../db/models');

const buildTicketScope = async (req) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.role === 'manager') {
    return {};
  }

  const memberships = await ClientUser.findAll({
    where: { user_id: req.user.id },
  });
  const clientIds = memberships.map((membership) => membership.client_id);

  return {
    [Op.or]: [
      { created_by: req.user.id },
      { assigned_agent_id: req.user.id },
      ...(clientIds.length > 0 ? [{ client_id: clientIds }] : []),
    ],
  };
};

const verifyTicketAccess = async (req, ticket) => {
  if (!ticket) return false;
  if (req.user.role === 'super_admin' || req.user.role === 'admin') return true;
  if (ticket.created_by === req.user.id) return true;
  if (ticket.assigned_agent_id === req.user.id) return true;
  if (ticket.client_id) {
    const membership = await ClientUser.findOne({
      where: { user_id: req.user.id, client_id: ticket.client_id },
    });
    return !!membership;
  }
  return false;
};

// Create ticket
router.post(
  '/',
  authenticate,
  requirePermission('ticket:create'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('type')
      .optional()
      .isIn(['support', 'request', 'change_request', 'maintenance', 'system_generated']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('status').optional().isIn(['open', 'in_progress', 'pending', 'resolved', 'closed']),
    body('client_id').optional().isInt(),
    body('assigned_agent_id').optional().isInt(),
    body('approval_required').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditService.logFailure(req, 'ticket_create_validation_failed', JSON.stringify(errors.array()));
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        type,
        priority,
        client_id,
        assigned_agent_id,
        approval_required,
        category,
        subcategory,
      } = req.body;

      let client = null;
      if (client_id) {
        client = await Client.findByPk(client_id);
        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }
      }

      const sla_due_at = await SlaService.computeTicketSlaDueDate(
        { created_at: new Date() },
        client
      );

      const ticket = await Ticket.create({
        title,
        description,
        type: type || 'support',
        priority: priority || 'medium',
        status: 'open',
        client_id: client_id || null,
        assigned_agent_id: assigned_agent_id || null,
        approval_required: !!approval_required || type === 'change_request',
        approval_status: type === 'change_request' ? 'pending' : 'approved',
        category: category || null,
        subcategory: subcategory || null,
        sla_due_at,
        created_by: req.user.id,
        updated_by: req.user.id,
      });

      await auditService.log(req, 'ticket_created', 'tickets', ticket.id, {
        title,
        type,
        priority,
        client_id,
      });

      res.status(201).json({ success: true, ticket });
    } catch (error) {
      await auditService.logFailure(req, 'ticket_create_failed', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// List tickets
router.get('/', authenticate, requirePermission('ticket:read'), async (req, res) => {
  try {
    const scope = await buildTicketScope(req);
    const tickets = await Ticket.findAll({
      where: scope,
      include: [
        { model: User, as: 'assigned_agent', attributes: ['id', 'email', 'display_name'] },
        { model: Client, attributes: ['id', 'name', 'reference_code'] },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ticket by id
router.get('/:id', authenticate, requirePermission('ticket:read'), async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assigned_agent', attributes: ['id', 'email', 'display_name'] },
        { model: Client, attributes: ['id', 'name', 'reference_code'] },
        { model: TicketTimeEntry },
        { model: TicketApproval },
        { model: TicketComment, include: [{ model: User, as: 'author', attributes: ['id', 'email', 'display_name'] }] },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!(await verifyTicketAccess(req, ticket))) {
      await auditService.logFailure(req, 'ticket_read_denied', 'Access denied', 'tickets', ticket.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments for a ticket
router.get('/:id/comments', authenticate, requirePermission('ticket:read'), async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!(await verifyTicketAccess(req, ticket))) {
      await auditService.logFailure(req, 'ticket_comments_read_denied', 'Access denied', 'tickets', ticket.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    const comments = await TicketComment.findAll({
      where: { ticket_id: ticket.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'email', 'display_name'] }],
      order: [['created_at', 'ASC']],
    });

    res.json({ success: true, comments });
  } catch (error) {
    await auditService.logFailure(req, 'ticket_comments_read_failed', error.message, 'tickets', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

// Add a comment to a ticket
router.post('/:id/comments', authenticate, requirePermission('ticket:update'), [body('comment').notEmpty().trim()], async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!(await verifyTicketAccess(req, ticket))) {
      await auditService.logFailure(req, 'ticket_comment_create_denied', 'Access denied', 'tickets', ticket.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    const comment = await TicketComment.create({
      ticket_id: ticket.id,
      author_id: req.user.id,
      comment: req.body.comment,
      internal: !!req.body.internal,
    });

    await auditService.log(req, 'ticket_comment_created', 'ticket_comments', comment.id, {
      ticket_id: ticket.id,
      author_id: req.user.id,
    });

    res.status(201).json({ success: true, comment });
  } catch (error) {
    await auditService.logFailure(req, 'ticket_comment_create_failed', error.message, 'tickets', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

// Update ticket
router.put(
  '/:id',
  authenticate,
  requirePermission('ticket:update'),
  [
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('status').optional().isIn(['open', 'in_progress', 'pending', 'resolved', 'closed']),
    body('type').optional().isIn(['support', 'request', 'change_request', 'maintenance', 'system_generated']),
    body('approval_required').optional().isBoolean(),
    body('approval_status').optional().isIn(['pending', 'approved', 'rejected']),
    body('client_id').optional().isInt(),
    body('assigned_agent_id').optional().isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditService.logFailure(req, 'ticket_update_validation_failed', JSON.stringify(errors.array()));
        return res.status(400).json({ errors: errors.array() });
      }

      const ticket = await Ticket.findByPk(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (!(await verifyTicketAccess(req, ticket))) {
        await auditService.logFailure(req, 'ticket_update_denied', 'Access denied', 'tickets', ticket.id);
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        title,
        description,
        priority,
        status,
        category,
        subcategory,
        assigned_agent_id,
        approval_required,
        approval_status,
        client_id,
        closure_justification,
        type,
      } = req.body;

      let client = null;
      if (client_id) {
        client = await Client.findByPk(client_id);
        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }
        ticket.client_id = client_id;
        ticket.sla_due_at = await SlaService.computeTicketSlaDueDate(ticket, client);
      }

      if (title) ticket.title = title;
      if (description !== undefined) ticket.description = description;
      if (priority) ticket.priority = priority;
      if (category !== undefined) ticket.category = category;
      if (subcategory !== undefined) ticket.subcategory = subcategory;
      if (assigned_agent_id !== undefined) ticket.assigned_agent_id = assigned_agent_id;
      if (approval_required !== undefined) ticket.approval_required = approval_required;
      if (approval_status) ticket.approval_status = approval_status;
      if (type) {
        ticket.type = type;
        if (type === 'change_request') {
          ticket.approval_required = true;
          ticket.approval_status = 'pending';
        }
      }

      if (status) {
        if (status === 'closed' && ticket.time_tracked_minutes === 0 && !closure_justification) {
          return res.status(400).json({
            error: 'Ticket cannot be closed without time tracked or closure justification',
          });
        }

        if (['in_progress', 'pending'].includes(status) && !ticket.first_response_at) {
          ticket.first_response_at = new Date();
        }

        if (['resolved', 'closed'].includes(status) && !ticket.resolved_at) {
          ticket.resolved_at = new Date();
        }

        ticket.status = status;
      }

      if (closure_justification !== undefined) {
        ticket.closure_justification = closure_justification;
      }

      ticket.updated_by = req.user.id;
      await ticket.save();

      await auditService.log(req, 'ticket_updated', 'tickets', ticket.id, {
        changes: req.body,
      });

      res.json({ success: true, ticket });
    } catch (error) {
      await auditService.logFailure(req, 'ticket_update_failed', error.message, 'tickets', req.params.id);
      res.status(500).json({ error: error.message });
    }
  }
);

// Assign ticket
router.post('/:id/assign', authenticate, requirePermission('ticket:assign'), [body('assigned_agent_id').isInt()], async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!(await verifyTicketAccess(req, ticket))) {
      await auditService.logFailure(req, 'ticket_assign_denied', 'Access denied', 'tickets', ticket.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    ticket.assigned_agent_id = req.body.assigned_agent_id;
    ticket.updated_by = req.user.id;
    await ticket.save();

    await auditService.log(req, 'ticket_assigned', 'tickets', ticket.id, {
      assigned_agent_id: ticket.assigned_agent_id,
    });

    res.json({ success: true, ticket });
  } catch (error) {
    await auditService.logFailure(req, 'ticket_assign_failed', error.message, 'tickets', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

// Approve ticket
router.post('/:id/approve', authenticate, requirePermission('ticket:approve'), [body('status').isIn(['approved', 'rejected'])], async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!ticket.approval_required) {
      return res.status(400).json({ error: 'Ticket does not require approval' });
    }

    ticket.approval_status = req.body.status;
    ticket.updated_by = req.user.id;
    await ticket.save();

    await TicketApproval.create({
      ticket_id: ticket.id,
      approver_id: req.user.id,
      approval_type: 'manager',
      status: req.body.status,
      notes: req.body.notes || null,
      reviewed_at: new Date(),
    });

    await auditService.log(req, 'ticket_approval_updated', 'tickets', ticket.id, {
      approval_status: ticket.approval_status,
    });

    res.json({ success: true, ticket });
  } catch (error) {
    await auditService.logFailure(req, 'ticket_approve_failed', error.message, 'tickets', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

// Add time entry
router.post('/:id/time-entry', authenticate, requirePermission('ticket:time-entry'), [body('minutes').isInt({ min: 1 })], async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!(await verifyTicketAccess(req, ticket))) {
      await auditService.logFailure(req, 'ticket_time_entry_denied', 'Access denied', 'tickets', ticket.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    const { minutes, notes, started_at, ended_at } = req.body;
    const entry = await TicketTimeEntry.create({
      ticket_id: ticket.id,
      user_id: req.user.id,
      minutes,
      notes: notes || null,
      started_at: started_at ? new Date(started_at) : null,
      ended_at: ended_at ? new Date(ended_at) : null,
    });

    ticket.time_tracked_minutes += minutes;
    ticket.updated_by = req.user.id;
    await ticket.save();

    await auditService.log(req, 'ticket_time_entry_added', 'tickets', ticket.id, {
      minutes,
      entry_id: entry.id,
    });

    res.status(201).json({ success: true, ticket, entry });
  } catch (error) {
    await auditService.logFailure(req, 'ticket_time_entry_failed', error.message, 'tickets', req.params.id);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
