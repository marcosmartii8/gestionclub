# Deploy: Railway (backend) + Vercel (frontend)

Esta app funciona mejor con este orden:
1. Subir backend a Railway.
2. Copiar URL publica de Railway.
3. Subir frontend a Vercel y hacer proxy de /api hacia Railway.

## 1) Railway: backend

Proyecto en Railway:
- New Project -> Deploy from GitHub repo.
- Root Directory: backend

Build/Start:
- Build Command: npm install
- Start Command: npm start

Variables de entorno minimas en Railway:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY (o SUPABASE_ANON_KEY si aplica)
- JWT_SECRET
- JWT_EXPIRES_IN=12h
- AUTHZ_ENFORCE=true
- AUTH_ALLOW_LEGACY_HEADERS=false
- CORS_ALLOWED_ORIGINS=https://TU_PROYECTO.vercel.app

Nota CORS:
- Cuando tengas dominio propio en Vercel, agrega tambien ese dominio en CORS_ALLOWED_ORIGINS, separado por comas.

Verificacion backend:
- Abre: https://TU_BACKEND.up.railway.app/api/clubs
- Debe devolver JSON.

## 2) Vercel: frontend

Proyecto en Vercel:
- Import Git Repository.
- Root Directory: tugestclub/tuGestor/gestionclub
- Framework Preset: Other

El archivo vercel.json ya usa:
- outputDirectory: frontend

Despues de tener la URL del backend Railway, agrega en vercel.json una regla rewrite:

{
  "buildCommand": "",
  "outputDirectory": "frontend",
  "installCommand": "",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://TU_BACKEND.up.railway.app/api/$1"
    }
  ]
}

Con eso, todas las llamadas fetch('/api/...') del frontend irán al backend en Railway.

## 3) Checklist rapido

- Railway responde /api/clubs.
- Vercel tiene rewrite /api/(.*) -> Railway.
- CORS_ALLOWED_ORIGINS incluye dominio de Vercel.
- Login funciona en Vercel.

## 4) Problemas comunes

401 o 403 al entrar:
- Revisar JWT_SECRET y AUTHZ_ENFORCE.
- Iniciar sesion otra vez para regenerar token.

Error CORS en navegador:
- Revisar CORS_ALLOWED_ORIGINS en Railway.
- Debe incluir exactamente el dominio que aparece en la barra del navegador.

404 en /api/... desde Vercel:
- Falta rewrite en vercel.json o URL destino incorrecta.

Si quieres, te dejo tambien el vercel.json ya actualizado cuando me pases la URL final de Railway.
