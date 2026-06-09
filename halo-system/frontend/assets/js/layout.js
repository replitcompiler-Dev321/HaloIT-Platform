/**
 * Navigation and Layout Management for Halo IT Services 365
 * Handles dynamic navbar injection, page context detection, and footer rendering
 */

class HaloLayout {
  constructor() {
    this.currentPage = this.detectPage();
    this.isAuthenticated = !!localStorage.getItem('token');
    this.userRole = localStorage.getItem('userRole') || null;
  }

  /**
   * Detect current page based on URL
   */
  detectPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('login')) return 'login';
    if (path.includes('mfa')) return 'mfa';
    if (path.includes('admin')) return 'admin';
    if (path.includes('dashboard') && !path.includes('admin')) return 'dashboard';
    if (path.includes('client-portal') || path.includes('portal')) return 'portal';
    if (path.includes('about')) return 'about';
    if (path.includes('services')) return 'services';
    if (path.includes('pricing')) return 'pricing';
    if (path.includes('contact')) return 'contact';
    return 'home';
  }

  /**
   * Render navigation bar
   */
  renderNavbar() {
    // Don't show navbar on login/MFA pages
    if (['login', 'mfa'].includes(this.currentPage)) {
      return;
    }

    const navbar = document.createElement('nav');
    navbar.className = 'navbar';

    let navHtml = `
      <div class="container flex-between">
        <a href="/" class="navbar-brand">🚀 Halo IT Services</a>
        <div class="navbar-menu">
    `;

    // Public site navigation
    if (!this.isAuthenticated && !['login', 'mfa', 'admin'].includes(this.currentPage)) {
      navHtml += `
        <a href="/" class="${this.currentPage === 'home' ? 'active' : ''}">Home</a>
        <a href="/about.html" class="${this.currentPage === 'about' ? 'active' : ''}">About</a>
        <a href="/services.html" class="${this.currentPage === 'services' ? 'active' : ''}">Services</a>
        <a href="/pricing.html" class="${this.currentPage === 'pricing' ? 'active' : ''}">Pricing</a>
        <a href="/contact.html" class="${this.currentPage === 'contact' ? 'active' : ''}">Contact</a>
        <a href="/login.html" class="btn btn-primary btn-sm">Login</a>
      `;
    }
    // Client Portal navigation
    else if (this.isAuthenticated && this.currentPage === 'portal') {
      navHtml += `
        <a href="/client-portal/index.html">Dashboard</a>
        <a href="/client-portal/index.html?view=tickets">My Tickets</a>
        <a href="/client-portal/index.html?view=knowledge">Knowledge Base</a>
        <span class="navbar-spacer"></span>
        <button class="text-secondary" onclick="haloLayout.handleLogout()">Logout</button>
      `;
    }
    // Admin Dashboard navigation
    else if (this.isAuthenticated && this.currentPage === 'admin') {
      navHtml += `
        <a href="/admin-portal.html" class="active">Admin Portal</a>
        <span class="navbar-spacer"></span>
        <span class="text-secondary" id="adminUserName">Admin</span>
        <button class="text-secondary btn-sm" onclick="haloLayout.handleLogout()">Logout</button>
      `;
    }
    // Staff Dashboard navigation
    else if (this.isAuthenticated && this.currentPage === 'dashboard') {
      navHtml += `
        <a href="/dashboard.html" class="active">Dashboard</a>
        <span class="navbar-spacer"></span>
        <span class="text-secondary" id="staffUserName">User</span>
        <button class="text-secondary btn-sm" onclick="haloLayout.handleLogout()">Logout</button>
      `;
    }
    // Login/MFA page (minimal nav)
    else if (['login', 'mfa'].includes(this.currentPage)) {
      navHtml += `
        <a href="/">← Back to Home</a>
      `;
    }

    navHtml += `
        </div>
      </div>
    `;

    navbar.innerHTML = navHtml;
    
    // Insert at the very beginning of body
    const existingNav = document.querySelector('.navbar');
    if (existingNav) {
      existingNav.remove();
    }
    document.body.insertBefore(navbar, document.body.firstChild);
  }

  /**
   * Render footer
   */
  renderFooter() {
    // Only show footer on public pages and client portal
    if (['login', 'mfa', 'admin', 'dashboard'].includes(this.currentPage)) {
      return;
    }

    const footer = document.createElement('footer');
    footer.className = 'footer';

    footer.innerHTML = `
      <div class="container">
        <div class="footer-section">
          <h3>Halo IT Services</h3>
          <p>Professional managed IT services for businesses of all sizes.</p>
          <p>Supporting your growth with reliable, secure IT infrastructure.</p>
        </div>
        <div class="footer-section">
          <h3>Company</h3>
          <a href="/about.html">About Us</a>
          <a href="/services.html">Services</a>
          <a href="/pricing.html">Pricing</a>
          <a href="/contact.html">Contact</a>
        </div>
        <div class="footer-section">
          <h3>Support</h3>
          <a href="/client-portal/index.html">Client Portal</a>
          <a href="/login.html">Staff Login</a>
          <a href="mailto:support@haloitservices.co.za">Email Support</a>
          <a href="tel:+27123456789">Phone Support</a>
        </div>
        <div class="footer-section">
          <h3>Legal</h3>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security</a>
          <a href="#">Compliance</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 Halo IT Services 365. All rights reserved. | Professional IT Support &amp; Managed Services</p>
      </div>
    `;

    document.body.appendChild(footer);
  }

  /**
   * Load and inject shared styles
   */
  loadStyles() {
    if (!document.querySelector('link[href*="shared.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/css/shared.css';
      document.head.appendChild(link);
    }
  }

  /**
   * Initialize layout
   */
  init() {
    this.loadStyles();
    this.renderNavbar();
    this.renderFooter();
    this.setupLogoutHandler();
  }

  /**
   * Setup logout handler
   */
  setupLogoutHandler() {
    window.haloLayout = this;
  }

  /**
   * Handle logout
   */
  handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    window.location.href = '/login.html';
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const layout = new HaloLayout();
    layout.init();
  });
} else {
  const layout = new HaloLayout();
  layout.init();
}
