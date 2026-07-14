-- Script para migrar gastos_transporte de JSON a tabla relacional
-- Ejecutar después de aplicar los cambios de estructura

-- Migrar gastos_transporte existentes desde la columna JSON a la tabla gastos_transporte
INSERT INTO gastos_transporte (formulario_id, fecha, importe, concepto, archivo, created_at)
SELECT 
  f.id,
  (g->>'date')::DATE as fecha,
  (g->>'amount')::NUMERIC as importe,
  g->>'concept' as concepto,
  g->>'fileUrl' as archivo,
  NOW() as created_at
FROM formularios f,
LATERAL jsonb_array_elements(f.gastos_transporte::jsonb) as g
WHERE f.gastos_transporte IS NOT NULL 
  AND f.gastos_transporte::jsonb IS NOT NULL
  AND jsonb_array_length(f.gastos_transporte::jsonb) > 0
ON CONFLICT DO NOTHING;

-- Verificar que la migración se completó correctamente
SELECT COUNT(*) as total_gastos_transporte_migrados FROM gastos_transporte;
