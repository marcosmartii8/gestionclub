const params = new URLSearchParams(window.location.search);
const username = params.get('nombre');

if (!username) {
    alert('Error: Usuario no identificado.');
    window.location.href = 'inicio_app1.html';
}

const userData = JSON.parse(localStorage.getItem(username));

if (userData) {
    // Mensajes por club
    const welcomeMessage = document.getElementById('welcome-message');
    const clubMessage = document.getElementById('club-message');

    switch (userData.clubCode) {
        case '1337':
            welcomeMessage.textContent = "TAVERNES BLANQUES C.F.";
            clubMessage.textContent = "Panel de gestión para el club Tavernes Blanques.";
            break;
        case '1234':
            welcomeMessage.textContent = "ALBORAYA UD.";
            clubMessage.textContent = "Panel de gestión para el club Alboraya UD.";
            break;
        case '2828':
            welcomeMessage.textContent = "TORRENT C.F.";
            clubMessage.textContent = "Panel de gestión para el club Torrent CF.";
            break;
        case '2024':
            welcomeMessage.textContent = "TBCFFORMA";
            clubMessage.textContent = "Panel de gestión para el club TBCFFORMA";
            break;
        case '82801':
            welcomeMessage.textContent = "tuGestClub";
            clubMessage.textContent = "Panel de gestión para el club tuGestClub.";
            break;
        default:
            welcomeMessage.textContent = `Bienvenido, ${username}!`;
            clubMessage.textContent = "Panel de gestión personalizado.";
    }

    // Configuración de botones según rol
    const viewUsersButton = document.getElementById('view-users-button');
    const viewFormsButton = document.getElementById('view-forms-button');
    const formularioFinMesButton = document.getElementById('formulario-fin-mes-button');
    const hojasButton = document.getElementById('hojas-button');
    const verGastosButton = document.getElementById('ver-gastos-button');
    const gestionButton = document.getElementById('gestion-button');
    const perfilButton = document.getElementById('perfil-button');

    perfilButton.onclick = () => {
        window.location.href = `editar_perfil.html?nombre=${encodeURIComponent(username)}`;
    };

    if (['lider','administrador'].includes(userData.role)) {
        viewUsersButton.style.display = 'inline-block';
        viewFormsButton.style.display = 'inline-block';
        viewUsersButton.onclick = () => window.location.href = `ver_usuarios.html?nombre=${encodeURIComponent(username)}`;
        viewFormsButton.onclick = () => window.location.href = `visualizar_formularios.html?nombre=${encodeURIComponent(username)}`;
    }

    if (userData.role === 'administrador') {
        hojasButton.style.display = 'none';
        formularioFinMesButton.style.display = 'none';

    } else if (userData.role === 'voluntario') {
        hojasButton.style.display = 'none';
        formularioFinMesButton.style.display = 'inline-block';
    } else {
        hojasButton.style.display = 'inline-block';
        formularioFinMesButton.style.display = 'inline-block';
    }

    // Botón Hojas
    hojasButton.onclick = () => {
        window.location.href = `hojas.html?nombre=${encodeURIComponent(username)}`;
    };

    // Botón Formulario Fin de Mes
    formularioFinMesButton.onclick = () => {
        window.location.href = `formularios.html?nombre=${encodeURIComponent(username)}`;
    };

    verGastosButton.style.display = (userData.role === 'voluntario') ? 'none' : 'inline-block';
    verGastosButton.onclick = () => window.location.href = `ver_gastos.html?nombre=${encodeURIComponent(username)}`;

    // Botón Gestión solo para lider de 82801
    if (userData.role === 'lider' && userData.clubCode === '82801') {
        gestionButton.style.display = 'inline-block';
        gestionButton.onclick = validateLeaderPassword;
    } else {
        gestionButton.style.display = 'none';
    }
}

// Logout
document.getElementById('logout-button').onclick = () => {
    if (confirm("¿Estás seguro de que quieres cerrar sesión?")) {
        window.location.href = "inicio_app1.html";
    }
};

// Validación contraseña líder
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
    let failedAttempts = parseInt(localStorage.getItem('failedAttempts')) || 0;
    failedAttempts++;
    localStorage.setItem('failedAttempts', failedAttempts);
    if (failedAttempts >= 3) {
        alert("Has alcanzado el límite de intentos. Por favor, inténtalo más tarde.");
    } else {
        alert(`Intento fallido. Te quedan ${3 - failedAttempts} intentos.`);
    }
}
