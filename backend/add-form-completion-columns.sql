-- Añade estado de completado explícito al formulario mensual.
-- Permite distinguir borradores de formularios realmente entregados.

ALTER TABLE formularios
  ADD COLUMN IF NOT EXISTS completado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE formularios
  ADD COLUMN IF NOT EXISTS completado_at TIMESTAMPTZ;

ALTER TABLE formularios
  ADD COLUMN IF NOT EXISTS completado_by TEXT;
