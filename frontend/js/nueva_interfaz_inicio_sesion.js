function handleLogin(event) {
    event.preventDefault(); // Evitar envío del formulario

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const userData = JSON.parse(localStorage.getItem(username)); // Obtener datos desde localStorage

    if (userData && userData.password === password) {
        alert("Inicio de sesión exitoso.");
        window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(userData.username)}`;
    } else {
        alert("Nombre de usuario o contraseña incorrectos. Por favor, inténtalo de nuevo.");
    }
}
