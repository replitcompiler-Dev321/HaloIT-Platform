/**
 * Halo IT Services 365 - Authentication Manager
 * Handles authentication flows and session management
 */

class AuthManager {
  constructor() {
    this.user = this.getStoredUser();
    this.listeners = [];
  }

  /**
   * Store user in localStorage
   */
  setUser(user) {
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
    this.notifyListeners();
  }

  /**
   * Get stored user
   */
  getStoredUser() {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Clear user session
   */
  clearUser() {
    this.user = null;
    localStorage.removeItem('user');
    haloAPI.clearToken();
    this.notifyListeners();
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return !!this.user && haloAPI.isAuthenticated();
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Check if user has role
   */
  hasRole(role) {
    return this.user && this.user.role === role;
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission) {
    if (!this.user) return false;
    const permissions = this.user.permissions || [];
    return permissions.includes(permission);
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.hasRole('admin') || this.hasRole('super_admin');
  }

  /**
   * Check if user is agent
   */
  isAgent() {
    return this.hasRole('agent');
  }

  /**
   * Check if user is client
   */
  isClient() {
    return this.hasRole('client');
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      const response = await haloAPI.login(email, password);

      if (response.mfaRequired) {
        return { mfaRequired: true, sessionId: response.sessionId };
      }

      if (response.token) {
        haloAPI.setToken(response.token);
        this.setUser(response.user);
        return { success: true, user: response.user };
      }

      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(mfaCode) {
    try {
      const response = await haloAPI.verifyMFA(mfaCode);

      if (response.token) {
        haloAPI.setToken(response.token);
        this.setUser(response.user);
        return { success: true, user: response.user };
      }

      throw new Error('Invalid MFA code');
    } catch (error) {
      console.error('MFA verification error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await haloAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearUser();
    }
  }

  /**
   * Refresh user profile from server
   */
  async refreshProfile() {
    try {
      const user = await haloAPI.getProfile();
      this.setUser(user);
      return user;
    } catch (error) {
      console.error('Profile refresh error:', error);
      if (error.status === 401) {
        this.clearUser();
      }
      throw error;
    }
  }

  /**
   * Check authentication and redirect if needed
   */
  requireAuth(redirectUrl = '/login.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  /**
   * Check role and redirect if needed
   */
  requireRole(role, redirectUrl = '/login.html') {
    if (!this.isLoggedIn() || !this.hasRole(role)) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  /**
   * Subscribe to auth changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify listeners of auth changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.user));
  }
}

// Create global auth manager instance
window.authManager = new AuthManager();

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  if (window.authManager.isLoggedIn()) {
    try {
      // Refresh user profile to ensure session is valid
      await window.authManager.refreshProfile();
    } catch (error) {
      console.error('Session validation failed:', error);
      window.authManager.clearUser();
      if (window.location.pathname !== '/login.html') {
        window.location.href = '/login.html';
      }
    }
  }
});
