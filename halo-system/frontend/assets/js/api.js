/**
 * Halo IT Services 365 - API Client
 * Handles all API communication with the backend
 */

class HaloAPI {
  constructor() {
    this.baseURL = this.getApiBaseUrl();
    this.token = this.getToken();
    this.tokenRefreshTimer = null;
  }

  /**
   * Get API base URL based on environment
   */
  getApiBaseUrl() {
    if (window.HALO_API_BASE_URL) {
      return window.HALO_API_BASE_URL;
    }

    if (window.HALO_BACKEND_URL) {
      return window.HALO_BACKEND_URL;
    }

    if (typeof window.getHaloApiBaseUrl === 'function') {
      return window.getHaloApiBaseUrl();
    }

    const host = window.location.hostname;
    const proto = window.location.protocol;
    const isCodespaces = /(?:\.app\.github\.dev|\.github\.dev)$/.test(host);

    if (isCodespaces) {
      const parts = host.split('-');
      const owner = parts[0];
      const repoPort = parts[1];
      return `${proto}//3000-${owner}-${repoPort}.app.github.dev`;
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return `${proto}//localhost:3000`;
    }

    return `${proto}//${host}`;
  }

  /**
   * Get stored JWT token
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Store JWT token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  /**
   * Clear stored token
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        this.clearToken();
        window.location.href = '/login.html';
        throw new Error('Unauthorized. Please log in again.');
      }

      const contentType = response.headers.get('content-type') || '';
      let data;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text || `Unexpected response (${response.status})` };
        }
      }

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.error || data.message || 'An error occurred',
          data,
        };
      }

      return data;
    } catch (error) {
      console.error(`API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // ===== AUTHENTICATION ENDPOINTS =====

  async login(email, password, mfaCode = null) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, mfaCode }),
    });
  }

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async verifyMFA(mfaCode) {
    return this.request('/api/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ token: mfaCode }),
    });
  }

  async getProfile() {
    return this.request('/api/auth/profile', {
      method: 'GET',
    });
  }

  async updateProfile(profileData) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // ===== DASHBOARD ENDPOINTS =====

  async getDashboardMetrics() {
    return this.request('/api/dashboard', { method: 'GET' });
  }

  async getTicketMetrics() {
    return this.request('/api/dashboard/tickets', { method: 'GET' });
  }

  async getAgentMetrics() {
    return this.request('/api/dashboard/agents', { method: 'GET' });
  }

  async getClientMetrics() {
    return this.request('/api/dashboard/clients', { method: 'GET' });
  }

  async getSLAMetrics() {
    return this.request('/api/dashboard/sla', { method: 'GET' });
  }

  async getPerformanceMetrics() {
    return this.request('/api/dashboard/performance', { method: 'GET' });
  }

  async getAlerts() {
    return this.request('/api/dashboard/alerts', { method: 'GET' });
  }

  async getTicketTrends() {
    return this.request('/api/dashboard/trends', { method: 'GET' });
  }

  // ===== TICKET ENDPOINTS =====

  async getTickets(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params ? `/api/tickets?${params}` : '/api/tickets';
    return this.request(endpoint, { method: 'GET' });
  }

  async getTicket(ticketId) {
    return this.request(`/api/tickets/${ticketId}`, { method: 'GET' });
  }

  async createTicket(ticketData) {
    return this.request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async updateTicket(ticketId, ticketData) {
    return this.request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(ticketData),
    });
  }

  async deleteTicket(ticketId) {
    return this.request(`/api/tickets/${ticketId}`, {
      method: 'DELETE',
    });
  }

  async assignTicket(ticketId, agentId) {
    return this.request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignedTo: agentId }),
    });
  }

  async updateTicketStatus(ticketId, status) {
    return this.request(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // ===== CLIENT PORTAL ENDPOINTS =====

  async getClientTickets(clientId) {
    return this.request(`/api/clients/${clientId}/tickets`, { method: 'GET' });
  }

  async submitClientTicket(clientId, ticketData) {
    return this.request(`/api/clients/${clientId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async getClientInfo(clientId) {
    return this.request(`/api/clients/${clientId}`, { method: 'GET' });
  }

  // ===== MONITORING ENDPOINTS =====

  async getSystemHealth() {
    return this.request('/api/monitoring/health', { method: 'GET' });
  }

  async getDevices() {
    return this.request('/api/monitoring/devices', { method: 'GET' });
  }

  async getDevice(deviceId) {
    return this.request(`/api/monitoring/devices/${deviceId}`, { method: 'GET' });
  }

  async registerDevice(deviceData) {
    return this.request('/api/monitoring/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
  }

  async sendDeviceHeartbeat(deviceId, metrics) {
    return this.request(`/api/monitoring/devices/${deviceId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }

  async getMonitoringAlerts() {
    return this.request('/api/monitoring/alerts', { method: 'GET' });
  }

  // ===== AGENT ENDPOINTS =====

  async getAgents() {
    return this.request('/api/users?role=agent', { method: 'GET' });
  }

  async getAgent(agentId) {
    return this.request(`/api/users/${agentId}`, { method: 'GET' });
  }

  async createAgent(agentData) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(agentId, agentData) {
    return this.request(`/api/users/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    });
  }

  // ===== TICKET COMMENT ENDPOINTS =====

  async getTicketComments(ticketId) {
    return this.request(`/api/tickets/${ticketId}/comments`, { method: 'GET' });
  }

  async addTicketComment(ticketId, commentText, isInternal = false) {
    return this.request(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        comment: commentText,
        internal: isInternal,
      }),
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Format API error for display
   */
  formatError(error) {
    if (typeof error === 'string') {
      return error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  /**
   * Check if request was successful
   */
  isSuccessful(response) {
    return response && !response.error;
  }
}

// Create global API instance
window.haloAPI = new HaloAPI();
