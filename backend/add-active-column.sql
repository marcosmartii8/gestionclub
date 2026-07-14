-- Script para agregar columna 'active' a la tabla de usuarios
-- Ejecutar en Supabase SQL Editor

-- Agregar columna 'active' con valor por defecto true
ALTER TABLE users 
ADD COLUMN active BOOLEAN DEFAULT true;

-- Actualizar todos los usuarios existentes para que estén activos por defecto
UPDATE users 
SET active = true 
WHERE active IS NULL;

-- Verificar la actualización
SELECT username, active FROM users;
