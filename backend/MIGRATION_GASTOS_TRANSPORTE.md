# Migración de Gastos de Transporte - Instrucciones

Este documento describe cómo migrar la tabla de gastos_transporte de JSON a una estructura relacional.

## Paso 1: Actualizar la Estructura de la Base de Datos

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Copia y ejecuta el contenido del archivo: `add-gastos-transporte-fk.sql`

Este script establece la relación de clave foránea en `gastos_transporte`.

## Paso 2: Migrar Datos Existentes

1. En **Supabase SQL Editor**, ejecuta el contenido de: `migrate-gastos-transporte-data.sql`

Este script:
- Convierte cada gasto de transporte JSON de cada formulario en un registro individual
- Mapea los campos correctamente:
  - `date` (JSON) → `fecha` (tabla)
  - `concept` (JSON) → `concepto` (tabla)
  - `amount` (JSON) → `importe` (tabla)
  - `fileUrl` (JSON) → `archivo` (tabla)

## Paso 3: Verificar que el Backend está Actualizado

El servidor (`server-supabase.js`) ha sido modificado para:
- **POST /api/formularios**: Ahora guarda gastos_transporte en ambos lados (tabla relacional Y JSON en formularios)
- **GET /api/formularios/:username**: Obtiene gastos_transporte desde la tabla `gastos_transporte`
- **GET /api/formularios**: Obtiene gastos_transporte desde la tabla `gastos_transporte`

## Paso 4: Reiniciar el Servidor

```bash
node src/server-supabase.js
```

## Estructura de Gastos de Transporte Ahora

Cada gasto de transporte se guarda como un registro independiente:

```
Tabla: gastos_transporte
- id (int8, PK)
- formulario_id (int, FK → formularios.id)
- fecha (date)
- importe (numeric)
- concepto (text)
- archivo (text)
- created_at (timestamp)
```

## Ventajas de esta Estructura

✅ **Integridad referencial**: Los gastos están vinculados correctamente a cada formulario
✅ **Búsquedas más rápidas**: Puedes hacer queries por concepto, rango de fechas, etc.
✅ **Mantenimiento más fácil**: Agregar/eliminar gastos es más simple
✅ **Reportes más eficientes**: Puedes hacer aggregations (total por mes, etc.)

## Prueba del Cambio

1. Abre la aplicación en el navegador
2. Ve a **Formularios**
3. Edita un formulario existente o crea uno nuevo
4. Agrega gastos de transporte
5. Guarda el formulario
6. Verifica que los gastos aparezcan correctamente

Si todo funciona, ¡la migración está completa! ✅
