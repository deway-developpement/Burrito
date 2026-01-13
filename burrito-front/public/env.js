(function () {
  var host = window.location.hostname;
  var apiBase =
    host === 'localhost' || host === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://api.burrito.deway.fr';

  window.__env = Object.assign({}, window.__env, { API_BASE_URL: apiBase });
})();
