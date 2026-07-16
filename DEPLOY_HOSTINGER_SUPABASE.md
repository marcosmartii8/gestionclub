# Deploy en Hostinger + Supabase

Este proyecto ya usa Supabase en backend, asi que solo hay que desplegar:
- Frontend en Hostinger
- Backend Node.js en Hostinger (VPS o servicio con Node)
- Base de datos en Supabase (ya existente)

## Arquitectura recomendada

- app.tudominio.com -> frontend estatico
- app.tudominio.com/api -> proxy al backend Node
- Supabase -> PostgreSQL + Storage

Con esto, el frontend puede seguir usando rutas relativas /api y no hay que reescribir todas las llamadas fetch.

## Opcion A (recomendada): Hostinger VPS

Usa un VPS para correr Node.js con PM2 y Nginx.

### 1) Subir backend

Ruta sugerida en servidor:
- /var/www/gestionclub/backend

Comandos:
- npm install
- npm run start

Mejor en produccion con PM2:
- npm install -g pm2
- pm2 start src/server.js --name gestionclub-api
- pm2 save
- pm2 startup

### 2) Variables de entorno backend

Configura en backend/.env:
- SUPABASE_URL=https://TU-PROYECTO.supabase.co
- SUPABASE_SERVICE_KEY=TU_SERVICE_ROLE_KEY
- JWT_SECRET=UN_SECRETO_LARGO_Y_UNICO
- JWT_EXPIRES_IN=12h
- AUTHZ_ENFORCE=true
- AUTH_ALLOW_LEGACY_HEADERS=false
- CORS_ALLOWED_ORIGINS=https://app.tudominio.com
- PORT=3000

Si tienes mas dominios, separalos por comas en CORS_ALLOWED_ORIGINS.

### 3) Nginx (frontend + proxy /api)

Ejemplo de bloque server:

server {
    listen 80;
    server_name app.tudominio.com;

    root /var/www/gestionclub/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

Luego:
- sudo nginx -t
- sudo systemctl reload nginx

### 4) HTTPS

Instala SSL con certbot para app.tudominio.com.

### 5) Verificacion

- https://app.tudominio.com debe abrir el frontend.
- https://app.tudominio.com/api/clubs debe responder JSON.
- Login y pantallas protegidas deben funcionar.

## Opcion B: Hosting compartido de Hostinger

Si tu plan NO permite Node.js persistente, no es buena opcion para este backend Express.
En ese caso:
- Frontend en Hostinger compartido
- Backend en otro host Node (Railway/Render/VPS)
- Configurar proxy de /api en Hostinger o usar subdominio api.tudominio.com

## Notas de Supabase

- No expongas SUPABASE_SERVICE_KEY en frontend.
- SERVICE_KEY solo en backend.
- Si usas Storage para archivos/escudos, valida politicas y bucket.

## Checklist rapido

- Backend vivo con PM2
- Nginx proxy /api activo
- CORS_ALLOWED_ORIGINS correcto
- JWT_SECRET definido
- HTTPS activo
- /api/clubs responde 200

