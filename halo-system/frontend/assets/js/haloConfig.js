/**
 * Halo IT Services 365 - Frontend configuration helper
 * Use window.HALO_API_BASE_URL to override the backend API base URL
 * when the frontend is hosted separately from the backend.
 */
(function () {
  if (typeof window.HALO_API_BASE_URL === 'undefined') {
    window.HALO_API_BASE_URL = '';
  }
  if (typeof window.HALO_BACKEND_URL === 'undefined') {
    window.HALO_BACKEND_URL = '';
  }

  const DEFAULT_REMOTE_BACKEND_URL = 'https://haloit-backend-production.up.railway.app';

  function isLocalHost(host) {
    return host === 'localhost' || host === '127.0.0.1';
  }

  function isCodespacesHost(host) {
    return /(?:\.app\.github\.dev|\.github\.dev)$/.test(host);
  }

  function getHaloApiBaseUrl() {
    if (window.HALO_API_BASE_URL) {
      return window.HALO_API_BASE_URL;
    }

    if (window.HALO_BACKEND_URL) {
      return window.HALO_BACKEND_URL;
    }

    const host = window.location.hostname;
    const proto = window.location.protocol;

    if (isCodespacesHost(host)) {
      const parts = host.split('-');
      const owner = parts[0];
      const repoPort = parts[1];
      return `${proto}//3000-${owner}-${repoPort}.app.github.dev`;
    }

    if (isLocalHost(host)) {
      return `${proto}//localhost:3000`;
    }

    return `${proto}//${host}`;
  }

  const host = window.location.hostname;
  if (!window.HALO_API_BASE_URL && !window.HALO_BACKEND_URL && !isLocalHost(host) && !isCodespacesHost(host)) {
    window.HALO_BACKEND_URL = DEFAULT_REMOTE_BACKEND_URL;
    window.HALO_API_BASE_URL = DEFAULT_REMOTE_BACKEND_URL;
  }

  window.getHaloApiBaseUrl = getHaloApiBaseUrl;
})();
