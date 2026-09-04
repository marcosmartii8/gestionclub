# Deploy en Hostinger + Railway

Este es el despliegue recomendado para separar el proyecto en dos partes:
- Frontend estatico en Hostinger
- Backend Node.js en Railway
- Supabase como base de datos y almacenamiento

La app sigue funcionando en localhost porque el frontend solo reescribe las llamadas `/api/...` cuando detecta una URL de produccion.

## 1) Frontend en Hostinger

Sube todo el contenido de `frontend/` al subdominio que quieras usar, por ejemplo:
- `https://app.tudominio.com`

Asegurate de subir tambien:
- `frontend/js/deployment-config.js`

### Configuracion obligatoria del frontend

Edita `frontend/js/deployment-config.js` y reemplaza:
- `https://TU-BACKEND.up.railway.app`

por la URL publica real de tu backend en Railway.

Ese archivo hace que:
- en localhost, `fetch('/api/...')` siga funcionando igual
- en Hostinger, `fetch('/api/...')` vaya al backend de Railway

## 2) Backend en Railway

Crea un proyecto nuevo en Railway y conecta el repositorio.

### Root directory
- `backend`

### Build / Start
- Build Command: `npm install`
- Start Command: `npm start`

### Variables de entorno

Configura al menos estas variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=12h`
- `AUTHZ_ENFORCE=true`
- `AUTH_ALLOW_LEGACY_HEADERS=false`
- `CORS_ALLOWED_ORIGINS=https://app.tudominio.com,http://localhost:3000,http://127.0.0.1:3000`
- `TICKET_CLEANUP_ENABLED=true`
- `TICKET_CLEANUP_INTERVAL_MS=86400000`

Si vas a usar mas dominios, agregalos separados por comas.

## 3) Verificacion

- `https://app.tudominio.com` abre el frontend.
- `https://TU-BACKEND.up.railway.app/api/clubs` responde JSON.
- Login y pantallas protegidas funcionan desde el subdominio.
- `http://localhost:3000` sigue funcionando igual en desarrollo local.

## 4) Notas importantes

- No expongas `SUPABASE_SERVICE_KEY` en el frontend.
- Si cambias el subdominio de Hostinger, actualiza `CORS_ALLOWED_ORIGINS`.
- Si cambias la URL de Railway, actualiza `frontend/js/deployment-config.js`.

## Retención de tickets

Los tickets nuevos se organizan en Storage por club, usuario, año, mes y categoría.
La limpieza automática revisa una vez al día los tickets organizados con más de 12 meses,
elimina solo el archivo de Storage y conserva el formulario y los datos del gasto.

Los archivos antiguos, subidos antes de esta organización, no se eliminan automáticamente.
