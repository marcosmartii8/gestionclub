document.addEventListener('DOMContentLoaded', async function() {
    const params = new URLSearchParams(window.location.search);
    const originalUsername = params.get('nombre');
    const referrer = params.get('referrer');

    if (!originalUsername) {
        alert('Error: Usuario no identificado.');
        window.location.href = 'inicio_app1.html';
        return;
    }

    let userData = {};

    function getAuthHeaders(extraHeaders = {}) {
        if (window.AuthUtils && typeof window.AuthUtils.getAuthHeaders === 'function') {
            return window.AuthUtils.getAuthHeaders({ userHint: originalUsername, extraHeaders });
        }

        return { ...extraHeaders };
    }

    // Intentar obtener usuario desde API
    try {
        const res = await fetch(`/api/users/${encodeURIComponent(originalUsername)}`, {
            headers: getAuthHeaders()
        });
        if (res.ok) {
            userData = await res.json();
            // sincronizar copia local con servidor
            try { localStorage.setItem(userData.username || originalUsername, JSON.stringify(userData)); } catch(e) {}
        } else {
            throw new Error('API user not found');
        }
    } catch (err) {
        // Fallback localStorage
        userData = JSON.parse(localStorage.getItem(originalUsername)) || {};
    }

    document.getElementById('profile-title').textContent = `Perfil: ${originalUsername}`;
    document.getElementById('username').value = userData.username || originalUsername || '';
    document.getElementById('full-name').value = userData.fullName || userData.fullname || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('dni').value = userData.dni || '';
    document.getElementById('address').value = userData.address || '';
    document.getElementById('phone').value = userData.phone || '';
    document.getElementById('km').value = userData.km || '';
    document.getElementById('club-code').value = userData.clubCode || userData.clubcode || '';
    document.getElementById('role').value = userData.role || '';

    if (referrer !== 'ver_usuarios') {
        document.getElementById('username').readOnly = true;
    }

    document.getElementById('save-btn').onclick = async function() {
        const newUsername = document.getElementById('username').value.trim();
        if (!newUsername) {
            alert('El nombre de usuario no puede estar vacío.');
            return;
        }
        if (newUsername !== originalUsername) {
            // Si cambia username, comprobar duplicados vía API o localStorage
            try {
                const check = await fetch(`/api/users/${encodeURIComponent(newUsername)}`, {
                    headers: getAuthHeaders()
                });
                if (check.ok) {
                    alert('El nuevo nombre de usuario ya existe en servidor.');
                    return;
                }
            } catch (e) {
                if (localStorage.getItem(newUsername)) {
                    alert('El nuevo nombre de usuario ya existe (fallback).');
                    return;
                }
            }
        }

        const payload = {
            username: newUsername,
            fullName: document.getElementById('full-name').value,
            email: document.getElementById('email').value,
            dni: document.getElementById('dni').value,
            address: document.getElementById('address').value,
            phone: document.getElementById('phone').value,
            km: document.getElementById('km').value,
            clubCode: document.getElementById('club-code').value,
            role: document.getElementById('role').value
        };

        // Intentar guardar via API
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(originalUsername)}`, {
                method: 'PUT',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                // actualizar localStorage por compatibilidad
                localStorage.setItem(newUsername, JSON.stringify(payload));
                if (newUsername !== originalUsername) localStorage.removeItem(originalUsername);
                // actualizar lista usuarios registrados
                let usuarios = JSON.parse(localStorage.getItem('usuarios_registrados') || '[]');
                const idx = usuarios.findIndex(u => u.username === originalUsername);
                if (idx !== -1) usuarios[idx] = payload;
                else usuarios.push(payload);
                localStorage.setItem('usuarios_registrados', JSON.stringify(usuarios));

                alert('Datos guardados correctamente.');
                // No redirigir, permanecer en la misma interfaz
                return;
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Error guardando en servidor');
            }
        } catch (err) {
            // Fallback: guardar en localStorage
            if (newUsername !== originalUsername) localStorage.removeItem(originalUsername);
            localStorage.setItem(newUsername, JSON.stringify(payload));
            let usuarios = JSON.parse(localStorage.getItem('usuarios_registrados') || '[]');
            const idx = usuarios.findIndex(u => u.username === originalUsername);
            if (idx !== -1) usuarios[idx] = payload;
            else usuarios.push(payload);
            localStorage.setItem('usuarios_registrados', JSON.stringify(usuarios));
            alert('Datos guardados correctamente (fallback).');
        }
    };

    // Botón atrás - siempre vuelve a ver_usuarios
    document.querySelector('.back-button').onclick = function() {
        window.location.href = 'ver_usuarios.html';
    };
});
