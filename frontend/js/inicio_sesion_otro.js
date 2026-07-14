document.getElementById('login-form')?.addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Introduce usuario y contraseña.');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.error || 'Nombre de usuario o contraseña incorrectos.');
            return;
        }
        const result = await response.json();
        // Guardar datos de usuario en localStorage
        if (window.AuthUtils && typeof window.AuthUtils.setSessionFromLogin === 'function') {
            window.AuthUtils.setSessionFromLogin(result.user, result.token || '');
        } else {
            localStorage.setItem('usuario', JSON.stringify(result.user));
            localStorage.setItem('username', result.user.username || '');
            localStorage.setItem('role', result.user.role || '');
            localStorage.setItem('clubCode', result.user.clubCode || '');
            if (result.token) {
                localStorage.setItem('accessToken', result.token);
            }
        }
        alert('Inicio de sesión exitoso.');
        window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(result.user.username)}`;
    } catch (err) {
        console.error('Error en login:', err);
        alert('No se pudo iniciar sesión: ' + (err.message || 'Error de conexión.'));
    }
});
