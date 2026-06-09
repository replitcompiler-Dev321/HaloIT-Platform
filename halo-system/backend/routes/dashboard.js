const express = require('express');
const router = express.Router();
const { User, Ticket, AuditLog, Role, Client } = require('../db/models');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dashboardService = require('../services/dashboard');
const auditService = require('../services/audit');

/**
 * GET /api/dashboard
 * Get comprehensive dashboard metrics
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const metrics = await dashboardService.getMetrics(req.user.id, req.user.role);
    
    await auditService.log(req, 'dashboard_viewed', 'dashboard', null);

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await auditService.logFailure(req, 'dashboard_error', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/tickets
 * Get detailed ticket metrics
 */
router.get('/tickets', authenticate, async (req, res) => {
  try {
    const ticketMetrics = await dashboardService.getTicketMetrics(req.user.role);
    
    res.json({
      success: true,
      tickets: ticketMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/agents
 * Get agent performance metrics
 */
router.get('/agents', authenticate, requirePermission('dashboard:read'), async (req, res) => {
  try {
    const agentMetrics = await dashboardService.getAgentMetrics();
    
    res.json({
      success: true,
      agents: agentMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/clients
 * Get client health and metrics
 */
router.get('/clients', authenticate, requirePermission('dashboard:read'), async (req, res) => {
  try {
    const clientMetrics = await dashboardService.getClientMetrics();
    
    res.json({
      success: true,
      clients: clientMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/sla
 * Get SLA compliance metrics
 */
router.get('/sla', authenticate, requirePermission('dashboard:read'), async (req, res) => {
  try {
    const slaMetrics = await dashboardService.getSlaMetrics();
    
    res.json({
      success: true,
      sla: slaMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/performance
 * Get system performance metrics
 */
router.get('/performance', authenticate, requirePermission('dashboard:read'), async (req, res) => {
  try {
    const performanceMetrics = await dashboardService.getPerformanceMetrics();
    
    res.json({
      success: true,
      performance: performanceMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/alerts
 * Get active system alerts
 */
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const alerts = await dashboardService.getAlerts();
    
    res.json({
      success: true,
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/trends
 * Get ticket trends over specified days
 */
router.get('/trends', authenticate, requirePermission('dashboard:read'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const trends = await dashboardService.getTicketTrends(days);
    
    res.json({
      success: true,
      trends,
      period: days,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
