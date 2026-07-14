-- Script para migrar desplazamientos de JSON a tabla relacional
-- Ejecutar después de aplicar los cambios de estructura

-- 1. Migrar desplazamientos existentes desde la columna JSON a la tabla desplazamientos
INSERT INTO desplazamientos (formulario_id, fecha, km, lugar, localidad, created_at)
SELECT 
  f.id,
  (d->>'date')::DATE as fecha,
  (d->>'km')::NUMERIC as km,
  d->>'place' as lugar,
  d->>'locality' as localidad,
  NOW() as created_at
FROM formularios f,
LATERAL jsonb_array_elements(f.desplazamientos::jsonb) as d
WHERE f.desplazamientos IS NOT NULL 
  AND f.desplazamientos::jsonb IS NOT NULL
  AND jsonb_array_length(f.desplazamientos::jsonb) > 0
ON CONFLICT DO NOTHING;

-- 2. Verificar que la migración se completó correctamente
SELECT COUNT(*) as total_desplazamientos_migrados FROM desplazamientos;

-- 3. Opcional: Ver algunos ejemplos de los datos migrados
-- SELECT d.*, f.username, f.year, f.month 
-- FROM desplazamientos d
-- JOIN formularios f ON d.formulario_id = f.id
-- LIMIT 10;
