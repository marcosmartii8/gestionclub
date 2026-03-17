-- Script para agregar clave foránea en formularios referenciando username de usuarios
-- Ejecutar en Supabase SQL Editor

ALTER TABLE formularios
ADD CONSTRAINT fk_formularios_username
FOREIGN KEY (username)
REFERENCES users(username)
ON DELETE CASCADE
ON UPDATE CASCADE;
