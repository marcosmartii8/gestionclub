(function () {
  var localhostNames = {
    localhost: true,
    '127.0.0.1': true,
    '::1': true
  };
  var currentHostname = window.location && window.location.hostname ? window.location.hostname : '';
  var isLocalhost = !!localhostNames[currentHostname];
  var configuredBaseUrl = window.__TUGESTCLUB_API_BASE_URL__ || '';

  if (!configuredBaseUrl && !isLocalhost) {
    configuredBaseUrl = 'https://gestionclub-production-051e.up.railway.app';
  }

  window.__TUGESTCLUB_API_BASE_URL__ = configuredBaseUrl;

  if (isLocalhost || !configuredBaseUrl) {
    return;
  }

  var nativeFetch = window.fetch.bind(window);
  var normalizedBaseUrl = String(configuredBaseUrl).replace(/\/$/, '');

  function toAbsoluteUrl(input) {
    if (typeof input === 'string') {
      return input;
    }

    if (input && typeof input.url === 'string') {
      return input.url;
    }

    return '';
  }

  function rewriteApiUrl(input) {
    var urlValue = toAbsoluteUrl(input);
    if (!urlValue) {
      return input;
    }

    var resolvedUrl;
    try {
      resolvedUrl = new URL(urlValue, window.location.href);
    } catch (_) {
      return input;
    }

    if (resolvedUrl.pathname.indexOf('/api/') !== 0) {
      return input;
    }

    var rewritten = normalizedBaseUrl + resolvedUrl.pathname + resolvedUrl.search + resolvedUrl.hash;

    if (typeof input === 'string') {
      return rewritten;
    }

    try {
      return new Request(rewritten, input);
    } catch (_) {
      return rewritten;
    }
  }

  window.fetch = function (input, init) {
    return nativeFetch(rewriteApiUrl(input), init);
  };

  window.__TUGESTCLUB_API_REWRITE_ACTIVE__ = true;
})();
