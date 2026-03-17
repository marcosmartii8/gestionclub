# Guía para Arreglar Contraseñas Inseguras

## Problema Identificado

El sistema tenía contraseñas que no cumplían con los requisitos de seguridad:
- Contraseñas con menos de 8 caracteres
- Contraseñas duplicadas (varios usuarios con la misma contraseña)

## Solución Implementada

### 1. Validaciones en el Sistema

✅ **Backend** ([server.js](tugestclub/tuGestor/gestionclub/backend/src/server.js))
- Validación: mínimo 8 caracteres al crear/editar usuarios
- Verificación: la contraseña no puede estar en uso por otro usuario
- Mensajes de error claros

✅ **Frontend** 
- [registro.js](tugestclub/tuGestor/gestionclub/frontend/js/registro.js): Validación antes de enviar
- [ver_usuarios.js](tugestclub/tuGestor/gestionclub/frontend/js/ver_usuarios.js): Validación en edición
- HTML5 `minlength="8"` en los inputs
- Placeholders informativos

### 2. Script SQL para Arreglar Contraseñas Existentes

Archivo: `backend/fix-insecure-passwords.sql`

## Cómo Usar el Script

### Paso 1: Revisar contraseñas problemáticas

Ejecuta en Supabase SQL Editor para ver qué usuarios tienen problemas:

```sql
-- Ver contraseñas cortas
SELECT username, password, LENGTH(password) as longitud
FROM users
WHERE LENGTH(password) < 8
ORDER BY username;

-- Ver contraseñas duplicadas
SELECT password, COUNT(*) as cantidad_usuarios, 
       STRING_AGG(username, ', ') as usuarios_afectados
FROM users
GROUP BY password
HAVING COUNT(*) > 1
ORDER BY cantidad_usuarios DESC;
```

### Paso 2: Ejecutar el script completo

⚠️ **IMPORTANTE**: El script genera contraseñas aleatorias. Guarda la salida con las nuevas contraseñas.

1. Abre Supabase → SQL Editor
2. Copia todo el contenido de `backend/fix-insecure-passwords.sql`
3. Pégalo y ejecuta
4. **¡GUARDA LA SALIDA!** Verás mensajes como:
   ```
   Usuario: juanperez - Nueva contraseña: Kd8#mPq2xYh7
   Usuario: mariagomez - Nueva contraseña: Tn5@wLr9vBk3
   ```

### Paso 3: Comunicar las nuevas contraseñas

Informa a los usuarios afectados de sus nuevas contraseñas de forma segura:
- Email individual
- Mensaje privado
- **NUNCA** por canales públicos

### Paso 4: Verificar

Ejecuta esta consulta para confirmar que todo está correcto:

```sql
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN LENGTH(password) < 8 THEN 1 END) as contraseñas_cortas,
    COUNT(DISTINCT password) as contraseñas_unicas,
    COUNT(*) - COUNT(DISTINCT password) as contraseñas_duplicadas
FROM users;
```

Resultado esperado:
- `contraseñas_cortas`: 0
- `contraseñas_duplicadas`: 0

## Requisitos de Contraseña

📏 **Longitud**: Mínimo 8 caracteres
🔒 **Unicidad**: No puede estar en uso por otro usuario
✨ **Composición**: El sistema genera contraseñas con letras mayúsculas, minúsculas, números y símbolos

## Mensajes de Error

Los usuarios verán estos mensajes si intentan usar contraseñas inseguras:

- "La contraseña debe tener al menos 8 caracteres"
- "Esta contraseña ya está en uso. Por favor, elige otra diferente"

## Beneficios

✅ Mayor seguridad de las cuentas
✅ Prevención de accesos no autorizados
✅ Cumplimiento de mejores prácticas de seguridad
✅ Contraseñas únicas por usuario

## Mantenimiento Futuro

El sistema ahora previene automáticamente:
- Creación de usuarios con contraseñas cortas
- Uso de contraseñas duplicadas
- Edición hacia contraseñas inseguras

No necesitas ejecutar el script nuevamente a menos que:
- Importes usuarios de otra base de datos
- Detectes contraseñas problemáticas manualmente
