document.getElementById('login-form')?.addEventListener('submit', async function(event) {
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
        const data = await res.json();
        if (res.ok && data.user) {
            const user = data.user;
            const clubCode = user.clubcode || user.clubCode || '';
            localStorage.setItem('clubCode', clubCode);
            localStorage.setItem(user.username, JSON.stringify(user));
            alert('Inicio de sesión exitoso.');
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(user.username)}`;
            return;
        } else {
            if (res.status === 401) {
                alert('Nombre de usuario o contraseña incorrectos.');
                return;
            }
            throw new Error(data.error || 'Login API error');
        }
    } catch (err) {
        // Fallback: comprobar localStorage legacy
        const userData = JSON.parse(localStorage.getItem(username));
        if (userData && userData.password === password) {
            localStorage.setItem('clubCode', userData.clubCode || userData.clubcode || '');
            alert('Inicio de sesión (fallback) exitoso.');
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(userData.username || username)}`;
            return;
        }
        alert('No se pudo iniciar sesión: ' + (err.message || 'Error de conexión.'));
    }
});
