const params = new URLSearchParams(window.location.search);
const username = params.get('nombre');

if (!username) {
    alert('Error: Usuario no identificado.');
    window.location.href = 'inicio_app1.html'; // Redirigir a la página principal
}

const userData = JSON.parse(localStorage.getItem(username));
if (userData) {
    document.getElementById('username').value = userData.username || '';
    document.getElementById('role').value = userData.role || '';
    document.getElementById('club-code').value = userData.clubCode || '';
} else {
    alert('Error: Datos del usuario no encontrados.');
    window.location.href = 'inicio_app1.html';
}

// Botón guardar
document.getElementById('save-btn').addEventListener('click', () => {
    const updatedUser = {
        username: document.getElementById('username').value,
        role: document.getElementById('role').value,
        clubCode: document.getElementById('club-code').value
    };
    localStorage.setItem(updatedUser.username, JSON.stringify(updatedUser));
    alert('Datos guardados correctamente.');
});

// Botón volver
document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
});
