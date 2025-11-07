async function handleRegistration(event) {
    if (event) event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const repeat = document.getElementById('repeat-password').value;
    const clubCode = document.getElementById('club-code').value.trim();
    const role = document.getElementById('role').value;

    if (!username || !password) {
        alert('Usuario y contraseña son obligatorios.');
        return;
    }
    if (password !== repeat) {
        alert('Las contraseñas no coinciden.');
        return;
    }

    const payload = {
        username,
        password,
        clubCode,
        role,
        fullName: ''
    };

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert('Registro completado.');
            window.location.href = 'interfaz_lider.html';
            return;
        }
        const data = await res.json();
        alert('Error registro: ' + (data.error || res.statusText));
    } catch (err) {
        // Fallback: guardar en localStorage
        if (localStorage.getItem(username)) {
            alert('El usuario ya existe (fallback).');
            return;
        }
        localStorage.setItem(username, JSON.stringify(payload));
        const usuarios = JSON.parse(localStorage.getItem('usuarios_registrados') || '[]');
        usuarios.push(payload);
        localStorage.setItem('usuarios_registrados', JSON.stringify(usuarios));
        alert('Registrado (fallback) correctamente.');
        window.location.href = 'interfaz_lider.html';
    }
}

window.handleRegistration = handleRegistration; // Si el HTML llama onsubmit="handleRegistration(event)"
