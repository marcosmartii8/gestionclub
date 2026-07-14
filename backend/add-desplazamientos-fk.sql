-- Script para agregar columna id a formularios y vincular desplazamientos
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna id a formularios si no existe (comentado porque ya existe)
-- ALTER TABLE formularios
-- ADD COLUMN id BIGSERIAL PRIMARY KEY NOT NULL;

-- 2. Agregar foreign key a desplazamientos (si formulario_id aún no tiene una)
-- Primero eliminar la constraint anterior si existe
ALTER TABLE desplazamientos
DROP CONSTRAINT IF EXISTS fk_desplazamientos_formulario;

-- Agregar la nueva foreign key
ALTER TABLE desplazamientos
ADD CONSTRAINT fk_desplazamientos_formulario_id
FOREIGN KEY (formulario_id)
REFERENCES formularios(id)
ON DELETE CASCADE
ON UPDATE CASCADE;
