// Inicializar Supabase
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

// Función para subir justificantes mediante el backend autenticado
window.uploadFileToSupabase = async function uploadFileToSupabase(
    file,
    username,
    year,
    month,
    category,
    customBaseName = ''
) {
    if (!file) return null;

    try {
        // Validar tamaño (10 MB máximo)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('El archivo excede el tamaño máximo de 10 MB');
        }

        // Validar tipo de archivo
        const validTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf'
        ];

        if (!validTypes.includes(file.type)) {
            throw new Error(
                'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP) y PDF'
            );
        }

        if (!username) {
            throw new Error('No se ha podido identificar al usuario del formulario');
        }

        if (!window.AuthUtils?.getAuthHeaders) {
            throw new Error('No se ha podido inicializar la autenticación');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('year', String(year));
        formData.append('month', String(month));
        formData.append('category', category);

        const baseName = normalizeFileNamePart(customBaseName);
        if (baseName) {
            formData.append('baseName', baseName);
        }

        console.log('📤 Subiendo justificante mediante el backend');

        const response = await fetch(
            `/api/formularios/${encodeURIComponent(username)}/archivo`,
            {
                method: 'POST',
                headers: window.AuthUtils.getAuthHeaders(),
                body: formData
            }
        );

        if (window.AuthUtils.handleAuthFailure?.(response)) {
            throw new Error('La sesión no es válida o ha expirado');
        }

        let result = null;

        try {
            result = await response.json();
        } catch {
            result = null;
        }

        if (!response.ok) {
            throw new Error(
                result?.message || 'Error al subir el archivo'
            );
        }

        console.log('✅ Justificante subido mediante el backend');

        return result;
    } catch (error) {
        console.error('Error en uploadFileToSupabase:', error);
        throw error;
    }
};
