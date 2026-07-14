// Cache de temas cargados desde la API
let clubThemes = {};
let themesLoaded = false;

// Tema por defecto
const defaultTheme = {
    background: 'linear-gradient(135deg, #004d40, #1b5e20)',
    textColor: '#f5f5f5',
    containerBg: 'rgba(255, 255, 255, 0.98)',
    accentColor: '#26a69a'
};

// Cargar temas desde la API de Supabase
async function loadClubThemes() {
    if (themesLoaded) return;
    
    try {
        const response = await fetch('/api/clubs');
        if (!response.ok) throw new Error('Error al cargar clubes');
        
        const clubs = await response.json();
        
        // Construir el objeto de temas desde los datos de la base de datos
        clubs.forEach(club => {
            const colorPrimary = club.color_primary || '#004d40';
            const colorSecondary = club.color_secondary || '#1b5e20';
            const textColor = club.text_color || '#f5f5f5';
            const accentColor = club.accent_color || '#26a69a';
            
            clubThemes[club.club_code] = {
                background: `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})`,
                textColor: textColor,
                containerBg: 'rgba(255, 255, 255, 0.95)',
                accentColor: accentColor
            };
        });
        
        themesLoaded = true;
        console.log('✅ Temas de clubes cargados:', Object.keys(clubThemes));
    } catch (error) {
        console.error('❌ Error al cargar temas de clubes:', error);
        // Usar tema por defecto en caso de error
    }
}

// Función para aplicar el tema según el código del club
async function applyClubTheme() {
    // Cargar temas si aún no se han cargado
    await loadClubThemes();
    
    const clubCode = localStorage.getItem('clubCode');
    const theme = clubThemes[clubCode] || defaultTheme;
    
    // Aplicar estilos al body
    document.body.style.background = theme.background;
    document.body.style.color = theme.textColor;
    
    // Crear o actualizar estilos dinámicos para containers y botones
    let styleElement = document.getElementById('club-theme-styles');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'club-theme-styles';
        document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
        .container {
            background: ${theme.containerBg} !important;
        }
        .button:hover,
        .filter-btn.active,
        .save-btn {
            background: linear-gradient(135deg, ${theme.accentColor}, ${darkenColor(theme.accentColor, 20)}) !important;
        }
    `;
}

// Función auxiliar para oscurecer un color
function darkenColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

// Aplicar tema automáticamente al cargar la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyClubTheme);
} else {
    applyClubTheme();
}
