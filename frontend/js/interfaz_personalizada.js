const params = new URLSearchParams(window.location.search);
const username = params.get('nombre');

if (!username) {
    alert('Error: Usuario no identificado.');
    window.location.href = 'index.html';
}

const userData = JSON.parse(localStorage.getItem(username));

if (userData) {
    // Mensajes por club - Obtener nombre del club desde la base de datos
    const welcomeMessage = document.getElementById('welcome-message');
    const clubMessage = document.getElementById('club-message');

    // Función para cargar el nombre del club desde la API
    async function loadClubName() {
        try {
            const response = await fetch('/api/clubs/me', {
                headers: window.AuthUtils.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Error al cargar el club');

            const userClub = await response.json();
            const clubShield = document.getElementById('club-shield');
            const defaultLogo = document.querySelector('.logo-badge svg');

            if (userClub?.shield_url) {
                clubShield.src = userClub.shield_url;
                clubShield.style.display = 'block';

                if (defaultLogo) {
                    defaultLogo.style.display = 'none';
                }
            } else {
                clubShield.removeAttribute('src');
                clubShield.style.display = 'none';

                if (defaultLogo) {
                    defaultLogo.style.display = 'block';
                }
            }
            
            if (userClub) {
                welcomeMessage.textContent = userClub.club_name;
                clubMessage.textContent = `Panel de gestión para el club ${userClub.club_name}.`;
            } else {
                welcomeMessage.textContent = `Club ${userData.clubCode}`;
                clubMessage.textContent = `Panel de gestión para el club ${userData.clubCode}.`;
            }
        } catch (error) {
            console.error('Error al cargar el nombre del club:', error);
            welcomeMessage.textContent = `Club ${userData.clubCode}`;
            clubMessage.textContent = `Panel de gestión para el club ${userData.clubCode}.`;
        }
    }

    // Cargar el nombre del club
    loadClubName();

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

    // Mostrar botones según rol
    if (userData.role === 'voluntario') {
        // Solo mostrar Mi Perfil y Formulario Fin de Mes para voluntarios
        perfilButton.style.display = 'inline-block';
        formularioFinMesButton.style.display = 'inline-block';
        viewUsersButton.style.display = 'none';
        viewFormsButton.style.display = 'none';
        hojasButton.style.display = 'none';
        verGastosButton.style.display = 'none';
        gestionButton.style.display = 'none';
    } else if (['lider','administrador'].includes(userData.role)) {
        viewUsersButton.style.display = 'inline-block';
        viewFormsButton.style.display = 'inline-block';
        viewUsersButton.onclick = () => window.location.href = `ver_usuarios.html?nombre=${encodeURIComponent(username)}`;
        viewFormsButton.onclick = () => window.location.href = `visualizar_formularios.html?nombre=${encodeURIComponent(username)}`;
        
        if (userData.role === 'administrador') {
            hojasButton.style.display = 'none';
            formularioFinMesButton.style.display = 'none';
        } else {
            hojasButton.style.display = 'inline-block';
            formularioFinMesButton.style.display = 'inline-block';
        }
        
        verGastosButton.style.display = 'inline-block';
        verGastosButton.onclick = () => window.location.href = `ver_gastos.html?nombre=${encodeURIComponent(username)}`;
        
        // Botón Gestión solo para lider de 82801
        if (userData.role === 'lider' && userData.clubCode === '82801') {
            gestionButton.style.display = 'inline-block';
            gestionButton.onclick = () => {
                window.location.href = 'registro.html';
            };
        }
    }

    // Botón Hojas
    hojasButton.onclick = () => {
        window.location.href = `hojas.html?nombre=${encodeURIComponent(username)}`;
    };

    // Botón Formulario Fin de Mes
    formularioFinMesButton.onclick = () => {
        window.location.href = `formularios.html?nombre=${encodeURIComponent(username)}`;
    };
}

// Logout
document.getElementById('logout-button').onclick = () => {
    if (confirm("¿Estás seguro de que quieres cerrar sesión?")) {
        if (window.AuthUtils && typeof window.AuthUtils.logout === 'function') {
            window.AuthUtils.logout({ loginPath: 'nueva_interfaz_inicio_sesion.html' });
            return;
        }

        window.location.href = "nueva_interfaz_inicio_sesion.html";
    }
};
