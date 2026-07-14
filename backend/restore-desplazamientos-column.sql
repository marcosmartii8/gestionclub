-- Script para restaurar la columna desplazamientos en formularios
-- Ejecutar en Supabase SQL Editor

-- Agregar nuevamente la columna desplazamientos como JSONB
ALTER TABLE formularios
ADD COLUMN desplazamientos JSONB DEFAULT '[]'::JSONB;

-- Verificar que la columna fue creada correctamente
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'formularios' 
AND column_name = 'desplazamientos';
