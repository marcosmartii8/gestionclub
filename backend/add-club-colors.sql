-- Agregar columnas de colores a la tabla clubs
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas de colores (si no existen)
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS color_primary VARCHAR(7) DEFAULT '#004d40',
ADD COLUMN IF NOT EXISTS color_secondary VARCHAR(7) DEFAULT '#1b5e20',
ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) DEFAULT '#f5f5f5',
ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#26a69a';

-- Actualizar los clubes existentes con sus colores personalizados
UPDATE clubs SET 
    color_primary = '#FFD700',
    color_secondary = '#FFA500',
    text_color = '#333333',
    accent_color = '#FFA500'
WHERE club_code = '82801';

UPDATE clubs SET 
    color_primary = '#ffcccc',
    color_secondary = '#ff9999',
    text_color = '#333333',
    accent_color = '#ff6666'
WHERE club_code = '1234';

UPDATE clubs SET 
    color_primary = '#e3f2fd',
    color_secondary = '#90caf9',
    text_color = '#1565c0',
    accent_color = '#1976d2'
WHERE club_code = '1337';

UPDATE clubs SET 
    color_primary = '#f3e5f5',
    color_secondary = '#ce93d8',
    text_color = '#4a148c',
    accent_color = '#7b1fa2'
WHERE club_code = '2222';

-- Verificar los cambios
SELECT club_code, club_name, color_primary, color_secondary, text_color, accent_color 
FROM clubs 
ORDER BY club_code;
