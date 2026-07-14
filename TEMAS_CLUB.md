# Sistema de Temas por Club

Este sistema permite personalizar el aspecto visual de la aplicación según el club del usuario. Los colores se almacenan en la base de datos Supabase y se cargan dinámicamente.

## Configuración en Supabase

Los colores de cada club se almacenan en la tabla `clubs` con los siguientes campos:

- **color_primary**: Color principal del gradiente de fondo (formato hex: #RRGGBB)
- **color_secondary**: Color secundario del gradiente de fondo (formato hex: #RRGGBB)
- **text_color**: Color del texto principal (formato hex: #RRGGBB)
- **accent_color**: Color de acentos para botones y elementos interactivos (formato hex: #RRGGBB)

## Cómo agregar colores a un club

### Opción 1: Desde SQL Editor en Supabase

```sql
UPDATE clubs SET 
    color_primary = '#FF5733',
    color_secondary = '#C70039',
    text_color = '#FFFFFF',
    accent_color = '#900C3F'
WHERE club_code = 'TU_CODIGO_CLUB';
```

### Opción 2: Desde la interfaz de Supabase

1. Ve a Table Editor
2. Selecciona la tabla `clubs`
3. Encuentra el club que deseas editar
4. Haz clic en la fila y edita los campos de colores:
   - `color_primary`
   - `color_secondary`
   - `text_color`
   - `accent_color`
5. Guarda los cambios

## Script SQL para agregar columnas

Si la tabla `clubs` no tiene estos campos, ejecuta:

```sql
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS color_primary VARCHAR(7) DEFAULT '#004d40',
ADD COLUMN IF NOT EXISTS color_secondary VARCHAR(7) DEFAULT '#1b5e20',
ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) DEFAULT '#f5f5f5',
ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#26a69a';
```

Archivo SQL completo disponible en: `backend/add-club-colors.sql`

## Ejemplos de configuración

### Club 82801 - Amarillo/Naranja
```sql
UPDATE clubs SET 
    color_primary = '#FFD700',
    color_secondary = '#FFA500',
    text_color = '#333333',
    accent_color = '#FFA500'
WHERE club_code = '82801';
```

### Club 1234 - Rosa claro
```sql
UPDATE clubs SET 
    color_primary = '#ffcccc',
    color_secondary = '#ff9999',
    text_color = '#333333',
    accent_color = '#ff6666'
WHERE club_code = '1234';
```

### Club 1337 - Azul claro
```sql
UPDATE clubs SET 
    color_primary = '#e3f2fd',
    color_secondary = '#90caf9',
    text_color = '#1565c0',
    accent_color = '#1976d2'
WHERE club_code = '1337';
```

### Club 2222 - Púrpura claro
```sql
UPDATE clubs SET 
    color_primary = '#f3e5f5',
    color_secondary = '#ce93d8',
    text_color = '#4a148c',
    accent_color = '#7b1fa2'
WHERE club_code = '2222';
```

## Colores por defecto

Si un club no tiene colores configurados, se usan estos valores por defecto:
- color_primary: `#004d40` (verde oscuro)
- color_secondary: `#1b5e20` (verde más oscuro)
- text_color: `#f5f5f5` (blanco/gris claro)
- accent_color: `#26a69a` (verde agua)

## Cómo funciona

1. Al cargar cualquier página de la aplicación, `club-themes.js` solicita los datos a `/api/clubs`
2. Construye dinámicamente los temas usando los colores de la base de datos
3. Aplica el tema correspondiente según el `clubCode` almacenado en localStorage
4. Si hay un error o el club no existe, usa el tema por defecto

## Ventajas de este sistema

✅ **Sin modificar código**: Los colores se cambian directamente en la base de datos
✅ **Cambios instantáneos**: Al recargar la página se ven los nuevos colores
✅ **Fácil gestión**: Se puede crear una interfaz de administración para que los líderes cambien sus colores
✅ **Escalable**: Agregar nuevos clubes es tan simple como insertar una fila en la tabla

## Páginas que usan este sistema

- Interfaz Personalizada
- Ver Usuarios
- Ver Gastos
- Visualizar Formularios
- Hojas
- Formularios

## Recursos útiles para elegir colores

- Generador de gradientes: https://cssgradient.io/
- Paletas de colores: https://coolors.co/
- Convertidor de colores: https://htmlcolorcodes.com/
- Material Design Colors: https://materialui.co/colors

## Formato de colores

Los colores deben estar en formato hexadecimal con 7 caracteres:
- ✅ Correcto: `#FF5733`
- ❌ Incorrecto: `#F53` (demasiado corto)
- ❌ Incorrecto: `FF5733` (falta el #)
- ❌ Incorrecto: `rgb(255,87,51)` (formato RGB no soportado)

## Solución de problemas

**Problema**: Los colores no se aplican
- Verifica que los valores en la base de datos estén en formato hexadecimal correcto
- Recarga completamente la página (Ctrl+F5)
- Verifica que el servidor backend esté ejecutándose
- Revisa la consola del navegador para ver errores

**Problema**: Aparece el tema por defecto en lugar del personalizado
- Verifica que el `club_code` del usuario coincida con el de la tabla clubs
- Asegúrate de que la tabla clubs tenga las columnas de colores
- Ejecuta el script `backend/add-club-colors.sql` si faltan las columnas
