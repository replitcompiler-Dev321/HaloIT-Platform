const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const monitoringService = require('../services/monitoring');
const auditService = require('../services/audit');

/**
 * GET /api/monitoring/health
 * Get system and device health status
 */
router.get('/health', authenticate, requirePermission('monitoring:read'), async (req, res) => {
  try {
    const health = monitoringService.getSystemHealth();
    
    await auditService.log(req, 'monitoring_health_viewed', 'monitoring', null);

    res.json({
      success: true,
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await auditService.logFailure(req, 'monitoring_health_error', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/devices
 * Get all monitored devices
 */
router.get('/devices', authenticate, requirePermission('monitoring:read'), async (req, res) => {
  try {
    const devices = monitoringService.getAllDevices();
    
    res.json({
      success: true,
      devices,
      total: devices.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/devices/:deviceId
 * Get specific device health and metrics
 */
router.get('/devices/:deviceId', authenticate, requirePermission('monitoring:read'), async (req, res) => {
  try {
    const device = monitoringService.getDeviceHealth(req.params.deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitoring/devices/:deviceId/heartbeat
 * Update device heartbeat with current metrics
 */
router.post('/devices/:deviceId/heartbeat', async (req, res) => {
  try {
    const { cpu, memory, disk } = req.body;

    if (cpu === undefined || memory === undefined || disk === undefined) {
      return res.status(400).json({ error: 'Missing required metrics: cpu, memory, disk' });
    }

    monitoringService.updateDeviceHeartbeat(req.params.deviceId, {
      cpu: Math.min(100, Math.max(0, cpu)),
      memory: Math.min(100, Math.max(0, memory)),
      disk: Math.min(100, Math.max(0, disk)),
    });

    res.json({
      success: true,
      message: 'Heartbeat updated',
      deviceId: req.params.deviceId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get critical alerts for monitored devices
 */
router.get('/alerts', authenticate, requirePermission('monitoring:read'), async (req, res) => {
  try {
    const alerts = monitoringService.getCriticalAlerts();
    
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
 * GET /api/monitoring/devices/:deviceId/history
 * Get device metrics history
 */
router.get('/devices/:deviceId/history', authenticate, requirePermission('monitoring:read'), async (req, res) => {
  try {
    const { metricType, hoursBack } = req.query;
    const history = monitoringService.getDeviceMetricsHistory(
      req.params.deviceId,
      metricType || 'all',
      parseInt(hoursBack) || 24
    );

    if (!history) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monitoring/devices
 * Register new device for monitoring
 */
router.post('/devices', authenticate, requirePermission('monitoring:create'), async (req, res) => {
  try {
    const { deviceId, name, type, assignedClient } = req.body;

    if (!deviceId || !name || !type) {
      return res.status(400).json({ error: 'Missing required fields: deviceId, name, type' });
    }

    monitoringService.registerDevice(deviceId, {
      name,
      type,
      assignedClient: assignedClient || null,
    });

    await auditService.log(req, 'device_registered', 'monitoring', deviceId, { name, type });

    res.status(201).json({
      success: true,
      message: 'Device registered for monitoring',
      deviceId,
    });
  } catch (error) {
    await auditService.logFailure(req, 'device_registration_failed', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
