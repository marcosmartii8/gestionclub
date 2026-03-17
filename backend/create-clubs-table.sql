-- Crear tabla de clubes en Supabase
-- Este script debe ejecutarse en el SQL Editor de Supabase

-- Tabla clubs
CREATE TABLE IF NOT EXISTS clubs (
  club_code VARCHAR(50) PRIMARY KEY,
  club_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar los clubes existentes que encontramos en el código
INSERT INTO clubs (club_code, club_name) VALUES
  ('1234', 'Club 1234'),
  ('1337', 'Club 1337'),
  ('2222', 'Club 2222'),
  ('82801', 'Club 82801')
ON CONFLICT (club_code) DO NOTHING;

-- Verificar los datos insertados
SELECT * FROM clubs ORDER BY club_code;

-- (Opcional) Agregar foreign key en la tabla users para validar club_code
-- Descomentar si quieres validar que cada usuario tenga un club válido
-- ALTER TABLE users 
-- ADD CONSTRAINT fk_users_club 
-- FOREIGN KEY (club_code) 
-- REFERENCES clubs(club_code);
