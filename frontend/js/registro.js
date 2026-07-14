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
    
    if (password.length < 8) {
        alert('La contraseña debe tener al menos 8 caracteres.');
        return;
    }
    
    if (password !== repeat) {
        alert('Las contraseñas no coinciden.');
        return;
    }

    try {
        const payload = {
            username,
            password,
            clubCode,
            role
        };
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.error || 'Error al registrar usuario.');
            return;
        }
        const result = await response.json();
        localStorage.setItem('usuario', JSON.stringify(result.user));
        alert('Registro completado.');
        window.location.href = 'interfaz_lider.html';
    } catch (err) {
        alert('Error en el registro: ' + (err.message || 'Error de conexión.'));
        window.location.href = 'interfaz_lider.html';
    }
}

window.handleRegistration = handleRegistration; // Si el HTML llama onsubmit="handleRegistration(event)"
