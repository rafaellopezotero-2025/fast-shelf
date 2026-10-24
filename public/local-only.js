// Loaded only by the local installation. No fallback to a hosted service.
(function () {
  function isLocal(value) {
    const url = new URL(value, window.location.href);
    const host = url.hostname;
    return url.origin === window.location.origin || host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      || /^10\.(\d{1,3}\.){2}\d{1,3}$/.test(host)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    if (!isLocal(url)) return Promise.reject(new Error('La instalación local no permite conexiones a internet.'));
    return originalFetch(input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (!isLocal(url)) throw new Error('La instalación local no permite conexiones a internet.');
    return open.call(this, method, url, ...args);
  };
})();