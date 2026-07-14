(function() {
  var authTimers = {
    warning: null,
    expiry: null
  };
  var TOAST_MESSAGE_KEY = 'authToastMessage';
  var TOAST_TYPE_KEY = 'authToastType';
  var TOAST_CONTAINER_ID = 'auth-toast-container';
  var MAX_VISIBLE_TOASTS = 3;
  var toastCounter = 0;
  var toastStack = [];
  var isEscapeListenerReady = false;

  function hashStringToHue(value) {
    var input = String(value || 'default');
    var hash = 0;
    for (var i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  }

  function getClubThemePalette() {
    var clubCode = localStorage.getItem('clubCode') || 'default';
    var hue = hashStringToHue(clubCode);
    return {
      info: 'hsl(' + hue + ', 65%, 30%)',
      success: 'hsl(' + hue + ', 62%, 26%)',
      error: 'hsl(' + ((hue + 335) % 360) + ', 72%, 34%)'
    };
  }

  function parseSessionUser() {
    var raw = localStorage.getItem('usuario');
    if (!raw) {
      return {};
    }

    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (_) {
      // Ignorar JSON corrupto y seguir con fallback vacio.
    }

    return {};
  }

  function decodeJwtPayload(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    var segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }

    try {
      var base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      var decoded = atob(base64);
      return JSON.parse(decoded);
    } catch (_) {
      return null;
    }
  }

  function getTokenExpiryMs(token) {
    var payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return null;
    }
    return payload.exp * 1000;
  }

  function clearSessionStorage() {
    clearAuthTimers();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('clubCode');
    localStorage.removeItem('usuario');
    localStorage.removeItem('tokenExpiresAt');
    sessionStorage.removeItem('authWarnedExp');
  }

  function isLoginPage() {
    var path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
    return path.indexOf('nueva_interfaz_inicio_sesion.html') >= 0 || path.indexOf('inicio_sesion_otro.html') >= 0;
  }

  function isPublicLandingPage() {
    var path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
    return path.endsWith('/index.html') || path === '/' || path.endsWith('/registro.html');
  }

  function getCurrentPageName() {
    var path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
    var segments = path.split('/');
    return segments[segments.length - 1] || '';
  }

  function requiresAuthenticatedSession() {
    var page = getCurrentPageName();
    var protectedPages = {
      'interfaz_personalizada.html': true,
      'formularios.html': true,
      'ver_usuarios.html': true,
      'editar_perfil.html': true,
      'editar_perfilcopia.html': true,
      'visualizar_formularios.html': true,
      'hojas.html': true,
      'ver_gastos.html': true,
      'mi_perfil.html': true,
      'generar_hoja.html': true
    };

    return !!protectedPages[page];
  }

  function getRequiredRolesForCurrentPage() {
    var page = getCurrentPageName();
    var rolesByPage = {
      'ver_usuarios.html': ['lider', 'administrador'],
      'visualizar_formularios.html': ['lider', 'administrador'],
      'hojas.html': ['lider'],
      'ver_gastos.html': ['lider', 'administrador'],
      'generar_hoja.html': ['lider']
    };

    return rolesByPage[page] || null;
  }

  function getCurrentSessionRole() {
    var sessionUser = parseSessionUser();
    var role = localStorage.getItem('role') || sessionUser.role || '';
    return String(role).toLowerCase().trim();
  }

  function getCurrentSessionUsername() {
    var sessionUser = parseSessionUser();
    var username = localStorage.getItem('username') || sessionUser.username || '';
    return String(username).trim();
  }

  function clearAuthTimers() {
    if (authTimers.warning) {
      clearTimeout(authTimers.warning);
      authTimers.warning = null;
    }
    if (authTimers.expiry) {
      clearTimeout(authTimers.expiry);
      authTimers.expiry = null;
    }
  }

  function getToastBackground(type) {
    var palette = getClubThemePalette();

    if (type === 'error') {
      return palette.error;
    }
    if (type === 'success') {
      return palette.success;
    }
    return palette.info;
  }

  function getToastMeta(type) {
    if (type === 'error') {
      return { badge: 'ERROR', icon: '!', border: '#ffffff', ariaRole: 'alert', ariaLive: 'assertive' };
    }
    if (type === 'success') {
      return { badge: 'OK', icon: '+', border: '#ffffff', ariaRole: 'status', ariaLive: 'polite' };
    }
    return { badge: 'INFO', icon: 'i', border: '#ffffff', ariaRole: 'status', ariaLive: 'polite' };
  }

  function safeFocus(element) {
    if (!element || typeof element.focus !== 'function') {
      return;
    }

    try {
      element.focus({ preventScroll: true });
    } catch (_) {
      element.focus();
    }
  }

  function ensureToastContainer() {
    var container = document.getElementById(TOAST_CONTAINER_ID);
    if (container) {
      return container;
    }

    if (!document.body) {
      return null;
    }

    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.position = 'fixed';
    container.style.right = '18px';
    container.style.top = '18px';
    container.style.zIndex = '10000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.maxWidth = '360px';
    container.style.pointerEvents = 'none';

    document.body.appendChild(container);
    return container;
  }

  function initializeToastEscapeListener() {
    if (isEscapeListenerReady) {
      return;
    }

    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') {
        return;
      }

      if (toastStack.length === 0) {
        return;
      }

      var latestToast = toastStack[toastStack.length - 1];
      dismissToast(latestToast.id);
    });

    isEscapeListenerReady = true;
  }

  function dismissToast(toastId) {
    var targetIndex = -1;
    for (var i = 0; i < toastStack.length; i += 1) {
      if (toastStack[i].id === toastId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex < 0) {
      return;
    }

    var toastEntry = toastStack[targetIndex];
    var toast = toastEntry.element;

    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';

    if (toastEntry.timerId) {
      clearTimeout(toastEntry.timerId);
    }

    setTimeout(function() {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }

      toastStack = toastStack.filter(function(item) {
        return item.id !== toastId;
      });

      if (toastEntry.previousFocusElement && document.contains(toastEntry.previousFocusElement)) {
        safeFocus(toastEntry.previousFocusElement);
      }
    }, 200);
  }

  function showToast(message, options) {
    if (!message) {
      return;
    }

    var opts = options || {};
    var durationMs = typeof opts.durationMs === 'number' ? opts.durationMs : 3400;
    var type = opts.type || 'info';
    var meta = getToastMeta(type);
    var shouldFocusOnShow = opts.focusOnShow === true;
    var previousFocusElement = shouldFocusOnShow ? document.activeElement : null;

    var container = ensureToastContainer();
    if (!container) {
      return;
    }

    initializeToastEscapeListener();

    if (toastStack.length >= MAX_VISIBLE_TOASTS) {
      dismissToast(toastStack[0].id);
    }

    var toastId = 'auth-toast-' + (++toastCounter);

    var toast = document.createElement('div');
    toast.id = toastId;
    toast.innerHTML = '';
    toast.setAttribute('role', meta.ariaRole);
    toast.setAttribute('aria-live', meta.ariaLive);
    toast.setAttribute('aria-atomic', 'true');
    if (shouldFocusOnShow) {
      toast.setAttribute('tabindex', '-1');
      toast.style.outline = 'none';
    }
    toast.style.pointerEvents = 'auto';
    toast.style.width = '100%';
    toast.style.padding = '11px 14px';
    toast.style.borderRadius = '10px';
    toast.style.color = '#ffffff';
    toast.style.background = getToastBackground(type);
    toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.25)';
    toast.style.fontSize = '14px';
    toast.style.lineHeight = '1.35';
    toast.style.display = 'flex';
    toast.style.alignItems = 'flex-start';
    toast.style.gap = '10px';
    toast.style.borderLeft = '3px solid ' + meta.border;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';

    var icon = document.createElement('div');
    icon.textContent = meta.icon;
    icon.style.width = '18px';
    icon.style.height = '18px';
    icon.style.minWidth = '18px';
    icon.style.borderRadius = '50%';
    icon.style.border = '1px solid rgba(255, 255, 255, 0.8)';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.fontWeight = '700';
    icon.style.fontSize = '12px';
    icon.style.marginTop = '1px';

    var content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '2px';
    content.style.flex = '1';

    var badge = document.createElement('div');
    badge.textContent = meta.badge;
    badge.style.fontSize = '10px';
    badge.style.fontWeight = '700';
    badge.style.letterSpacing = '0.5px';
    badge.style.opacity = '0.9';

    var text = document.createElement('div');
    text.textContent = message;
    text.style.fontSize = '14px';
    text.style.fontWeight = '500';

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'x';
    closeButton.setAttribute('aria-label', 'Cerrar notificación');
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.color = '#ffffff';
    closeButton.style.fontSize = '16px';
    closeButton.style.fontWeight = '700';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0 0 0 6px';
    closeButton.style.lineHeight = '1';

    content.appendChild(badge);
    content.appendChild(text);
    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeButton);

    container.appendChild(toast);

    closeButton.addEventListener('click', function() {
      dismissToast(toastId);
    });

    var toastEntry = {
      id: toastId,
      element: toast,
      timerId: null,
      previousFocusElement: previousFocusElement
    };
    toastStack.push(toastEntry);

    if (shouldFocusOnShow && typeof closeButton.focus === 'function') {
      setTimeout(function() {
        safeFocus(closeButton);
      }, 0);
    }

    requestAnimationFrame(function() {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    toastEntry.timerId = setTimeout(function() {
      dismissToast(toastId);
    }, durationMs);
  }

  function queueToastForNextPage(message, type) {
    if (!message) {
      return;
    }
    sessionStorage.setItem(TOAST_MESSAGE_KEY, message);
    sessionStorage.setItem(TOAST_TYPE_KEY, type || 'info');
  }

  function consumeQueuedToast() {
    var message = sessionStorage.getItem(TOAST_MESSAGE_KEY);
    if (!message) {
      return;
    }

    var type = sessionStorage.getItem(TOAST_TYPE_KEY) || 'info';
    sessionStorage.removeItem(TOAST_MESSAGE_KEY);
    sessionStorage.removeItem(TOAST_TYPE_KEY);
    showToast(message, { type: type, focusOnShow: type === 'error' });
  }

  function redirectToLogin(message, loginPath) {
    var target = loginPath || 'nueva_interfaz_inicio_sesion.html';
    if (message) {
      queueToastForNextPage(message, 'error');
    }
    window.location.href = target;
  }

  function logout(options) {
    var opts = options || {};
    var loginPath = opts.loginPath || 'nueva_interfaz_inicio_sesion.html';
    var message = opts.message || '';

    clearSessionStorage();
    redirectToLogin(message, loginPath);
  }

  function ensureAuthenticatedRoute(options) {
    var opts = options || {};
    var loginPath = opts.loginPath || 'nueva_interfaz_inicio_sesion.html';

    if (!requiresAuthenticatedSession()) {
      return true;
    }

    var token = localStorage.getItem('accessToken') || '';
    if (!token) {
      logout({
        loginPath: loginPath,
        message: 'Debes iniciar sesión para acceder a esta sección.'
      });
      return false;
    }

    var expiryMs = getTokenExpiryMs(token);
    if (expiryMs && Date.now() >= expiryMs) {
      logout({
        loginPath: loginPath,
        message: 'Tu sesión ha expirado. Inicia sesión de nuevo.'
      });
      return false;
    }

    var requiredRoles = getRequiredRolesForCurrentPage();
    if (requiredRoles && requiredRoles.length > 0) {
      var currentRole = getCurrentSessionRole();
      var hasAllowedRole = requiredRoles.indexOf(currentRole) >= 0;

      if (!hasAllowedRole) {
        var username = getCurrentSessionUsername();
        queueToastForNextPage('No tienes permisos para acceder a esta sección.', 'error');

        if (username) {
          window.location.href = 'interfaz_personalizada.html?nombre=' + encodeURIComponent(username);
          return false;
        }

        logout({
          loginPath: loginPath,
          message: 'Debes iniciar sesión para acceder a esta sección.'
        });
        return false;
      }
    }

    return true;
  }

  function ensureGlobalLogoutButton() {
    if (isLoginPage() || isPublicLandingPage()) {
      return;
    }

    if (document.getElementById('logout-button') || document.getElementById('global-logout-button')) {
      return;
    }

    var hasSession = !!(localStorage.getItem('accessToken') || localStorage.getItem('usuario'));
    if (!hasSession) {
      return;
    }

    var button = document.createElement('button');
    button.id = 'global-logout-button';
    button.type = 'button';
    button.textContent = 'Cerrar sesión';
    button.style.position = 'fixed';
    button.style.right = '18px';
    button.style.bottom = '18px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 14px';
    button.style.border = 'none';
    button.style.borderRadius = '8px';
    button.style.cursor = 'pointer';
    button.style.background = '#c62828';
    button.style.color = '#ffffff';
    button.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.25)';

    button.addEventListener('click', function() {
      if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        logout({ loginPath: 'nueva_interfaz_inicio_sesion.html' });
      }
    });

    if (document.body) {
      document.body.appendChild(button);
    }
  }

  function initializeGlobalLogoutButton() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureGlobalLogoutButton, { once: true });
      return;
    }

    ensureGlobalLogoutButton();
  }

  function initializeTokenLifecycle(options) {
    var opts = options || {};
    var loginPath = opts.loginPath || 'nueva_interfaz_inicio_sesion.html';
    var warningLeadMs = typeof opts.warningLeadMs === 'number' ? opts.warningLeadMs : 2 * 60 * 1000;
    var accessToken = localStorage.getItem('accessToken') || '';

    clearAuthTimers();

    if (!accessToken || isLoginPage()) {
      return;
    }

    var expiryMs = getTokenExpiryMs(accessToken);
    if (!expiryMs) {
      return;
    }

    localStorage.setItem('tokenExpiresAt', String(expiryMs));

    var now = Date.now();
    var expiryInMs = expiryMs - now;

    if (expiryInMs <= 0) {
      clearSessionStorage();
      redirectToLogin('Tu sesión ha expirado. Inicia sesión de nuevo.', loginPath);
      return;
    }

    var warnedKey = 'authWarnedExp';
    var shouldWarnImmediately = expiryInMs <= warningLeadMs;
    var warnedForCurrentToken = sessionStorage.getItem(warnedKey) === String(expiryMs);

    if (shouldWarnImmediately && !warnedForCurrentToken) {
      sessionStorage.setItem(warnedKey, String(expiryMs));
      showToast('Tu sesión está a punto de expirar. Guarda tus cambios y vuelve a iniciar sesión.', { type: 'info', durationMs: 4200 });
    }

    if (!shouldWarnImmediately) {
      authTimers.warning = setTimeout(function() {
        var stillWarned = sessionStorage.getItem(warnedKey) === String(expiryMs);
        if (!stillWarned) {
          sessionStorage.setItem(warnedKey, String(expiryMs));
          showToast('Tu sesión expira en menos de 2 minutos. Guarda tus cambios.', { type: 'info', durationMs: 4200 });
        }
      }, expiryInMs - warningLeadMs);
    }

    authTimers.expiry = setTimeout(function() {
      clearSessionStorage();
      redirectToLogin('Tu sesión ha expirado. Inicia sesión de nuevo.', loginPath);
    }, expiryInMs);
  }

  function setSessionFromLogin(user, token) {
    var safeUser = user && typeof user === 'object' ? user : {};
    var clubCode = safeUser.clubcode || safeUser.clubCode || '';

    localStorage.setItem('usuario', JSON.stringify(safeUser));
    localStorage.setItem('username', safeUser.username || '');
    localStorage.setItem('role', safeUser.role || '');
    localStorage.setItem('clubCode', clubCode);

    if (token) {
      localStorage.setItem('accessToken', token);
      var expiryMs = getTokenExpiryMs(token);
      if (expiryMs) {
        localStorage.setItem('tokenExpiresAt', String(expiryMs));
      }
      sessionStorage.removeItem('authWarnedExp');
    }
  }

  function getAuthHeaders(options) {
    var opts = options || {};
    var extraHeaders = opts.extraHeaders || {};
    var sessionUser = parseSessionUser();
    var usernameHeader = localStorage.getItem('username') || sessionUser.username || opts.userHint || '';
    var roleHeader = (localStorage.getItem('role') || sessionUser.role || '').toLowerCase();
    var clubCodeHeader = localStorage.getItem('clubCode') || sessionUser.clubCode || '';
    var accessToken = localStorage.getItem('accessToken') || '';

    var authHeaders = {
      'x-user-name': usernameHeader,
      'x-user-role': roleHeader,
      'x-user-club': clubCodeHeader
    };

    if (accessToken) {
      authHeaders.Authorization = 'Bearer ' + accessToken;
    }

    return Object.assign({}, authHeaders, extraHeaders);
  }

  function handleAuthFailure(response, options) {
    if (!response) {
      return false;
    }

    if (response.status === 401 || response.status === 403) {
      var opts = options || {};
      var message = opts.message || 'Tu sesión no es válida o ha expirado. Inicia sesión de nuevo.';
      var loginPath = opts.loginPath || 'nueva_interfaz_inicio_sesion.html';
      clearSessionStorage();
      redirectToLogin(message, loginPath);
      return true;
    }

    return false;
  }

  async function authFetch(url, options) {
    var opts = options || {};
    var fetchOptions = Object.assign({}, opts.fetchOptions || {});
    fetchOptions.headers = getAuthHeaders({
      userHint: opts.userHint,
      extraHeaders: fetchOptions.headers || {}
    });

    var response = await fetch(url, fetchOptions);
    var handled = handleAuthFailure(response, {
      message: opts.authMessage,
      loginPath: opts.loginPath
    });

    return {
      response: response,
      authHandled: handled
    };
  }

  window.AuthUtils = {
    getAuthHeaders: getAuthHeaders,
    handleAuthFailure: handleAuthFailure,
    authFetch: authFetch,
    getTokenExpiryMs: getTokenExpiryMs,
    initializeTokenLifecycle: initializeTokenLifecycle,
    clearSessionStorage: clearSessionStorage,
    setSessionFromLogin: setSessionFromLogin,
    logout: logout,
    ensureGlobalLogoutButton: ensureGlobalLogoutButton,
    ensureAuthenticatedRoute: ensureAuthenticatedRoute,
    showToast: showToast
  };

  consumeQueuedToast();
  ensureAuthenticatedRoute();
  initializeTokenLifecycle();
  initializeGlobalLogoutButton();
})();
