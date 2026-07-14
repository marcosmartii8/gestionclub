-- Script de limpieza final: Eliminar la columna desplazamientos de formularios
-- Ejecutar en Supabase SQL Editor

-- 1. Limpiar todos los valores JSON de desplazamientos
UPDATE formularios SET desplazamientos = NULL;

-- 2. Eliminar la columna desplazamientos (ya no es necesaria)
ALTER TABLE formularios DROP COLUMN desplazamientos;

-- 3. Verificar que la tabla quedó limpia
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'formularios' 
ORDER BY ordinal_position;
