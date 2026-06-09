const { sequelize } = require('../db/models');
const { Op } = require('sequelize');

/**
 * Monitoring Service
 * Handles device monitoring, system health checks, and performance tracking
 */
class MonitoringService {
  /**
   * Initialize monitoring data structures
   */
  constructor() {
    this.devices = new Map();
    this.systemHealth = {
      cpu: 0,
      memory: 0,
      disk: 0,
    };
  }

  /**
   * Register a device for monitoring
   */
  registerDevice(deviceId, deviceData) {
    this.devices.set(deviceId, {
      id: deviceId,
      ...deviceData,
      lastHeartbeat: new Date(),
      status: 'online',
      metrics: {
        cpu: 0,
        memory: 0,
        disk: 0,
      },
    });
  }

  /**
   * Update device heartbeat and metrics
   */
  updateDeviceHeartbeat(deviceId, metrics) {
    if (this.devices.has(deviceId)) {
      const device = this.devices.get(deviceId);
      device.lastHeartbeat = new Date();
      device.metrics = { ...metrics };
      device.status = 'online';
    }
  }

  /**
   * Get device health status
   */
  getDeviceHealth(deviceId) {
    if (!this.devices.has(deviceId)) {
      return null;
    }

    const device = this.devices.get(deviceId);
    const timeSinceHeartbeat = Date.now() - device.lastHeartbeat.getTime();
    const offline_threshold = 5 * 60 * 1000; // 5 minutes

    if (timeSinceHeartbeat > offline_threshold) {
      device.status = 'offline';
    }

    // Determine health based on metrics
    let health = 'healthy';
    if (device.metrics.cpu > 90 || device.metrics.memory > 90 || device.metrics.disk > 90) {
      health = 'warning';
    }
    if (device.metrics.cpu > 95 || device.metrics.memory > 95 || device.metrics.disk > 95) {
      health = 'critical';
    }

    return {
      id: device.id,
      name: device.name,
      type: device.type,
      status: device.status,
      health,
      metrics: device.metrics,
      lastHeartbeat: device.lastHeartbeat,
      assignedClient: device.assignedClient,
    };
  }

  /**
   * Get all monitored devices
   */
  getAllDevices() {
    const devices = [];
    for (const [, device] of this.devices) {
      devices.push(this.getDeviceHealth(device.id));
    }
    return devices;
  }

  /**
   * Get system health overview
   */
  getSystemHealth() {
    let totalCpu = 0;
    let totalMemory = 0;
    let totalDisk = 0;
    let deviceCount = this.devices.size;

    for (const [, device] of this.devices) {
      totalCpu += device.metrics.cpu || 0;
      totalMemory += device.metrics.memory || 0;
      totalDisk += device.metrics.disk || 0;
    }

    return {
      devices: {
        total: deviceCount,
        online: Array.from(this.devices.values()).filter((d) => d.status === 'online').length,
        offline: Array.from(this.devices.values()).filter((d) => d.status === 'offline').length,
      },
      averageMetrics: {
        cpu: deviceCount > 0 ? Math.round(totalCpu / deviceCount) : 0,
        memory: deviceCount > 0 ? Math.round(totalMemory / deviceCount) : 0,
        disk: deviceCount > 0 ? Math.round(totalDisk / deviceCount) : 0,
      },
      status: this.calculateOverallHealth(),
    };
  }

  /**
   * Calculate overall system health
   */
  calculateOverallHealth() {
    const health = this.getSystemHealth();
    const avgCpu = health.averageMetrics.cpu;
    const avgMemory = health.averageMetrics.memory;
    const avgDisk = health.averageMetrics.disk;

    if (avgCpu > 90 || avgMemory > 90 || avgDisk > 90) {
      return 'critical';
    }
    if (avgCpu > 80 || avgMemory > 80 || avgDisk > 80) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Get critical alerts for monitored devices
   */
  getCriticalAlerts() {
    const alerts = [];

    for (const [, device] of this.devices) {
      // Check for offline devices
      if (device.status === 'offline') {
        const timeSinceHeartbeat = Math.round((Date.now() - device.lastHeartbeat.getTime()) / 1000 / 60);
        alerts.push({
          type: 'device_offline',
          severity: 'critical',
          deviceId: device.id,
          deviceName: device.name,
          message: `Device ${device.name} has been offline for ${timeSinceHeartbeat} minutes`,
          timestamp: new Date(),
        });
      }

      // Check for high resource usage
      if (device.metrics.cpu > 95) {
        alerts.push({
          type: 'high_cpu',
          severity: 'critical',
          deviceId: device.id,
          deviceName: device.name,
          message: `Device ${device.name} CPU usage is ${device.metrics.cpu}%`,
          timestamp: new Date(),
        });
      }

      if (device.metrics.memory > 95) {
        alerts.push({
          type: 'high_memory',
          severity: 'critical',
          deviceId: device.id,
          deviceName: device.name,
          message: `Device ${device.name} memory usage is ${device.metrics.memory}%`,
          timestamp: new Date(),
        });
      }

      if (device.metrics.disk > 95) {
        alerts.push({
          type: 'low_disk_space',
          severity: 'critical',
          deviceId: device.id,
          deviceName: device.name,
          message: `Device ${device.name} disk usage is ${device.metrics.disk}%`,
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Get device metrics history (for charting)
   */
  getDeviceMetricsHistory(deviceId, metricType = 'all', hoursBack = 24) {
    if (!this.devices.has(deviceId)) {
      return null;
    }

    // This would typically query a time-series database like InfluxDB or TimescaleDB
    // For now, return mock data structure
    return {
      deviceId,
      metricType,
      period: `${hoursBack}h`,
      data: [], // Would be populated from historical data
    };
  }

  /**
   * Simulate device data for testing
   */
  generateMockDeviceData() {
    const devices = [
      { id: 'device-001', name: 'Server-01', type: 'server', assignedClient: 'Acme Corp' },
      { id: 'device-002', name: 'Workstation-01', type: 'workstation', assignedClient: 'Acme Corp' },
      { id: 'device-003', name: 'Router-Main', type: 'network', assignedClient: 'Central Office' },
      { id: 'device-004', name: 'Storage-NAS-01', type: 'storage', assignedClient: 'Acme Corp' },
    ];

    for (const device of devices) {
      this.registerDevice(device.id, device);
      // Simulate realistic metrics
      const metrics = {
        cpu: Math.floor(Math.random() * 70) + 10,
        memory: Math.floor(Math.random() * 60) + 20,
        disk: Math.floor(Math.random() * 50) + 25,
      };
      this.updateDeviceHeartbeat(device.id, metrics);
    }
  }
}

module.exports = new MonitoringService();
