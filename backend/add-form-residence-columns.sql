-- Añade snapshot de residencia mensual al formulario para conservar histórico
ALTER TABLE formularios
ADD COLUMN IF NOT EXISTS residence_address TEXT;

ALTER TABLE formularios
ADD COLUMN IF NOT EXISTS residence_km INTEGER;
