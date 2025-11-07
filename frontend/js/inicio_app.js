let failedAttempts = parseInt(localStorage.getItem('failedAttempts')) || 0;

function validateLeaderPassword() {
    const password = prompt("Introduce la contraseña para Líder:");
    if (password === "28012004Mmc") {
        const securityAnswer = prompt("¿Cuál es el nombre de tu club?");
        if (securityAnswer && securityAnswer.toLowerCase() === "tugestclub") {
            localStorage.setItem('failedAttempts', 0);
            window.location.href = "interfaz_lider.html";
        } else {
            handleFailedAttempt();
        }
    } else {
        handleFailedAttempt();
    }
}

function handleFailedAttempt() {
    failedAttempts++;
    localStorage.setItem('failedAttempts', failedAttempts);
    if (failedAttempts >= 3) {
        alert("Has alcanzado el límite de intentos. Por favor, inténtalo más tarde.");
    } else {
        alert(`Intento fallido. Te quedan ${3 - failedAttempts} intentos.`);
    }
}

// Cargar imagen de fondo guardada
const savedBackground = localStorage.getItem('backgroundImage');
if (savedBackground) {
    document.body.style.backgroundImage = `url('${savedBackground}')`;
}
