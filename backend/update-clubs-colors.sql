-- Configurar colores para los clubes específicos
-- Ejecutar en Supabase SQL Editor

-- Tavernes Blanques - Verde como inicio_app1
UPDATE clubs SET 
    color_primary = '#004d40',
    color_secondary = '#1b5e20',
    text_color = '#f5f5f5',
    accent_color = '#26a69a'
WHERE club_name ILIKE '%Tavernes Blanques%' OR club_code = '1337';

-- Alboraya - Rojo degradado
UPDATE clubs SET 
    color_primary = '#d32f2f',
    color_secondary = '#b71c1c',
    text_color = '#ffffff',
    accent_color = '#ef5350'
WHERE club_name ILIKE '%Alboraya%' OR club_code = '1234';

-- tugestclub - Gris degradado
UPDATE clubs SET 
    color_primary = '#616161',
    color_secondary = '#424242',
    text_color = '#ffffff',
    accent_color = '#757575'
WHERE club_name ILIKE '%tugestclub%' OR club_code = '82801';

-- patatas fc - Amarillo degradado
UPDATE clubs SET 
    color_primary = '#FDD835',
    color_secondary = '#F9A825',
    text_color = '#1a1a1a',
    accent_color = '#FBC02D'
WHERE club_name ILIKE '%patatas%' OR club_code = '9999';

-- Verificar los cambios
SELECT club_code, club_name, color_primary, color_secondary, text_color, accent_color 
FROM clubs 
WHERE club_name ILIKE '%Tavernes%' 
   OR club_name ILIKE '%Alboraya%' 
   OR club_name ILIKE '%tugestclub%' 
   OR club_name ILIKE '%patatas%'
ORDER BY club_name;
