// Inicializar Supabase
const SUPABASE_URL = 'https://ugfrdrtycslcrnyovjvw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZnJkcnR5Y3NsY3JueW92anZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyODkxNDksImV4cCI6MjA4NTg2NTE0OX0.iyLzicI9xXbFGE1NezNjOkAvqoId6wF3ZGh4RK7FE_Q';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
window.uploadFileToSupabase = async function uploadFileToSupabase(file, folder = 'formularios') {
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

        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.name.split('.').pop();
        const fileName = `${timestamp}_${randomString}.${fileExtension}`;
        const filePath = `${folder}/${fileName}`;

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
