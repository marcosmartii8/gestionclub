document.addEventListener('DOMContentLoaded', async function() {
    const params = new URLSearchParams(window.location.search);
    const originalUsername = params.get('nombre');
    const referrer = params.get('referrer');
    const from = params.get('from'); // nuevo parámetro para detectar origen

    if (!originalUsername) {
        alert('Error: Usuario no identificado.');
        window.location.href = 'index.html';
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

    document.getElementById('profile-title').textContent = 'Mi perfil';
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

    // Botón atrás
    document.querySelector('.button-back').onclick = function() {
        console.log('🔙 Botón atrás presionado');
        console.log('📍 Parámetro from:', from);
        console.log('📍 Parámetro referrer:', referrer);
        
        // Obtener el username del líder (del parámetro nombre en la URL)
        const leaderUsername = params.get('lider') || originalUsername;
        
        // Si viene de ver_usuarios, volver ahí
        if (from === 'ver_usuarios') {
            console.log('✅ Redirigiendo a ver_usuarios.html');
            window.location.href = `ver_usuarios.html?nombre=${encodeURIComponent(leaderUsername)}`;
        }
        // Si tiene referrer específico (gestión o ver usuarios legacy)
        else if (referrer === 'gestion_usuarios') {
            console.log('✅ Redirigiendo a gestion_usuarios.html');
            window.location.href = 'gestion_usuarios.html';
        } else if (referrer === 'ver_usuarios') {
            console.log('✅ Redirigiendo a ver_usuarios.html (legacy)');
            window.location.href = `ver_usuarios.html?nombre=${encodeURIComponent(leaderUsername)}`;
        } 
        // Por defecto, volver a interfaz personalizada
        else {
            console.log('✅ Redirigiendo a interfaz_personalizada.html');
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(originalUsername)}`;
        }
    };
    // ==========================================
    // NOTIFICACIONES PUSH - ESTADO DEL NAVEGADOR
    // ==========================================

    async function comprobarEstadoNotificaciones() {
        const status = document.getElementById('notification-status');
        const activar = document.getElementById('enable-notifications');
        const desactivar = document.getElementById('disable-notifications');

        if (!status || !activar || !desactivar) return;

        activar.disabled = true;
        desactivar.disabled = true;
        desactivar.hidden = true;

        // Comprobar compatibilidad
        if (
            !('serviceWorker' in navigator) ||
            !('PushManager' in window) ||
            !('Notification' in window)
        ) {
            status.textContent =
                'Este navegador no admite notificaciones push. En iPhone, instala GestDeVol en la pantalla de inicio.';
            return;
        }

        // Comprobar permisos
        if (Notification.permission === 'denied') {
            status.textContent =
                'Las notificaciones están bloqueadas. Puedes cambiar el permiso desde los ajustes del navegador.';
            return;
        }

        if (Notification.permission === 'default') {
    status.textContent =
        'Las notificaciones están desactivadas. Todavía no has concedido permiso.';

    activar.disabled = false;
    return;
}

        // Comprobar si existe una suscripción push
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
    const respuesta = await fetch(
        `/api/push/subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`,
        {
            headers: getAuthHeaders()
        }
    );

    if (!respuesta.ok) {
        throw new Error(`Error consultando suscripción: HTTP ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    if (datos.subscribed) {
        status.textContent = '✅ Notificaciones activadas en este dispositivo.';
        activar.disabled = true;
        desactivar.hidden = false;
        desactivar.disabled = false;
    } else {
        status.textContent =
            'Este dispositivo todavía no está registrado en GestDeVol.';
        activar.disabled = false;
    }
} else {
    status.textContent =
        'Permiso concedido. Pulsa Activar notificaciones para registrar este dispositivo.';

    activar.disabled = false;
}
        } catch (error) {
            console.error('Error comprobando notificaciones:', error);
            status.textContent =
                'No se ha podido comprobar el estado de las notificaciones.';
        }
    }
        // Solicitar permiso al pulsar Activar notificaciones
    const botonActivar = document.getElementById('enable-notifications');

    if (botonActivar) {
        botonActivar.addEventListener('click', async () => {
            const status = document.getElementById('notification-status');

            botonActivar.disabled = true;

            try {
                const permiso = await Notification.requestPermission();

                if (permiso === 'granted') {
    status.textContent = 'Registrando dispositivo...';

    const respuestaClave = await fetch('/api/push/public-key');

    if (!respuestaClave.ok) {
        throw new Error('No se pudo obtener la clave VAPID');
    }

    const { publicKey } = await respuestaClave.json();

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertirClaveVapid(publicKey)
        });
    }

    const respuestaRegistro = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: getAuthHeaders({
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
            subscription: subscription.toJSON()
        })
    });

    if (!respuestaRegistro.ok) {
        throw new Error(
            `Error registrando dispositivo: HTTP ${respuestaRegistro.status}`
        );
    }

    status.textContent = 'Notificaciones activadas correctamente.';
} else if (permiso === 'denied') {
                    status.textContent =
                        'Has bloqueado las notificaciones. Puedes cambiarlo en los ajustes del navegador.';
                } else {
                    status.textContent =
                        'No has concedido permiso para recibir notificaciones.';
                }

                await comprobarEstadoNotificaciones();

            } catch (error) {
                console.error('Error solicitando permiso:', error);
                status.textContent =
                    'No se pudo solicitar el permiso de notificaciones.';
                botonActivar.disabled = false;
            }
        });
    }
        // Convertir la clave pública VAPID al formato que necesita el navegador
    function convertirClaveVapid(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);

        return Uint8Array.from(rawData, caracter => caracter.charCodeAt(0));
    }
    // Desactivar las notificaciones de este dispositivo
    const botonDesactivar = document.getElementById('disable-notifications');

    if (botonDesactivar) {
        botonDesactivar.addEventListener('click', async () => {
            const status = document.getElementById('notification-status');

            botonDesactivar.disabled = true;

            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();

                if (subscription) {
                    const respuesta = await fetch('/api/push/subscribe', {
                        method: 'DELETE',
                        headers: getAuthHeaders({
                            'Content-Type': 'application/json'
                        }),
                        body: JSON.stringify({
                            endpoint: subscription.endpoint
                        })
                    });

                    if (!respuesta.ok) {
                        throw new Error(`Error del servidor: HTTP ${respuesta.status}`);
                    }

                    const eliminada = await subscription.unsubscribe();

                    if (!eliminada) {
                        throw new Error('El navegador no pudo cancelar la suscripción');
                    }
                }

                status.textContent = 'Notificaciones desactivadas correctamente.';
                await comprobarEstadoNotificaciones();

            } catch (error) {
                console.error('Error desactivando notificaciones:', error);
                status.textContent =
                    'No se pudieron desactivar las notificaciones.';
                botonDesactivar.disabled = false;
            }
        });
    }

    comprobarEstadoNotificaciones();

});
