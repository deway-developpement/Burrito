(function () {
  const host = globalThis.location.hostname;
  const apiBase =
    host === 'localhost' || host === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://api.burrito.deway.fr';

  globalThis.__env = { ...globalThis.__env, API_BASE_URL: apiBase };
})();
