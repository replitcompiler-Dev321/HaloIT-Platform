const { User, Ticket, Client, ClientUser, AuditLog, Role } = require('../db/models');
const { Op, sequelize } = require('sequelize');
const SlaService = require('./sla');

class DashboardService {
  /**
   * Get comprehensive dashboard metrics
   */
  async getMetrics(userId, userRole) {
    try {
      const metrics = {
        tickets: await this.getTicketMetrics(userRole),
        agents: await this.getAgentMetrics(),
        clients: await this.getClientMetrics(),
        sla: await this.getSlaMetrics(),
        performance: await this.getPerformanceMetrics(),
        alerts: await this.getAlerts(),
      };
      return metrics;
    } catch (error) {
      throw new Error(`Failed to get dashboard metrics: ${error.message}`);
    }
  }

  /**
   * Get ticket statistics and breakdown
   */
  async getTicketMetrics(userRole) {
    try {
      const statuses = ['open', 'in_progress', 'closed', 'on_hold', 'cancelled'];
      const priorities = ['low', 'medium', 'high', 'critical'];

      const metrics = {
        byStatus: {},
        byPriority: {},
        total: 0,
        avgResolutionTime: 0,
      };

      // Count by status
      for (const status of statuses) {
        metrics.byStatus[status] = await Ticket.count({ where: { status } });
      }

      // Count by priority
      for (const priority of priorities) {
        metrics.byPriority[priority] = await Ticket.count({ where: { priority } });
      }

      metrics.total = Object.values(metrics.byStatus).reduce((a, b) => a + b, 0);

      // Calculate average resolution time
      const closedTickets = await Ticket.findAll({
        where: { status: 'closed' },
        attributes: ['created_at', 'updated_at'],
        limit: 100,
      });

      if (closedTickets.length > 0) {
        const resolutionTimes = closedTickets.map((t) => {
          return new Date(t.updated_at) - new Date(t.created_at);
        });
        metrics.avgResolutionTime = Math.round(
          resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / (1000 * 60 * 60)
        );
      }

      // Get overdue tickets
      const now = new Date();
      metrics.overdue = await Ticket.count({
        where: {
          status: { [Op.ne]: 'closed' },
          sla_due_date: { [Op.lt]: now },
        },
      });

      return metrics;
    } catch (error) {
      throw new Error(`Failed to get ticket metrics: ${error.message}`);
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentMetrics() {
    try {
      const agents = await User.findAll({
        where: {
          role_id: {
            [Op.in]: sequelize.literal(
              '(SELECT id FROM roles WHERE name IN ("admin", "manager", "technician"))'
            ),
          },
        },
        include: [{ model: Role, attributes: ['name'] }],
      });

      const agentMetrics = [];

      for (const agent of agents) {
        const assignedTickets = await Ticket.count({
          where: { assigned_agent_id: agent.id },
        });

        const resolvedTickets = await Ticket.count({
          where: { assigned_agent_id: agent.id, status: 'closed' },
        });

        const avgResponseTime = await this.getAverageResponseTime(agent.id);

        agentMetrics.push({
          id: agent.id,
          email: agent.email,
          display_name: agent.display_name,
          role: agent.Role?.name || 'technician',
          status: agent.status,
          ticketsAssigned: assignedTickets,
          ticketsResolved: resolvedTickets,
          resolutionRate: assignedTickets > 0 ? Math.round((resolvedTickets / assignedTickets) * 100) : 0,
          avgResponseTime,
        });
      }

      return agentMetrics;
    } catch (error) {
      throw new Error(`Failed to get agent metrics: ${error.message}`);
    }
  }

  /**
   * Get client metrics and health
   */
  async getClientMetrics() {
    try {
      const clients = await Client.findAll({
        attributes: ['id', 'name', 'sla_tier', 'created_at'],
      });

      const clientMetrics = [];

      for (const client of clients) {
        const activeTickets = await Ticket.count({
          where: {
            client_id: client.id,
            status: { [Op.ne]: 'closed' },
          },
        });

        const resolvedTickets = await Ticket.count({
          where: {
            client_id: client.id,
            status: 'closed',
          },
        });

        const clientUsers = await ClientUser.count({
          where: { client_id: client.id },
        });

        const overdueSla = await Ticket.count({
          where: {
            client_id: client.id,
            status: { [Op.ne]: 'closed' },
            sla_due_date: { [Op.lt]: new Date() },
          },
        });

        clientMetrics.push({
          id: client.id,
          name: client.name,
          slaTier: client.sla_tier,
          activeTickets,
          resolvedTickets,
          contactCount: clientUsers,
          slaBreach: overdueSla,
          health: overdueSla === 0 ? 'healthy' : overdueSla <= 2 ? 'warning' : 'critical',
        });
      }

      return clientMetrics.sort((a, b) => b.activeTickets - a.activeTickets);
    } catch (error) {
      throw new Error(`Failed to get client metrics: ${error.message}`);
    }
  }

  /**
   * Get SLA performance metrics
   */
  async getSlaMetrics() {
    try {
      const totalTickets = await Ticket.count({
        where: { status: 'closed' },
      });

      const withinSla = await Ticket.count({
        where: {
          status: 'closed',
          sla_met: true,
        },
      });

      const breachedSla = await Ticket.count({
        where: {
          status: 'closed',
          sla_met: false,
        },
      });

      const currentBreaches = await Ticket.count({
        where: {
          status: { [Op.ne]: 'closed' },
          sla_due_date: { [Op.lt]: new Date() },
        },
      });

      return {
        totalClosed: totalTickets,
        withinSla,
        breachedSla,
        complianceRate: totalTickets > 0 ? Math.round((withinSla / totalTickets) * 100) : 0,
        currentBreaches,
      };
    } catch (error) {
      throw new Error(`Failed to get SLA metrics: ${error.message}`);
    }
  }

  /**
   * Get system performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ticketsCreatedToday = await Ticket.count({
        where: {
          created_at: { [Op.gte]: today },
        },
      });

      const ticketsResolvedToday = await Ticket.count({
        where: {
          status: 'closed',
          updated_at: { [Op.gte]: today },
        },
      });

      const activeUsers = await AuditLog.count({
        where: {
          created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        distinct: true,
        col: 'user_id',
      });

      return {
        ticketsCreatedToday,
        ticketsResolvedToday,
        activeUsersLast24h: activeUsers,
      };
    } catch (error) {
      throw new Error(`Failed to get performance metrics: ${error.message}`);
    }
  }

  /**
   * Get active alerts
   */
  async getAlerts() {
    try {
      const alerts = [];

      // SLA breach alerts
      const slaBreaches = await Ticket.findAll({
        where: {
          status: { [Op.ne]: 'closed' },
          sla_due_date: { [Op.lt]: new Date() },
        },
        limit: 10,
        order: [['sla_due_date', 'ASC']],
        include: [
          { model: Client, attributes: ['name'] },
        ],
      });

      alerts.push(
        ...slaBreaches.map((t) => ({
          type: 'sla_breach',
          severity: 'critical',
          title: `SLA Breach: ${t.title}`,
          description: `Ticket ${t.id} for ${t.Client?.name} has breached SLA`,
          ticketId: t.id,
          createdAt: t.created_at,
        }))
      );

      // Critical priority tickets without assignment
      const unassignedCritical = await Ticket.count({
        where: {
          priority: 'critical',
          assigned_agent_id: null,
          status: { [Op.ne]: 'closed' },
        },
      });

      if (unassignedCritical > 0) {
        alerts.push({
          type: 'unassigned_critical',
          severity: 'high',
          title: `${unassignedCritical} Critical Tickets Unassigned`,
          description: `There are ${unassignedCritical} critical priority tickets without assignment`,
          count: unassignedCritical,
        });
      }

      // Inactive agents
      const inactiveAgents = await AuditLog.sequelize.query(
        `
        SELECT DISTINCT u.id, u.email, u.display_name
        FROM users u
        WHERE u.role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'technician', 'manager'))
        AND u.id NOT IN (
          SELECT DISTINCT user_id FROM audit_logs 
          WHERE created_at > datetime('now', '-1 day')
        )
        LIMIT 5
        `,
        { type: sequelize.QueryTypes.SELECT }
      );

      if (inactiveAgents.length > 0) {
        alerts.push({
          type: 'inactive_agents',
          severity: 'info',
          title: `${inactiveAgents.length} Agents Inactive (24h)`,
          description: `Agents have not logged activity in the last 24 hours`,
          count: inactiveAgents.length,
        });
      }

      return alerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
    } catch (error) {
      throw new Error(`Failed to get alerts: ${error.message}`);
    }
  }

  /**
   * Get average response time for an agent
   */
  async getAverageResponseTime(agentId) {
    try {
      const tickets = await Ticket.findAll({
        where: { assigned_agent_id: agentId },
        attributes: ['created_at', 'updated_at'],
        limit: 20,
      });

      if (tickets.length === 0) return 0;

      const responseTimes = tickets.map((t) => {
        return new Date(t.updated_at) - new Date(t.created_at);
      });

      const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const avgHours = Math.round(avgMs / (1000 * 60 * 60));

      return avgHours;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get ticket trends over time
   */
  async getTicketTrends(days = 7) {
    try {
      const trends = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const created = await Ticket.count({
          where: {
            created_at: { [Op.gte]: date, [Op.lt]: nextDate },
          },
        });

        const resolved = await Ticket.count({
          where: {
            status: 'closed',
            updated_at: { [Op.gte]: date, [Op.lt]: nextDate },
          },
        });

        trends.push({
          date: date.toISOString().split('T')[0],
          created,
          resolved,
        });
      }

      return trends;
    } catch (error) {
      throw new Error(`Failed to get ticket trends: ${error.message}`);
    }
  }
}

module.exports = new DashboardService();
