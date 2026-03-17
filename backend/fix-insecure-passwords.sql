-- Script para identificar y actualizar contraseñas inseguras
-- Ejecutar en Supabase SQL Editor

-- Paso 1: Ver contraseñas con menos de 8 caracteres
SELECT username, password, LENGTH(password) as longitud
FROM users
WHERE LENGTH(password) < 8
ORDER BY username;

-- Paso 2: Ver contraseñas duplicadas
SELECT password, COUNT(*) as cantidad_usuarios, 
       STRING_AGG(username, ', ') as usuarios_afectados
FROM users
GROUP BY password
HAVING COUNT(*) > 1
ORDER BY cantidad_usuarios DESC;

-- Paso 3: Función para generar contraseñas aleatorias seguras
CREATE OR REPLACE FUNCTION generate_secure_password(length INTEGER DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%&*';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, 1 + floor(random() * length(chars))::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Paso 4: Actualizar contraseñas que son demasiado cortas o duplicadas
-- IMPORTANTE: Ejecuta este bloque solo después de revisar los pasos anteriores

DO $$
DECLARE
    user_record RECORD;
    new_password TEXT;
    passwords_used TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Actualizar usuarios con contraseñas cortas o duplicadas
    FOR user_record IN 
        SELECT DISTINCT ON (u1.username) u1.username
        FROM users u1
        WHERE LENGTH(u1.password) < 8 
           OR u1.password IN (
               SELECT password 
               FROM users 
               GROUP BY password 
               HAVING COUNT(*) > 1
           )
        ORDER BY u1.username
    LOOP
        -- Generar contraseña única
        LOOP
            new_password := generate_secure_password(12);
            EXIT WHEN NOT (new_password = ANY(passwords_used));
        END LOOP;
        
        -- Guardar la contraseña usada
        passwords_used := array_append(passwords_used, new_password);
        
        -- Actualizar el usuario
        UPDATE users 
        SET password = new_password 
        WHERE username = user_record.username;
        
        RAISE NOTICE 'Usuario: % - Nueva contraseña: %', user_record.username, new_password;
    END LOOP;
    
    RAISE NOTICE 'Proceso completado. Total de contraseñas actualizadas: %', array_length(passwords_used, 1);
END $$;

-- Paso 5: Verificar que no haya contraseñas duplicadas ni cortas
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN LENGTH(password) < 8 THEN 1 END) as contraseñas_cortas,
    COUNT(DISTINCT password) as contraseñas_unicas,
    COUNT(*) - COUNT(DISTINCT password) as contraseñas_duplicadas
FROM users;

-- Paso 6: Ver todas las nuevas contraseñas (GUARDAR ESTA INFORMACIÓN)
SELECT username, password, LENGTH(password) as longitud
FROM users
ORDER BY username;
