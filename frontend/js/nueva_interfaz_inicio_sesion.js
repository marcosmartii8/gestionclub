async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Introduce usuario y contraseña.');
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Error de respuesta del servidor' }));
            const message = data.error || data.message || 'Error en el login';
            if (res.status === 401) {
                alert(message || 'Nombre de usuario o contraseña incorrectos.');
                return;
            }
            if (res.status === 403) {
                alert(message || 'Acceso denegado. Tu cuenta ha sido desactivada.');
                return;
            }
            alert('Error: ' + message);
            return;
        }
        
        const data = await res.json();
        if (data.user) {
            const user = data.user;
            if (window.AuthUtils && typeof window.AuthUtils.setSessionFromLogin === 'function') {
                window.AuthUtils.setSessionFromLogin(user, data.token || '');
            } else {
                const clubCode = user.clubcode || user.clubCode || '';
                localStorage.setItem('clubCode', clubCode);
                localStorage.setItem('username', user.username || '');
                localStorage.setItem('role', user.role || '');
                localStorage.setItem('usuario', JSON.stringify(user));
                if (data.token) {
                    localStorage.setItem('accessToken', data.token);
                }
            }
            localStorage.setItem(user.username, JSON.stringify(user));
            alert('Inicio de sesión exitoso.');
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(user.username)}`;
            return;
        }
    } catch (err) {
        console.error('Error en login:', err);
        alert('No se pudo iniciar sesión: ' + (err.message || 'Error de conexión.'));
    }
}

function sanitizeLoginUrl() {
    const params = new URLSearchParams(window.location.search);
    const hasCredentialParams = params.has('username') || params.has('password');

    if (!hasCredentialParams) {
        return;
    }

    const username = params.get('username');
    if (username && !document.getElementById('username').value) {
        document.getElementById('username').value = username;
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
}

function initLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) {
        return;
    }

    sanitizeLoginUrl();
    form.addEventListener('submit', handleLogin);
}

window.handleLogin = handleLogin;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginForm, { once: true });
} else {
    initLoginForm();
}
