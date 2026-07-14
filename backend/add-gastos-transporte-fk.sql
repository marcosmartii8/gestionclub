-- Script para agregar foreign key a gastos_transporte
-- Ejecutar en Supabase SQL Editor

-- Agregar foreign key a gastos_transporte (si no existe)
ALTER TABLE gastos_transporte
DROP CONSTRAINT IF EXISTS fk_gastos_transporte_formulario;

-- Agregar la nueva foreign key
ALTER TABLE gastos_transporte
ADD CONSTRAINT fk_gastos_transporte_formulario_id
FOREIGN KEY (formulario_id)
REFERENCES formularios(id)
ON DELETE CASCADE
ON UPDATE CASCADE;
