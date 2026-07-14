-- Script para verificar que gastos_transporte está NULL en tabla formularios
-- y que los datos están en la tabla relacional

SELECT 
  f.id,
  f.username,
  f.year,
  f.month,
  f.gastos_transporte,
  COUNT(gt.id) as gastos_transporte_count
FROM formularios f
LEFT JOIN gastos_transporte gt ON f.id = gt.formulario_id
WHERE f.username = 'MarcosTBCF' AND f.year = 2026 AND f.month = 5
GROUP BY f.id, f.username, f.year, f.month, f.gastos_transporte
ORDER BY f.year DESC, f.month DESC;

-- Ver los gastos de transporte en la tabla relacional
SELECT 
  gt.id,
  gt.formulario_id,
  f.username,
  f.year,
  f.month,
  gt.fecha,
  gt.importe,
  gt.concepto,
  gt.archivo
FROM gastos_transporte gt
JOIN formularios f ON gt.formulario_id = f.id
WHERE f.username = 'MarcosTBCF' AND f.year = 2026 AND f.month = 5
ORDER BY gt.fecha;
