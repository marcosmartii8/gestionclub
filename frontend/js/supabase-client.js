// Inicializar Supabase
const SUPABASE_URL = 'https://ugfrdrtycslcrnyovjvw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZnJkcnR5Y3NsY3JueW92anZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODkxNDksImV4cCI6MjA4NTg2NTE0OX0.iyLzicI9xXbFGE1NezNjOkAvqoId6wF3ZGh4RK7FE_Q';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MONTH_NAMES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function normalizeFileNamePart(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

window.buildFormTicketBaseName = function buildFormTicketBaseName(ownerName, year, month, suffix = '') {
    const ownerPart = normalizeFileNamePart(ownerName) || 'usuario';
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    const monthPart = Number.isInteger(parsedMonth) && parsedMonth >= 0 && parsedMonth < MONTH_NAMES_ES.length
        ? MONTH_NAMES_ES[parsedMonth]
        : normalizeFileNamePart(month) || 'mes';
    const yearPart = Number.isFinite(parsedYear) && parsedYear > 0 ? String(parsedYear) : 'sin_anio';
    const suffixPart = normalizeFileNamePart(suffix);

    return [ownerPart, monthPart, yearPart, suffixPart].filter(Boolean).join('_');
};

window.buildFormTicketFolder = function buildFormTicketFolder(clubCode, ownerName, year, month, category) {
    const clubPart = normalizeFileNamePart(clubCode) || 'club_sin_codigo';
    const ownerPart = normalizeFileNamePart(ownerName) || 'usuario';
    const yearPart = Number.isFinite(Number(year)) ? String(year) : 'sin_anio';
    const monthPart = Number.isFinite(Number(month)) ? String(Number(month) + 1).padStart(2, '0') : 'sin_mes';
    const categoryPart = normalizeFileNamePart(category) || 'formularios';

    return ['clubs', clubPart, 'usuarios', ownerPart, yearPart, monthPart, categoryPart].join('/');
};

// Comprobación de conexión a Supabase al cargar
(async function checkSupabaseConnection() {
    try {
        // Intentar obtener la hora del servidor (tabla pública, puede ser cualquier consulta simple)
        const { error } = await supabaseClient.from('users').select('*').limit(1);
        if (error) {
            console.error('❌ Error de conexión a Supabase:', error.message);
            alert('No se pudo conectar a Supabase. Verifica tu conexión o configuración.');
        } else {
            console.log('✅ Conexión a Supabase exitosa');
        }
    } catch (err) {
        console.error('❌ Error inesperado al conectar a Supabase:', err);
        alert('No se pudo conectar a Supabase.');
    }
})();
// Función para subir archivo a Supabase Storage
window.uploadFileToSupabase = async function uploadFileToSupabase(file, folder = 'formularios', customBaseName = '', storageFolder = '') {
    if (!file) return null;

    try {
        // Validar tamaño (10 MB máximo)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('El archivo excede el tamaño máximo de 10 MB');
        }

        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y PDF');
        }

        const fileExtension = file.name.split('.').pop();
        const baseName = normalizeFileNamePart(customBaseName);
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const fileStem = baseName || `${timestamp}_${randomString}`;
        const fileName = `${fileStem}.${fileExtension}`;
        const filePath = `${storageFolder || folder}/${fileName}`;

        console.log('📤 Subiendo archivo:', fileName);

        // Subir archivo a Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('formularios-archivos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Error al subir archivo:', error);
            throw error;
        }

        // Obtener URL pública del archivo
        const { data: { publicUrl } } = supabaseClient.storage
            .from('formularios-archivos')
            .getPublicUrl(filePath);

        console.log('✅ Archivo subido exitosamente:', publicUrl);

        return {
            url: publicUrl,
            path: filePath,
            name: file.name,
            size: file.size,
            type: file.type
        };
    } catch (error) {
        console.error('Error en uploadFileToSupabase:', error);
        throw error;
    }
}
