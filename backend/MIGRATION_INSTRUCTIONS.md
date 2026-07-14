# Migración de Desplazamientos - Instrucciones

Este documento describe cómo migrar la tabla de desplazamientos de JSON a una estructura relacional.

## Paso 1: Actualizar la Estructura de la Base de Datos

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Copia y ejecuta el contenido del archivo: `add-desplazamientos-fk.sql`

Este script:
- Agrega una columna `id` a la tabla `formularios` como clave primaria
- Establece la relación de clave foránea en `desplazamientos`
- Elimina el campo `desplazamientos` JSON de `formularios`

⚠️ **IMPORTANTE**: Si aún hay desplazamientos activos en JSON que quieras conservar, ejecuta el siguiente paso ANTES de ejecutar este.

## Paso 2: Migrar Datos Existentes (Si hay datos antiguos)

1. En **Supabase SQL Editor**, ejecuta el contenido de: `migrate-desplazamientos-data.sql`

Este script:
- Convierte cada desplazamiento JSON de cada formulario en un registro individual en la tabla `desplazamientos`
- Mapea los campos correctamente:
  - `date` (JSON) → `fecha` (tabla)
  - `place` (JSON) → `lugar` (tabla)
  - `locality` (JSON) → `localidad` (tabla)
  - `km` (JSON) → `km` (tabla)

## Paso 3: Verificar que el Backend está Actualizado

El servidor (`server-supabase.js`) ha sido modificado para:
- **POST /api/formularios**: Ahora guarda desplazamientos como registros individuales en `desplazamientos`
- **GET /api/formularios/:username**: Obtiene desplazamientos desde la tabla `desplazamientos`
- **GET /api/formularios**: Obtiene desplazamientos desde la tabla `desplazamientos`

## Paso 4: Reiniciar el Servidor

```bash
npm restart
# O manualmente
npm stop
npm start
```

## Estructura de los Desplazamientos Ahora

Cada desplazamiento se guarda como un registro independiente:

```
Tabla: desplazamientos
- id (int8, PK)
- formulario_id (int, FK → formularios.id)
- fecha (date)
- km (numeric)
- lugar (text)
- localidad (text)
- created_at (timestamp)
```

## Ventajas de esta Estructura

✅ **Integridad referencial**: Los desplazamientos están vinculados correctamente a cada formulario
✅ **Búsquedas más rápidas**: Puedes hacer queries por campos específicos
✅ **Mantenimiento más fácil**: Agregar/eliminar desplazamientos es más simple
✅ **Reportes más eficientes**: Puedes hacer aggregations y estadísticas fácilmente

## Rollback (Si necesitas volver atrás)

Si necesitas revertir a JSON (no recomendado), ejecuta:

```sql
ALTER TABLE formularios
ADD COLUMN desplazamientos JSONB DEFAULT '[]'::JSONB;

-- Luego restaura los datos manualmente
```

## Prueba del Cambio

1. Abre la aplicación en el navegador
2. Ve a **Formularios**
3. Edita un formulario existente o crea uno nuevo
4. Agrega desplazamientos
5. Guarda el formulario
6. Verifica que los desplazamientos aparezcan correctamente

Si todo funciona, ¡la migración está completa! ✅
