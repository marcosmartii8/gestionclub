import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import webpush from 'web-push';
import cron from 'node-cron';
import fs from 'fs';
import crypto from 'node:crypto';
import { ZipArchive } from 'archiver';
function generarTokenRevocacionPush() {
  return crypto.randomBytes(32).toString('hex');
}

function calcularHashTokenRevocacionPush(token) {
  return crypto.createHash('sha256')
    .update(token)
    .digest('hex');
}
dotenv.config();
// ==========================================
// CONFIGURACIÓN DE NOTIFICACIONES WEB PUSH
// ==========================================

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:marcosmarticordoba@gmail.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );

    console.log('✓ Web Push configurado correctamente');
} else {
    console.warn('⚠ Web Push no configurado: faltan claves VAPID');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Clave pública para suscripciones Web Push
app.get('/api/push/public-key', (req, res) => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(503).json({
            error: 'Las notificaciones no están configuradas'
        });
    }

    res.json({
        publicKey: VAPID_PUBLIC_KEY
    });
});
const ticketUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error('Tipo de archivo no permitido'));
    }

    callback(null, true);
  }
});
const clubShieldUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error('El escudo debe ser una imagen JPG, PNG o WebP'));
    }

    callback(null, true);
  }
});

const CLUB_ASSETS_BUCKET = 'club-assets';

function isValidClubShield(file) {
  if (!file?.buffer || !file?.mimetype) {
    return false;
  }

  const buffer = file.buffer;

  switch (file.mimetype) {
    case 'image/jpeg':
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case 'image/png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );

    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );

    default:
      return false;
  }
}
const TICKET_BUCKET = 'formularios-archivos';
function isValidTicketFile(file) {
  if (!file?.buffer || !file?.mimetype) {
    return false;
  }

  const buffer = file.buffer;

  switch (file.mimetype) {
    case 'application/pdf':
      return (
        buffer.length >= 5 &&
        buffer.subarray(0, 5).toString('ascii') === '%PDF-'
      );

    case 'image/jpeg':
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case 'image/png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );

    case 'image/gif':
      if (buffer.length < 6) return false;

      const gifHeader = buffer.subarray(0, 6).toString('ascii');
      return gifHeader === 'GIF87a' || gifHeader === 'GIF89a';

    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );

    default:
      return false;
  }
}
function getTicketStoragePath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return null;
  }

  try {
    const url = new URL(fileUrl);
    const supabaseOrigin = new URL(process.env.SUPABASE_URL).origin;

if (url.origin !== supabaseOrigin) {
  return null;
}
    const marker = `/storage/v1/object/public/${TICKET_BUCKET}/`;

    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const filePath = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length)
    );

    return filePath || null;
  } catch {
    return null;
  }
}
async function cleanupExpiredTicketFiles() {
  const madridDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const madridDate = Object.fromEntries(
    madridDateParts.map(({ type, value }) => [type, value])
  );

  const currentMadridDate = new Date(
    Date.UTC(
      Number(madridDate.year),
      Number(madridDate.month) - 1,
      Number(madridDate.day)
    )
  );

  // Los justificantes se conservan durante 3 meses naturales.
  currentMadridDate.setUTCMonth(currentMadridDate.getUTCMonth() - 3);

  const cutoff = [
    currentMadridDate.getUTCFullYear(),
    String(currentMadridDate.getUTCMonth() + 1).padStart(2, '0'),
    String(currentMadridDate.getUTCDate()).padStart(2, '0')
  ].join('-');

  console.log(`Comprobando justificantes anteriores a ${cutoff}...`);

  const tables = ['gastos_transporte', 'gastos_dietas'];

  for (const table of tables) {
    const { data: expiredExpenses, error: selectError } = await supabase
      .from(table)
      .select('id, archivo')
      .not('archivo', 'is', null)
      .lt('fecha', cutoff);

    if (selectError) {
      throw selectError;
    }

    for (const expense of expiredExpenses || []) {
      const storagePath = getTicketStoragePath(expense.archivo);

      // No tocamos la BD si no podemos identificar con seguridad
      // el archivo dentro de nuestro bucket.
      if (!storagePath) {
        console.error(
          `No se pudo identificar la ruta del justificante ${table} #${expense.id}`
        );
        continue;
      }

      const { error: storageError } = await supabase.storage
        .from(TICKET_BUCKET)
        .remove([storagePath]);

      if (storageError) {
        console.error(
          `No se pudo eliminar el justificante ${table} #${expense.id}:`,
          storageError
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from(table)
        .update({ archivo: null })
        .eq('id', expense.id);

      if (updateError) {
        console.error(
          `Archivo eliminado pero no se pudo limpiar la referencia ${table} #${expense.id}:`,
          updateError
        );
        continue;
      }

      console.log(`Justificante caducado eliminado: ${table} #${expense.id}`);
    }
  }
}
function normalizeStoragePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function getTicketExtension(file) {
  const extensionsByMime = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };

  return extensionsByMime[file.mimetype] || null;
}

const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://192.168.0.24:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Permitir requests sin Origin (curl, herramientas locales, mismo host servidor-servidor)
    if (!origin) return callback(null, true);

    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`❌ CORS bloqueado para origin no permitido: ${origin}`);

    const corsError = new Error('Origen no permitido por CORS');
    corsError.status = 403;
    return callback(corsError);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Cabeceras básicas de seguridad sin afectar compatibilidad actual.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Frontend static folder - INTELIGENTE: buscar en múltiples rutas
const possiblePaths = [
  '/app/frontend',
  '/frontend',
  path.join(process.cwd(), 'frontend'),
  path.join(__dirname, '../../frontend'),
];

let frontendPath = null;
console.log('🔍 Buscando carpeta frontend en posibles rutas...');
for (const testPath of possiblePaths) {
  const indexPath = path.join(testPath, 'index.html');
  console.log(`  → Probando: ${testPath} ... index.html exists: ${fs.existsSync(indexPath)}`);
  if (fs.existsSync(indexPath)) {
    frontendPath = testPath;
    console.log(`✅ ¡ENCONTRADO! Frontend en: ${frontendPath}`);
    break;
  }
}

if (frontendPath) {
  app.use(express.static(frontendPath, { index: false }));
  console.log('✅ Frontend servido exitosamente desde:', frontendPath);
} else {
  console.log('ℹ️ Frontend no encontrado en este contenedor. Ejecutando en modo API-only (esperado en Railway + Hostinger).');
  console.log('   Rutas probadas:', possiblePaths);
}

// Ruta raíz - servir index.html
app.get('/', (req, res) => {
  if (frontendPath) {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
  } else {
    res.status(200).json({
      status: 'ok',
      service: 'GestDeVol backend',
      frontend: 'not-configured'
    });
  }
});

app.get('/index.html', (req, res) => {
  if (frontendPath) {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
  } else {
    res.status(404).send('Frontend no encontrado en este entorno');
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Inicializar Supabase
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL es obligatorio para iniciar el servidor');
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY es obligatorio para iniciar el servidor');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BCRYPT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio para iniciar el servidor');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';


function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function mapUserForClient(user, includeActive = false) {
  const mapped = {
    username: user.username,
    clubCode: user.club_code,
    role: user.role,
    fullName: user.full_name || '',
    email: user.email || '',
    dni: user.dni || '',
    address: user.address || '',
    phone: user.phone || '',
    km: user.km ? user.km.toString() : '',
    leftAt: user.left_at || null
  };

  if (includeActive) {
    mapped.active = user.active !== false;
  }

  return mapped;
}

function buildUserSessionPayload(user) {
  return {
    username: user.username,
    role: user.role,
    clubCode: user.club_code,
    fullName: user.full_name,
    email: user.email,
    dni: user.dni,
    address: user.address,
    phone: user.phone,
    km: user.km ? user.km.toString() : ''
  };
}

function issueAccessToken(user) {
  return jwt.sign(
    {
      username: user.username,
      role: user.role,
      clubCode: user.club_code
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function getRequesterIdentity(req) {
  const authHeader = req.header('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return {
        username: payload.username || '',
        role: (payload.role || '').toLowerCase().trim(),
        clubCode: payload.clubCode || '',
        source: 'jwt'
      };
    } catch (error) {
      console.warn(`⚠️ JWT inválido o expirado en ${req.method} ${req.originalUrl}: ${error.message}`);
    }
  }
  return { username: '', role: '', clubCode: '', source: 'none' };
}
async function getCurrentRequester(req) {
  const requester = getRequesterIdentity(req);

  if (!requester.username) {
    return requester;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('username, role, club_code, active, left_at')
    .eq('username', requester.username)
    .maybeSingle();

  if (error) {
    throw error;
  }

if (!user) {
    return {
      username: '',
      role: '',
      clubCode: '',
      source: 'none'
    };
  }

  if (user.active !== true || user.left_at !== null) {
    return {
      username: '',
      role: '',
      clubCode: '',
      source: 'none'
    };
  }

  return {
    username: user.username,
    role: (user.role || '').toLowerCase().trim(),
    clubCode: user.club_code || '',
    source: requester.source
  };
}
function requireRole(roles) {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  return async (req, res, next) => {
    try {
      const requester = await getCurrentRequester(req);
      req.requester = requester;

      const hasAllowedRole =
        requester.role && normalizedRoles.includes(requester.role);

      if (hasAllowedRole) {
        return next();
      }

      console.warn(
        `Acceso sin rol autorizado detectado: ${req.method} ${req.originalUrl} ` +
        `role='${requester.role || 'none'}' user='${requester.username || 'unknown'}'`
      );

      return res.status(403).json({
        message: 'Acceso denegado por política de seguridad',
        requiredRoles: roles
      });
    } catch (error) {
      console.error('Error validando rol actual:', error);

      return res.status(500).json({
        message: 'Error validando la sesión'
      });
    }
  };
}

function isManagerRole(role) {
  const normalizedRole = (role || '').toLowerCase().trim();
  return normalizedRole === 'lider' || normalizedRole === 'administrador';
}
function isSuperadmin(requester) {
  return (
    requester?.username === 'superadmin' &&
    requester?.clubCode === 'SUPERADMIN' &&
    requester?.role === 'lider'
  );
}
async function requireSuperadmin(req, res, next) {
  try {
    const requester = req.requester || await getCurrentRequester(req);
    req.requester = requester;

    if (isSuperadmin(requester)) {
      return next();
    }

    return res.status(403).json({
      message: 'Acceso exclusivo para superadministrador'
    });
  } catch (error) {
    console.error('Error validando sesión de superadministrador:', error);

    return res.status(500).json({
      message: 'Error validando la sesión'
    });
  }
}

async function fetchUserClubCode(username) {
  const { data, error } = await supabase
    .from('users')
    .select('club_code')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data.club_code || null;
}

async function requireAuthenticated(req, res, next) {
  try {
    const requester = await getCurrentRequester(req);
    req.requester = requester;

    if (requester.username) {
      return next();
    }

    return res.status(401).json({ message: 'Autenticación requerida' });
  } catch (error) {
    console.error('Error validando sesión actual:', error);

    return res.status(500).json({
      message: 'Error validando la sesión'
    });
  }
}

function requireSelfOrRole(paramName, roles) {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  return (req, res, next) => {
    const requester = req.requester || getRequesterIdentity(req);
    req.requester = requester;

    const targetValue = req.params?.[paramName] || '';
    const isSelf = requester.username && targetValue && requester.username === targetValue;
    const hasRole = requester.role && normalizedRoles.includes(requester.role);

    if (isSelf || hasRole) {
      return next();
    }

    return res.status(403).json({
      message: 'Acceso denegado por política de seguridad',
      required: `self o rol (${roles.join(', ')})`
    });
  };
}
// ==========================================
// NOTIFICACIONES PUSH - DESACTIVAR DISPOSITIVO
// ==========================================
// Comprobar si la suscripción pertenece a la cuenta autenticada.
app.post('/api/push/check-owner', requireAuthenticated, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    const { username, clubCode } = req.requester;

    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      !endpoint.startsWith('https://')
    ) {
      return res.status(400).json({
        message: 'Endpoint no válido'
      });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('username, club_code')
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (error) throw error;

    return res.json({
      registered: Boolean(data),
      belongsToCurrentUser: Boolean(
        data &&
        data.username === username &&
        data.club_code === clubCode
      )
    });
  } catch (error) {
    console.error('Error comprobando propietario push:', error.message);
    return res.status(500).json({
      message: 'No se pudo comprobar la suscripción'
    });
  }
});
app.delete('/api/push/subscribe', requireAuthenticated, async (req, res) => {
  try {
    const { username, clubCode } = req.requester;
    const endpoint = req.body?.endpoint;

    if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 2048) {
      return res.status(400).json({
        message: 'Endpoint de suscripción no válido'
      });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('username', username)
      .eq('club_code', clubCode)
      .eq('endpoint', endpoint);

    if (error) {
      throw error;
    }

    return res.json({
      subscribed: false,
      message: 'Notificaciones desactivadas correctamente'
    });

  } catch (error) {
    console.error('Error desactivando notificaciones:', error.message);

    return res.status(500).json({
      message: 'No se pudieron desactivar las notificaciones'
    });
  }
});
// ==========================================
// NOTIFICACIONES PUSH - REGISTRAR DISPOSITIVO
// ==========================================
// Desvincular una suscripción push mediante su credencial de dispositivo.
app.post('/api/push/revoke-device', requireAuthenticated, async (req, res) => {
  try {
    const { endpoint, revokeToken } = req.body || {};

    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      !endpoint.startsWith('https://') ||
      typeof revokeToken !== 'string' ||
      !/^[a-f0-9]{64}$/.test(revokeToken)
    ) {
      return res.status(400).json({
        message: 'Datos de desvinculación no válidos'
      });
    }

    const tokenHash = calcularHashTokenRevocacionPush(revokeToken);

    const { data, error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('revoke_token_hash', tokenHash)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(403).json({
        message: 'No se ha podido verificar la credencial del dispositivo'
      });
    }

    return res.status(200).json({
      revoked: true,
      message: 'Dispositivo desvinculado correctamente'
    });

  } catch (error) {
    console.error('Error desvinculando dispositivo push:', error.message);

    return res.status(500).json({
      message: 'No se pudo desvincular el dispositivo'
    });
  }
});
app.post('/api/push/subscribe', requireAuthenticated, async (req, res) => {
  try {
    const { username, clubCode, role } = req.requester;
    const subscription = req.body?.subscription;
    const suppliedRevokeToken = req.body?.revokeToken;
    const isLegacySubscription = req.body?.legacyMigration === true;

    if (role !== 'voluntario') {
      return res.status(403).json({
        message: 'Las notificaciones están disponibles para voluntarios'
      });
    }

    if (!clubCode) {
      return res.status(400).json({
        message: 'El usuario no tiene un club asociado'
      });
    }

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      !endpoint.startsWith('https://') ||
      typeof p256dh !== 'string' ||
      !/^[A-Za-z0-9_-]{80,120}$/.test(p256dh) ||
      typeof auth !== 'string' ||
      !/^[A-Za-z0-9_-]{16,40}$/.test(auth)
    ) {
      return res.status(400).json({
        message: 'Suscripción push no válida'
      });
    }

    const { data: existing, error: lookupError } = await supabase
  .from('push_subscriptions')
  .select('username, club_code, revoke_token_hash, p256dh, auth')
  .eq('endpoint', endpoint)
  .maybeSingle();

if (lookupError) {
  throw lookupError;
}

if (
  existing &&
  (existing.username !== username || existing.club_code !== clubCode)
) {
  return res.status(409).json({
    message: 'Este dispositivo ya está asociado a otra cuenta'
  });

}
// Validar las claves de una suscripción antigua antes de migrarla.
if (existing && !existing.revoke_token_hash) {
  if (
    existing.p256dh !== p256dh ||
    existing.auth !== auth
  ) {
    return res.status(409).json({
      message: 'Las claves de la suscripción antigua no coinciden'
    });
  }
}
if (existing?.revoke_token_hash) {
  if (
    typeof suppliedRevokeToken !== 'string' ||
    suppliedRevokeToken.length !== 64 ||
    !/^[a-f0-9]{64}$/.test(suppliedRevokeToken) ||
    calcularHashTokenRevocacionPush(suppliedRevokeToken) !==
      existing.revoke_token_hash
  ) {
    return res.status(409).json({
      message: 'La suscripción ya está protegida. Es necesario volver a vincular el dispositivo.'
    });
  }
}
const revokeToken = existing?.revoke_token_hash
  ? null
  : generarTokenRevocacionPush();

const revokeTokenHash = revokeToken
  ? calcularHashTokenRevocacionPush(revokeToken)
  : existing?.revoke_token_hash;
const { data: registrado, error } = await supabase.rpc(
  'registrar_suscripcion_push',
  {
    p_username: username,
    p_club_code: clubCode,
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_revoke_token_hash: revokeTokenHash,
    p_existing_token_hash:
      typeof suppliedRevokeToken === 'string' &&
      /^[a-f0-9]{64}$/.test(suppliedRevokeToken)
        ? calcularHashTokenRevocacionPush(suppliedRevokeToken)
        : null
  }
);

if (error) {
  throw error;
}

if (registrado !== true) {
  return res.status(409).json({
    message: 'No se pudo verificar la propiedad de la suscripción push'
  });
}

    return res.status(200).json({
  subscribed: true,
  revokeToken,
  message: 'Notificaciones activadas correctamente'
});

  } catch (error) {
    console.error('Error registrando suscripción push:', error.message);

    return res.status(500).json({
      message: 'No se pudo registrar la suscripción'
    });
  }
});

// ==========================================
// NOTIFICACIONES PUSH - CONSULTAR SUSCRIPCIÓN
// ==========================================

app.get('/api/push/subscription', requireAuthenticated, async (req, res) => {
    try {
        const { username, clubCode } = req.requester;

        const endpoint = req.query.endpoint;

        if (typeof endpoint !== 'string' || !endpoint) {
            return res.status(400).json({
                message: 'Endpoint de suscripción requerido'
            });
        }

        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('username', username)
            .eq('club_code', clubCode)
            .eq('endpoint', endpoint)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return res.json({
            subscribed: Boolean(data)
        });

    } catch (error) {
        console.error('Error consultando suscripción push:', error);

        return res.status(500).json({
            message: 'Error consultando las notificaciones'
        });
    }
});

 // ==========================================
 // NOTIFICACIONES PUSH - ENVÍO DE PRUEBA LOCAL
 // ==========================================

app.post('/api/push/test', requireAuthenticated, async (req, res) => {
    try {
        // Esta ruta solo debe funcionar en desarrollo local
        if (process.env.NODE_ENV === 'production' ||
            !['localhost', '127.0.0.1'].includes(req.hostname)) {
            return res.status(404).json({
                message: 'Ruta no disponible'
            });
        }

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return res.status(503).json({
                message: 'Web Push no está configurado'
            });
        }

        const { username, clubCode } = req.requester;

        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('username', username)
            .eq('club_code', clubCode);

        if (error) {
            throw error;
        }

        if (!subscriptions?.length) {
            return res.status(404).json({
                message: 'No tienes dispositivos registrados'
            });
        }

        const payload = JSON.stringify({
  title: 'GestDeVol - Notificación de prueba',
  body: '¡Las notificaciones push funcionan correctamente!',
  url: '/interfaz_personalizada.html'
});

        let enviados = 0;
        let fallidos = 0;

        for (const item of subscriptions) {
            try {
                await webpush.sendNotification({
                    endpoint: item.endpoint,
                    keys: {
                        p256dh: item.p256dh,
                        auth: item.auth
                    }
                }, payload);

                enviados++;
            } catch (pushError) {
                fallidos++;

                // Eliminar suscripciones caducadas
                if ([404, 410].includes(pushError.statusCode)) {
                    await supabase
                        .from('push_subscriptions')
                        .delete()
                        .eq('username', username)
                        .eq('club_code', clubCode)
                        .eq('endpoint', item.endpoint);
                }

                console.error(
                    'Error enviando notificación de prueba:',
                    pushError.statusCode || pushError.message
                );
            }
        }

        return res.json({
            message: 'Prueba de notificaciones finalizada',
            enviados,
            fallidos
        });

    } catch (error) {
        console.error('Error en prueba Web Push:', error.message);

        return res.status(500).json({
            message: 'No se pudo realizar la prueba'
        });
    }
});

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const storedPassword = data.password || '';
    const validPassword =
      isBcryptHash(storedPassword) &&
      await bcrypt.compare(password, storedPassword);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    // Verificar si el usuario está activo
    if (data.active !== true) {
      return res.status(403).json({ error: 'Acceso denegado. Usuario desactivado.' });
    }
    
    if (data.left_at !== null) {
      return res.status(403).json({ error: 'Ya no perteneces a este club.' });
    }

    res.json({
      user: buildUserSessionPayload(data),
      token: issueAccessToken(data),
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ========== USUARIOS ==========
app.get('/api/users', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);

    if (!requester.clubCode) {
      return res.status(403).json({ message: 'No se ha podido identificar el club del usuario' });
    }

    let query = supabase
      .from('users')
      .select('*');

    if (!isSuperadmin(requester)) {
      query = query.eq('club_code', requester.clubCode);
    }

    const { data, error } = await query.order('username');

    if (error) throw error;

    const users = data.map(user => mapUserForClient(user, true));

    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

app.get('/api/users/:username', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', req.params.username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    const isSelf = requester.username === data.username;
    const isManager = requester.role === 'lider' || requester.role === 'administrador';
    const requesterIsSuperadmin = isSuperadmin(requester);

    if (
      !requesterIsSuperadmin &&
      !isSelf &&
      isManager &&
      data.club_code !== requester.clubCode
    ) {
      return res.status(403).json({
        message: 'No tienes permisos para acceder a usuarios de otro club'
      });
    }

    res.json(mapUserForClient(data, true));
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

app.post('/api/users', requireRole(['lider']), async (req, res) => {
    const { username, password, role, fullName, email, dni, address, phone, km, clubCode } = req.body;
    const requester = req.requester || getRequesterIdentity(req);
    const allowedRoles = ['lider', 'administrador', 'voluntario'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: 'Rol no válido'
      });
    }

    if (role === 'lider' && !isSuperadmin(requester)) {
      return res.status(403).json({
        error: 'Solo el superadministrador puede crear usuarios con rol de líder'
      });
    }

    try {
        if (!requester.clubCode) {
            return res.status(403).json({ error: 'No se ha podido identificar el club del usuario' });
        }
        const targetClubCode = isSuperadmin(requester)
          ? clubCode
          : requester.clubCode;

        if (!targetClubCode) {
          return res.status(400).json({ error: 'Debes indicar el club del usuario' });
        }
    // Validar longitud mínima de contraseña
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const hashedPassword = await hashPassword(password);

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        club_code: targetClubCode,
        role,
        full_name: fullName || null,
        email: email || null,
        dni: dni || null,
        address: address || null,
        phone: phone || null,
        km: km ? parseInt(km) : null
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Usuario creado exitosamente', user: mapUserForClient(data, true) });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(400).json({ error: 'Error al crear usuario: ' + error.message });
  }
});

app.put('/api/users/:username', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  const oldUsername = req.params.username;
  const { username: newUsername, password, clubCode, role, fullName, email, dni, address, phone, km } = req.body || {};
  const requester = req.requester || getRequesterIdentity(req);
  const isLeader = requester.role === 'lider';
  const requesterIsSuperadmin = isSuperadmin(requester);

  try {
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('username, club_code, role')
      .eq('username', oldUsername)
      .maybeSingle();

    if (targetUserError) {
      throw targetUserError;
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!requesterIsSuperadmin && targetUser.club_code !== requester.clubCode) {
      return res.status(403).json({
        error: 'No tienes permisos para modificar usuarios de otro club'
      });
    }
    // Proteger la identidad estructural de la cuenta superadmin.
    if (oldUsername === 'superadmin') {
      if (newUsername !== undefined && newUsername !== 'superadmin') {
        return res.status(403).json({
          error: 'No se puede cambiar el nombre de usuario del superadministrador'
        });
      }

      if (clubCode !== undefined && clubCode !== 'SUPERADMIN') {
        return res.status(403).json({
          error: 'El superadministrador debe permanecer en el club SUPERADMIN'
        });
      }

      if (role !== undefined && role !== 'lider') {
        return res.status(403).json({
          error: 'El superadministrador debe mantener el rol de líder'
        });
      }
    }

    // Si se proporciona una nueva contraseña, validarla
    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }
    }

    // Si se proporciona un nuevo username diferente al actual
    if (newUsername && newUsername !== oldUsername) {
      if (!isLeader) {
        return res.status(403).json({ error: 'No tienes permisos para cambiar el nombre de usuario' });
      }

      // Verificar si el nuevo username ya existe
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', newUsername)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
      }

      const updateData = {
        username: newUsername
      };

      if (password !== undefined) {
        updateData.password = await hashPassword(password);
      }
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('username', oldUsername)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.json({
        message: 'Usuario actualizado exitosamente',
        user: mapUserForClient(updatedUser, true)
      });
    }

    // Si no se cambia el username, solo actualizar los campos proporcionados
    const updateData = {};
    if (password !== undefined) updateData.password = await hashPassword(password);

    // Solo líder puede cambiar rol y club_code.
    // El superadmin puede gestionar usuarios de cualquier club.
    if (isLeader && clubCode !== undefined) {
      if (!requesterIsSuperadmin && clubCode !== requester.clubCode) {
        return res.status(403).json({
          error: 'No puedes cambiar un usuario a otro club'
        });
      }

      updateData.club_code = requesterIsSuperadmin
        ? clubCode
        : requester.clubCode;
    }

    if (isLeader && role !== undefined) {
      const allowedRoles = ['lider', 'administrador', 'voluntario'];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          error: 'Rol no válido'
        });
      }

      if (
        role === 'lider' &&
        targetUser.role !== 'lider' &&
        !requesterIsSuperadmin
      ) {
        return res.status(403).json({
          error: 'Solo el superadministrador puede asignar el rol de líder'
        });
      }

      updateData.role = role;
    }


    if (fullName !== undefined) updateData.full_name = fullName;
    if (email !== undefined) updateData.email = email;
    if (dni !== undefined) updateData.dni = dni;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (km !== undefined) updateData.km = km ? parseInt(km) : null;

    if (Object.keys(updateData).length === 0) {
      const { data: unchangedUser, error: unchangedError } = await supabase
        .from('users')
        .select('*')
        .eq('username', oldUsername)
        .single();

      if (unchangedError) throw unchangedError;

      return res.json({ message: 'Sin cambios para actualizar', user: mapUserForClient(unchangedUser, true) });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('username', oldUsername)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Usuario actualizado exitosamente', user: mapUserForClient(data, true) });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(400).json({ error: 'Error al actualizar usuario: ' + error.message });
  }
});

app.delete('/api/users/:username', requireRole(['lider']), async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);
    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }

    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('username, club_code, revoke_token_hash')
      .eq('username', req.params.username)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!targetUser) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }
    const requesterIsSuperadmin = isSuperadmin(requester);

    if (targetUser.username === 'superadmin') {
      return res.status(403).json({
        message: 'La cuenta de superadministrador no puede eliminarse'
      });
    }

    if (!requesterIsSuperadmin && targetUser.club_code !== requester.clubCode) {
      return res.status(403).json({
        message: 'No tienes permisos para eliminar usuarios de otro club'
      });
    }

    let deleteQuery = supabase
      .from('users')
      .delete()
      .eq('username', req.params.username);

    if (!requesterIsSuperadmin) {
      deleteQuery = deleteQuery.eq('club_code', requester.clubCode);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      message: 'Error al eliminar usuario',
      error: error.message
    });
  }
});

// Eliminar permanentemente un ex-miembro junto con todos sus formularios
app.delete('/api/users/:username/permanent', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;
    const requester = req.requester || getRequesterIdentity(req);
    const requesterIsSuperadmin = isSuperadmin(requester);

    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }

    // Verificar que el usuario existe y tiene left_at
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('username, left_at, club_code')
      .eq('username', username)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!userData) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (username === 'superadmin') {
      return res.status(403).json({
        message: 'La cuenta de superadministrador no puede eliminarse permanentemente'
      });
    }

    if (!requesterIsSuperadmin && userData.club_code !== requester.clubCode) {
      return res.status(403).json({
        message: 'No tienes permisos para eliminar permanentemente usuarios de otro club'
      });
    }

    if (!userData.left_at) {
      return res.status(400).json({
        message: 'Solo se pueden eliminar permanentemente ex-miembros dados de baja'
      });
    }
    // Eliminar el usuario
    let deleteQuery = supabase
      .from('users')
      .delete()
      .eq('username', username);

    if (!requesterIsSuperadmin) {
      deleteQuery = deleteQuery.eq('club_code', requester.clubCode);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) throw deleteError;

    res.json({
      message: `Usuario ${username} y sus formularios eliminados permanentemente`
    });
  } catch (error) {
    console.error('Error al eliminar usuario permanentemente:', error);
    res.status(500).json({
      message: 'Error al eliminar usuario',
      error: error.message
    });
  }
});

// Endpoint para cambiar el estado activo del usuario
app.patch('/api/users/:username/toggle-access', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;
    const requester = req.requester || getRequesterIdentity(req);
    const requesterIsSuperadmin = isSuperadmin(requester);

    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }
    // Obtener el estado actual
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('active, club_code')
      .eq('username', username)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!userData) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (username === 'superadmin') {
      return res.status(403).json({
        message: 'No se puede modificar el acceso de la cuenta de superadministrador'
      });
    }

    if (!requesterIsSuperadmin && userData.club_code !== requester.clubCode) {
      return res.status(403).json({
        message: 'No tienes permisos para cambiar el acceso de usuarios de otro club'
      });
    }
    // Alternar el estado activo
    const newActiveState = userData.active === false ? true : false;
    
    let updateQuery = supabase
      .from('users')
      .update({ active: newActiveState })
      .eq('username', username);

    if (!requesterIsSuperadmin) {
      updateQuery = updateQuery.eq('club_code', requester.clubCode);
    }

    const { data, error } = await updateQuery
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      message: `Acceso ${newActiveState ? 'permitido' : 'denegado'} exitosamente`, 
      active: newActiveState 
    });
  } catch (error) {
    console.error('Error al cambiar estado de acceso:', error);
    res.status(500).json({ message: 'Error al cambiar estado de acceso', error: error.message });
  }
});
// Dar de baja a un usuario del club (sin borrar)
app.patch('/api/users/:username/leave', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;
    const requester = req.requester || getRequesterIdentity(req);
    const requesterIsSuperadmin = isSuperadmin(requester);
    const madridDateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const madridDate = Object.fromEntries(
      madridDateParts.map(({ type, value }) => [type, value])
    );

    const today = `${madridDate.year}-${madridDate.month}-${madridDate.day}`;

    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }

    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('username, club_code')
      .eq('username', username)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!userData) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    if (username === 'superadmin') {
      return res.status(403).json({
        message: 'La cuenta de superadministrador no puede darse de baja'
      });
    }

    if (!requesterIsSuperadmin && userData.club_code !== requester.clubCode) {
      return res.status(403).json({
        message: 'No tienes permisos para dar de baja usuarios de otro club'
      });
    }

    let updateQuery = supabase
      .from('users')
      .update({ left_at: today })
      .eq('username', username);

    if (!requesterIsSuperadmin) {
      updateQuery = updateQuery.eq('club_code', requester.clubCode);
    }

    const { error } = await updateQuery;

    if (error) throw error;

    res.json({ message: 'Usuario dado de baja del club', leftAt: today });
      } catch (error) {
        res.status(500).json({
          message: 'Error al dar de baja',
          error: error.message
        });
      }
    });

// Readmitir a un usuario al club
app.patch('/api/users/:username/readmit', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;
    const requester = req.requester || getRequesterIdentity(req);
    const requesterIsSuperadmin = isSuperadmin(requester);

    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }

    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('username, club_code')
      .eq('username', username)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!userData) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    if (username === 'superadmin') {
      return res.status(403).json({
        message: 'La cuenta de superadministrador no puede readmitirse'
      });
    }

    if (!requesterIsSuperadmin && userData.club_code !== requester.clubCode) {
      return res.status(403).json({
        message: 'No tienes permisos para readmitir usuarios de otro club'
      });
    }

    let updateQuery = supabase
      .from('users')
      .update({ left_at: null })
      .eq('username', username);

    if (!requesterIsSuperadmin) {
      updateQuery = updateQuery.eq('club_code', requester.clubCode);
    }

    const { error } = await updateQuery;

    if (error) throw error;

    res.json({ message: 'Usuario readmitido en el club' });
      } catch (error) {
        res.status(500).json({ message: 'Error al readmitir', error: error.message });
      }
    });

// ========== CLUBES ==========
app.get('/api/clubs/me', requireAuthenticated, async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);

    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }

    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('club_code', requester.clubCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error al obtener el club del usuario:', error);
    res.status(500).json({
      message: 'Error al obtener el club',
      error: error.message
    });
  }
});
app.get('/api/clubs', requireSuperadmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('club_code');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error al obtener clubes:', error);
    res.status(500).json({ message: 'Error al obtener clubes', error: error.message });
  }
});
// Subir o sustituir el escudo de un club
app.post(
  '/api/clubs/:club_code/shield',
  requireSuperadmin,
  clubShieldUpload.single('shield'),
  async (req, res) => {
    try {
      const { club_code } = req.params;

      if (!req.file) {
        return res.status(400).json({
          message: 'Debes seleccionar una imagen para el escudo'
        });
      }

      if (!isValidClubShield(req.file)) {
        return res.status(400).json({
          message: 'El archivo no contiene una imagen válida'
        });
      }

      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('club_code, shield_url')
        .eq('club_code', club_code)
        .maybeSingle();

      if (clubError) throw clubError;

      if (!club) {
        return res.status(404).json({
          message: 'Club no encontrado'
        });
      }

      const extensionByMime = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
      };

      const extension = extensionByMime[req.file.mimetype];
      const filePath = `shields/${club_code}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(CLUB_ASSETS_BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(CLUB_ASSETS_BUCKET)
        .getPublicUrl(filePath);

      const newShieldUrl = publicUrlData.publicUrl;

      const { data: updatedClub, error: updateError } = await supabase
        .from('clubs')
        .update({ shield_url: newShieldUrl })
        .eq('club_code', club_code)
        .select()
        .single();

      if (updateError) {
        await supabase.storage
          .from(CLUB_ASSETS_BUCKET)
          .remove([filePath]);

        throw updateError;
      }
      // Eliminar el escudo anterior después de guardar correctamente el nuevo
      if (club.shield_url) {
        try {
          const oldUrl = new URL(club.shield_url);
          const marker = `/storage/v1/object/public/${CLUB_ASSETS_BUCKET}/`;
          const markerIndex = oldUrl.pathname.indexOf(marker);

          if (markerIndex !== -1) {
            const oldFilePath = decodeURIComponent(
              oldUrl.pathname.slice(markerIndex + marker.length)
            );

            if (oldFilePath && oldFilePath !== filePath) {
              const { error: deleteOldError } = await supabase.storage
                .from(CLUB_ASSETS_BUCKET)
                .remove([oldFilePath]);

              if (deleteOldError) {
                console.error(
                  'No se pudo eliminar el escudo anterior:',
                  deleteOldError
                );
              }
            }
          }
        } catch (error) {
          console.error(
            'No se pudo procesar la URL del escudo anterior:',
            error
          );
        }
      }

      res.json({
        message: 'Escudo actualizado correctamente',
        club: updatedClub
      });
    } catch (error) {
      console.error('Error al actualizar el escudo del club:', error);
      res.status(500).json({
        message: 'Error al actualizar el escudo del club',
        error: error.message
      });
    }
  }
);
// Eliminar el escudo de un club
app.delete('/api/clubs/:club_code/shield', requireSuperadmin, async (req, res) => {
  try {
    const { club_code } = req.params;

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('club_code, shield_url')
      .eq('club_code', club_code)
      .maybeSingle();

    if (clubError) throw clubError;

    if (!club) {
      return res.status(404).json({
        message: 'Club no encontrado'
      });
    }

    if (!club.shield_url) {
      return res.status(400).json({
        message: 'El club no tiene ningún escudo'
      });
    }

    const oldUrl = new URL(club.shield_url);
    const marker = `/storage/v1/object/public/${CLUB_ASSETS_BUCKET}/`;
    const markerIndex = oldUrl.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return res.status(400).json({
        message: 'La URL del escudo no pertenece al almacenamiento de GestDeVol'
      });
    }

    const oldFilePath = decodeURIComponent(
      oldUrl.pathname.slice(markerIndex + marker.length)
    );

    const { error: storageError } = await supabase.storage
      .from(CLUB_ASSETS_BUCKET)
      .remove([oldFilePath]);

    if (storageError) throw storageError;

    const { data: updatedClub, error: updateError } = await supabase
      .from('clubs')
      .update({ shield_url: null })
      .eq('club_code', club_code)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      message: 'Escudo eliminado correctamente',
      club: updatedClub
    });
  } catch (error) {
    console.error('Error al eliminar el escudo del club:', error);
    res.status(500).json({
      message: 'Error al eliminar el escudo del club',
      error: error.message
    });
  }
});

app.post('/api/clubs', requireSuperadmin, async (req, res) => {
  try {
    const { club_code, club_name, nom_presidente, dni_presidente,
        color_primary, color_secondary, text_color, accent_color } = req.body;

    if (!club_code || !club_name) {
      return res.status(400).json({ message: 'Código y nombre del club son requeridos' });
    }
    console.log('Datos del club a guardar:', {
  club_code,
  club_name,
  nom_presidente,
  dni_presidente,
  color_primary,
  color_secondary,
  text_color,
  accent_color
});

    const { data, error } = await supabase
      .from('clubs')
      .insert([{
  club_code,
  club_name,
  nom_presidente:  nom_presidente  || '',
  dni_presidente:  dni_presidente  || '',
  color_primary:   color_primary   || '#004d40',
  color_secondary: color_secondary || '#1b5e20',
  text_color:      text_color      || '#f5f5f5',
  accent_color:    accent_color    || '#26a69a'
}])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error al crear club:', error);
    res.status(500).json({ message: 'Error al crear club', error: error.message });
  }
});

app.patch('/api/clubs/:club_code', requireSuperadmin, async (req, res) => {
  try {
    const { club_name, nom_presidente, dni_presidente,
        color_primary, color_secondary, text_color, accent_color } = req.body;
    const updateData = {};
    if (club_name       !== undefined) updateData.club_name       = club_name;
    if (nom_presidente  !== undefined) updateData.nom_presidente  = nom_presidente;
    if (dni_presidente  !== undefined) updateData.dni_presidente  = dni_presidente;
    if (color_primary   !== undefined) updateData.color_primary   = color_primary;
    if (color_secondary !== undefined) updateData.color_secondary = color_secondary;
    if (text_color      !== undefined) updateData.text_color      = text_color;
    if (accent_color    !== undefined) updateData.accent_color    = accent_color;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No se proporcionaron campos válidos para actualizar'
      });
    }
    const { data, error } = await supabase
      .from('clubs')
      .update(updateData)
      .eq('club_code', req.params.club_code)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        message: 'Club no encontrado'
      });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Error al actualizar club:', error);
    res.status(500).json({ message: 'Error al actualizar club', error: error.message });
  }
});

app.delete('/api/clubs/:club_code', requireSuperadmin, async (req, res) => {
  try {
    if (req.params.club_code === 'SUPERADMIN') {
      return res.status(403).json({
        message: 'El club SUPERADMIN es un club del sistema y no puede eliminarse'
      });
    }
    const { count: userCount, error: userCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('club_code', req.params.club_code);

    if (userCountError) throw userCountError;

    if (userCount > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar el club porque todavía tiene usuarios asociados'
      });
    }
    const { data, error } = await supabase
      .from('clubs')
      .delete()
      .eq('club_code', req.params.club_code)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        message: 'Club no encontrado'
      });
    }

    res.json({ message: 'Club eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar club:', error);
    res.status(500).json({ message: 'Error al eliminar club', error: error.message });
  }
});

// ========== FORMULARIOS ==========
app.post(
  '/api/formularios/:username/archivo',
  requireAuthenticated,
  ticketUpload.single('file'),
  async (req, res) => {
    try {
      const requester = req.requester || getRequesterIdentity(req);
      const targetUsername = req.params.username;

      const year = Number.parseInt(req.body?.year, 10);
      const month = Number.parseInt(req.body?.month, 10);
      const category = req.body?.category;
      const baseName = normalizeStoragePart(req.body?.baseName);

      if (!req.file) {
        return res.status(400).json({ message: 'Archivo obligatorio' });
      }
      if (!isValidTicketFile(req.file)) {
        return res.status(400).json({
          message: 'El contenido del archivo no coincide con un formato permitido'
        });
      }

      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: 'Año no válido' });
      }

      if (!Number.isInteger(month) || month < 0 || month > 11) {
        return res.status(400).json({ message: 'Mes no válido' });
      }

      const allowedCategories = {
        transporte: 'transporte',
        dietas: 'dietas'
      };

      const storageCategory = allowedCategories[category];

      if (!storageCategory) {
        return res.status(400).json({ message: 'Categoría no válida' });
      }

      const { data: targetUser, error: targetUserError } = await supabase
        .from('users')
        .select('username, club_code')
        .eq('username', targetUsername)
        .maybeSingle();

      if (targetUserError) {
        throw targetUserError;
      }

      if (!targetUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const isSelf = requester.username === targetUser.username;
      const isManager = isManagerRole(requester.role);

      if (!isSelf && !isManager) {
        return res.status(403).json({
          message: 'No autorizado para subir archivos de otros usuarios'
        });
      }

      if (isManager && !isSuperadmin(requester)) {
        if (
          !requester.clubCode ||
          !targetUser.club_code ||
          requester.clubCode !== targetUser.club_code
        ) {
          return res.status(403).json({
            message: 'No autorizado para subir archivos de otro club'
          });
        }
      }

      if (!targetUser.club_code) {
        return res.status(400).json({
          message: 'El usuario no tiene un club asociado'
        });
      }

      const extension = getTicketExtension(req.file);

      if (!extension) {
        return res.status(400).json({
          message: 'Tipo de archivo no permitido'
        });
      }

      const clubPart = normalizeStoragePart(targetUser.club_code);
      const userPart = normalizeStoragePart(targetUser.username);
      const monthPart = String(month + 1).padStart(2, '0');

      const storageFolder = [
        'clubs',
        clubPart,
        'usuarios',
        userPart,
        String(year),
        monthPart,
        storageCategory
      ].join('/');

      const uniquePart = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fileStem = baseName || 'archivo';
      const fileName = `${fileStem}_${uniquePart}.${extension}`;
      const filePath = `${storageFolder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(TICKET_BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error subiendo justificante a Storage:', uploadError);
        return res.status(500).json({
          message: 'Error al subir el archivo'
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from(TICKET_BUCKET)
        .getPublicUrl(filePath);

      return res.status(201).json({
        url: publicUrlData.publicUrl,
        path: filePath,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      });
    } catch (error) {
      console.error('Error procesando subida de justificante:', error);
      return res.status(500).json({
        message: 'Error al procesar el archivo'
      });
    }
  }
);

/**
 * Genera una URL temporal para un justificante autorizado.
 * El cliente indica el gasto, no una ruta arbitraria de Storage.
 */
app.get(
  '/api/formularios/tickets/:categoria/:gastoId/acceso',
  requireAuthenticated,
  async (req, res) => {
    try {
      const requester = req.requester;
      const { categoria, gastoId } = req.params;

      const tablas = {
        transporte: 'gastos_transporte',
        dietas: 'gastos_dietas'
      };

      const tabla = tablas[categoria];

      if (!tabla || !/^\d+$/.test(gastoId)) {
        return res.status(400).json({
          message: 'Justificante no válido'
        });
      }

      const { data: gasto, error: gastoError } = await supabase
        .from(tabla)
        .select('id, archivo, formulario_id')
        .eq('id', gastoId)
        .maybeSingle();

      if (gastoError) throw gastoError;

      if (!gasto || !gasto.archivo) {
        return res.status(404).json({
          message: 'Justificante no encontrado'
        });
      }

      const { data: formulario, error: formularioError } =
        await supabase
          .from('formularios')
          .select('id, username')
          .eq('id', gasto.formulario_id)
          .maybeSingle();

      if (formularioError) throw formularioError;

      if (!formulario) {
        return res.status(404).json({
          message: 'Formulario no encontrado'
        });
      }

      const { data: propietario, error: usuarioError } =
        await supabase
          .from('users')
          .select('username, club_code')
          .eq('username', formulario.username)
          .maybeSingle();

      if (usuarioError) throw usuarioError;

      if (!propietario) {
        return res.status(404).json({
          message: 'Usuario no encontrado'
        });
      }

      const esPropietario =
        requester.username === propietario.username;

      const esResponsable =
        isManagerRole(requester.role);

      const mismoClub =
        requester.clubCode &&
        propietario.club_code &&
        requester.clubCode === propietario.club_code;

      const autorizado =
        esPropietario ||
        (esResponsable &&
          (isSuperadmin(requester) || mismoClub));

      if (!autorizado) {
        return res.status(403).json({
          message: 'No autorizado para consultar este justificante'
        });
      }

      const storagePath = getTicketStoragePath(gasto.archivo);

      if (!storagePath) {
        return res.status(404).json({
          message: 'Ruta del justificante no válida'
        });
      }

      const prefijo =
        `clubs/${normalizeStoragePart(propietario.club_code)}` +
        `/usuarios/${normalizeStoragePart(propietario.username)}/`;

      if (
        !storagePath.startsWith(prefijo) ||
        storagePath.split('/').some(
          segmento => segmento === '.' || segmento === '..'
        )
      ) {
        return res.status(403).json({
          message: 'Ruta del justificante no autorizada'
        });
      }

      const { data, error } = await supabase.storage
        .from(TICKET_BUCKET)
        .createSignedUrl(storagePath, 60);

      if (error || !data?.signedUrl) {
        console.error('Error generando URL temporal:', error);
        return res.status(500).json({
          message: 'No se pudo acceder al justificante'
        });
      }

      return res.json({
        url: data.signedUrl,
        expiresIn: 60
      });
    } catch (error) {
      console.error('Error accediendo al justificante:', error);
      return res.status(500).json({
        message: 'Error al consultar el justificante'
      });
    }
  }
);

// =====================================================
// DESCARGA MASIVA DE JUSTIFICANTES EN ZIP
// Solo líderes y administradores de su propio club
// =====================================================
app.get(
  '/api/formularios/tickets/zip',
  requireRole(['lider', 'administrador']),
  async (req, res) => {
    try {
      const requester = req.requester;

      if (!requester?.clubCode) {
        return res.status(403).json({
          message: 'No se pudo determinar el club del usuario'
        });
      }

      const { year, month = 'all', username = 'all' } = req.query;

// Validar el año
const yearNumber = Number(year);

if (
  !/^\d{4}$/.test(String(year ?? '')) ||
  yearNumber < 2000 ||
  yearNumber > 2100
) {
  return res.status(400).json({
    message: 'Año no válido'
  });
}

// Validar el mes (0-11 o "all")
if (
  month !== 'all' &&
  (!/^(0|[1-9]|10|11)$/.test(String(month)))
) {
  return res.status(400).json({
    message: 'Mes no válido'
  });
}

// Validar el voluntario
if (
  typeof username !== 'string' ||
  username.length > 100 ||
  (username !== 'all' && !username.trim())
) {
  return res.status(400).json({
    message: 'Voluntario no válido'
  });
}
// Obtener únicamente los usuarios del club autenticado
let usersQuery = supabase
  .from('users')
  .select('username, full_name')
  .eq('club_code', requester.clubCode);

// Si se ha seleccionado un voluntario, filtrar por él
if (username !== 'all') {
  usersQuery = usersQuery.eq('username', username);
}

const { data: clubUsers, error: usersError } = await usersQuery;

if (usersError) {
  console.error('Error obteniendo voluntarios para ZIP:', usersError);

  return res.status(500).json({
    message: 'Error al consultar los voluntarios'
  });
}

const allowedUsernames = (clubUsers || [])
  .map(user => user.username)
  .filter(Boolean);

// No permitir descargar justificantes de otros clubes
if (allowedUsernames.length === 0) {
  return res.status(404).json({
    message: 'No se encontraron voluntarios autorizados'
  });
}
// Consultar los formularios de los voluntarios autorizados
let formulariosQuery = supabase
  .from('formularios')
  .select('id, username, year, month')
  .in('username', allowedUsernames)
  .eq('year', yearNumber);

// Aplicar filtro de mes si se ha seleccionado uno
if (month !== 'all') {
  formulariosQuery = formulariosQuery.eq('month', Number(month));
}

const { data: formulariosZIP, error: formulariosError } =
  await formulariosQuery;

if (formulariosError) {
  console.error('Error consultando formularios para ZIP:', formulariosError);

  return res.status(500).json({
    message: 'Error al consultar los formularios'
  });
}

// Si no hay formularios para los filtros seleccionados
if (!formulariosZIP || formulariosZIP.length === 0) {
  return res.status(404).json({
    message: 'No hay formularios para los filtros seleccionados'
  });
}
// Obtener los identificadores de los formularios autorizados
const formularioIds = formulariosZIP.map(formulario => formulario.id);

// Consultar justificantes de transporte
const { data: gastosTransporteZIP, error: transporteError } =
  await supabase
    .from('gastos_transporte')
    .select('formulario_id, fecha, concepto, archivo')
    .in('formulario_id', formularioIds)
    .not('archivo', 'is', null);

// Consultar justificantes de dietas
const { data: gastosDietasZIP, error: dietasError } =
  await supabase
    .from('gastos_dietas')
    .select('formulario_id, fecha, concepto, archivo')
    .in('formulario_id', formularioIds)
    .not('archivo', 'is', null);

// Comprobar errores de Supabase
if (transporteError || dietasError) {
  console.error('Error consultando justificantes ZIP:', {
    transporteError,
    dietasError
  });

  return res.status(500).json({
    message: 'Error al consultar los justificantes'
  });
}

// Comprobar si existen justificantes
const totalJustificantes =
  (gastosTransporteZIP || []).length +
  (gastosDietasZIP || []).length;

if (totalJustificantes === 0) {
  return res.status(404).json({
    message: 'No hay justificantes para los filtros seleccionados'
  });
}
// Relacionar cada formulario con su voluntario
const formulariosPorId = new Map(
  formulariosZIP.map(formulario => [
    String(formulario.id),
    formulario
  ])
);

// Preparar los justificantes de transporte y dietas
const justificantesZIP = [
  ...(gastosTransporteZIP || []).map(gasto => ({
    ...gasto,
    categoria: 'Transporte'
  })),
  ...(gastosDietasZIP || []).map(gasto => ({
    ...gasto,
    categoria: 'Dietas'
  }))
]
  .map(gasto => ({
    ...gasto,
    formulario: formulariosPorId.get(String(gasto.formulario_id))
  }))
  .filter(gasto => gasto.formulario && gasto.archivo);
  // Comprobar que cada archivo pertenece al club y voluntario autorizados
const justificantesSegurosZIP = justificantesZIP
  .map(gasto => {
    const storagePath = getTicketStoragePath(gasto.archivo);

    if (!storagePath) return null;

    const club = normalizeStoragePart(requester.clubCode);
    const voluntario = normalizeStoragePart(gasto.formulario.username);

    const prefijoAutorizado =
      `clubs/${club}/usuarios/${voluntario}/`;

    // Evitar archivos de otros clubes o voluntarios
    if (!storagePath.startsWith(prefijoAutorizado)) {
      console.warn('Justificante ZIP rechazado por ruta no autorizada');
      return null;
    }

    // Evitar rutas con segmentos de navegación
    if (storagePath.split('/').some(parte =>
      parte === '.' || parte === '..'
    )) {
      return null;
    }

    return {
      ...gasto,
      storagePath
    };
  })
  .filter(Boolean);

if (justificantesSegurosZIP.length === 0) {
  return res.status(404).json({
    message: 'No hay justificantes válidos para descargar'
  });
}
// Descargar los justificantes autorizados desde Supabase Storage
const archivosZIP = [];

for (const gasto of justificantesSegurosZIP) {
  const { data: archivo, error: descargaError } =
    await supabase.storage
      .from(TICKET_BUCKET)
      .download(gasto.storagePath);

  if (descargaError || !archivo) {
    console.warn(
      'No se pudo descargar un justificante:',
      gasto.storagePath,
      descargaError
    );
    continue;
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());

  archivosZIP.push({
    buffer,
    username: gasto.formulario.username,
    categoria: gasto.categoria,
    nombreOriginal: path.posix.basename(gasto.storagePath)
  });
}

if (archivosZIP.length === 0) {
  return res.status(404).json({
    message: 'No se pudieron descargar los justificantes'
  });
}
// Preparar la respuesta ZIP
const nombreZIP = `Justificantes_${yearNumber}_${month === 'all' ? 'Todos' : Number(month) + 1}.zip`;

res.setHeader('Content-Type', 'application/zip');
res.setHeader(
  'Content-Disposition',
  `attachment; filename="${nombreZIP}"`
);

// Crear el archivo comprimido
const zip = new ZipArchive({
  zlib: { level: 6 }
});

zip.on('error', error => {
  console.error('Error creando ZIP:', error);
  res.destroy(error);
});

// Enviar el ZIP al navegador
zip.pipe(res);

// Incorporar los justificantes
archivosZIP.forEach((archivo, index) => {
  const voluntario = normalizeStoragePart(archivo.username);

  const nombreArchivo =
    `${String(index + 1).padStart(3, '0')}_${archivo.nombreOriginal}`;

  const rutaZIP =
    `${voluntario}/${archivo.categoria}/${nombreArchivo}`;

  zip.append(archivo.buffer, {
    name: rutaZIP
  });
});

// Finalizar el ZIP
await zip.finalize();

    } catch (error) {
      console.error('Error descargando tickets ZIP:', error);

      if (res.headersSent) {
        return res.destroy(error);
      }

      return res.status(500).json({
        message: 'Error al generar el archivo ZIP'
      });
    }
  }
);
app.get('/api/formularios', requireAuthenticated, async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);

    if (!requester.username) {
      return res.status(401).json({ message: 'Autenticación requerida' });
    }

    if (isManagerRole(requester.role) && !requester.clubCode) {
      return res.status(403).json({ message: 'No se pudo determinar el club del usuario' });
    }

    if (requester.role !== 'voluntario' && !isManagerRole(requester.role)) {
      return res.status(403).json({ message: 'Rol no autorizado para consultar formularios' });
    }

    console.log('📋 Obteniendo todos los formularios...');
    // Obtener solo los usuarios que el solicitante puede consultar
    let usersQuery = supabase
      .from('users')
      .select('username, full_name, club_code');
    if (isManagerRole(requester.role) && !isSuperadmin(requester)) {
      usersQuery = usersQuery.eq('club_code', requester.clubCode);
    } else if (requester.role === 'voluntario') {
      usersQuery = usersQuery.eq('username', requester.username);
    }

    const { data: users, error: userError } = await usersQuery;

    if (userError) {
      console.error('❌ Error al obtener usuarios:', userError);
      return res.status(500).json({ message: 'Error al obtener usuarios', error: userError.message });
    }
    
    console.log(`✓ ${users?.length || 0} usuarios encontrados`);
        const allowedUsernames = (users || [])
      .map((user) => user.username)
      .filter(Boolean);

    if (allowedUsernames.length === 0) {
      return res.json([]);
    }

    // Obtener solo los formularios de los usuarios autorizados
    const { data: formularios, error: formError } = await supabase
      .from('formularios')
      .select('*')
      .in('username', allowedUsernames)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (formError) {
      console.error('❌ Error al obtener formularios:', formError);
      return res.status(500).json({
        message: 'Error al obtener formularios',
        error: formError.message
      });
    }

    console.log(`✓ ${formularios?.length || 0} formularios autorizados encontrados`);

    // Crear un mapa de username -> club_code
    const userClubMap = {};
    const userFullNameMap = {};

    if (users && Array.isArray(users)) {
      users.forEach(user => {
        if (user && user.username) {
          userClubMap[user.username] = user.club_code;
          userFullNameMap[user.username] = user.full_name || user.username;
        }
      });
    }

    // Mapear los campos y agregar clubCode
    const formulariosConClub = await Promise.all((formularios || []).map(async (form) => {
      let matches = [];
      let transportExpenses = [];
      let dietExpenses = [];

      if (form.id) {
        const { data: desplazamientosData, error: desplazamientosError } = await supabase
          .from('desplazamientos')
          .select('fecha, localidad, lugar, km')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (desplazamientosError) {
          console.error(`❌ Error al obtener desplazamientos para formulario ${form.id}:`, desplazamientosError);
          throw desplazamientosError;
        } else {
          matches = (desplazamientosData || []).map((desp) => ({
            date: desp.fecha,
            locality: desp.localidad,
            place: desp.lugar,
            km: desp.km?.toString() || '0'
          }));
        }

        const { data: gastosTransporteData, error: gastosTransporteError } = await supabase
          .from('gastos_transporte')
          .select('id, fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosTransporteError) {
          console.error(`❌ Error al obtener gastos de transporte para formulario ${form.id}:`, gastosTransporteError);
          throw gastosTransporteError;
        } else {
          transportExpenses = (gastosTransporteData || []).map((gasto) => ({
  id: gasto.id, // AÑADIR ESTA LÍNEA
  date: gasto.fecha,
  concept: gasto.concepto,
  amount: gasto.importe?.toString() || '0',
  fileUrl: gasto.archivo || null,
  url: gasto.archivo || null
}));
        }

        const { data: gastosDietasData, error: gastosDietasError } = await supabase
          .from('gastos_dietas')
          .select('id, fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosDietasError) {
          console.error(`❌ Error al obtener gastos de dietas para formulario ${form.id}:`, gastosDietasError);
          throw gastosDietasError;
        } else {
          dietExpenses = (gastosDietasData || []).map((gasto) => ({
            id: gasto.id, // AÑADIR ESTA LÍNEA
            date: gasto.fecha,
            concept: gasto.concepto,
            amount: gasto.importe?.toString() || '0',
            fileUrl: gasto.archivo || null,
            url: gasto.archivo || null
          }));
        }
      }

      return {
        ...form,
        clubCode: userClubMap[form.username] || null,
        fullName: userFullNameMap[form.username] || form.username,
        completed: form.completado === true,
        completedAt: form.completado_at || null,
        completedBy: form.completado_by || null,
        matches,
        trainingAttendance: form.asistencia || 0,
        transportExpenses,
        dietExpenses,
        weeksInMonth: form.semanas || 0,
        residenceAddress: form.residence_address || null,
        residenceKm: form.residence_km ?? null,
        direccionResidencia: form.residence_address || null,
        kmResidencia: form.residence_km ?? null
      };
    }));
    
    console.log(`✓ Formularios procesados con clubCode: ${formulariosConClub.length}`);
  let formulariosFiltrados = formulariosConClub;
  if (isSuperadmin(requester)) {
    // El superadmin puede consultar los formularios de todos los clubes
  } else if (isManagerRole(requester.role)) {
    formulariosFiltrados = formulariosConClub.filter(
      (form) => form.clubCode === requester.clubCode
    );
  } else if (requester.role === 'voluntario') {
    formulariosFiltrados = formulariosConClub.filter(
      (form) => form.username === requester.username
  );
  } else {
    return res.status(403).json({
      message: 'Rol no autorizado para consultar formularios'
    });
  }

    res.json(formulariosFiltrados);
  } catch (error) {
    console.error('❌ Error en /api/formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.get('/api/formularios/estado-mensual', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);

    if (!requester.clubCode) {
      return res.status(400).json({ message: 'No se pudo determinar el club del solicitante' });
    }

    const now = new Date();
    const queryYear = Number.parseInt(req.query?.year, 10);
    const queryMonth = Number.parseInt(req.query?.month, 10);
    const year = Number.isInteger(queryYear) ? queryYear : now.getFullYear();
    const month = Number.isInteger(queryMonth) ? queryMonth : now.getMonth();

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
      return res.status(400).json({ message: 'Parámetros year/month inválidos' });
    }

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('username, full_name, role, active, left_at, club_code')
      .eq('club_code', requester.clubCode);

    if (usersError) {
      throw usersError;
    }

    const volunteerUsers = (usersData || []).filter((user) => {
      const normalizedRole = (user.role || '').toLowerCase().trim();
      const isVolunteer = normalizedRole === 'voluntario';
      const isActive = user.active !== false;
      const isCurrentMember = !user.left_at;
      return isVolunteer && isActive && isCurrentMember;
    });

    if (volunteerUsers.length === 0) {
      return res.json({
        year,
        month,
        totalVoluntariosActivos: 0,
        completadosCount: 0,
        pendientesCount: 0,
        completados: [],
        pendientes: []
      });
    }

    const usernames = volunteerUsers.map((user) => user.username);
    const { data: formsData, error: formsError } = await supabase
      .from('formularios')
      .select('username, completado, completado_at')
      .eq('year', year)
      .eq('month', month)
      .in('username', usernames);

    if (formsError) {
      throw formsError;
    }

    const completadosMap = new Map();
    (formsData || []).forEach((form) => {
      if (form.completado === true && form.username) {
        completadosMap.set(form.username, form.completado_at || null);
      }
    });

    const completados = [];
    const pendientes = [];

    volunteerUsers.forEach((user) => {
      const userSummary = {
        username: user.username,
        fullName: user.full_name || user.username
      };

      if (completadosMap.has(user.username)) {
        completados.push({
          ...userSummary,
          completedAt: completadosMap.get(user.username)
        });
      } else {
        pendientes.push(userSummary);
      }
    });

    completados.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
    pendientes.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

    res.json({
      year,
      month,
      totalVoluntariosActivos: volunteerUsers.length,
      completadosCount: completados.length,
      pendientesCount: pendientes.length,
      completados,
      pendientes
    });
  } catch (error) {
    console.error('❌ Error en /api/formularios/estado-mensual:', error);
    res.status(500).json({ message: 'Error al obtener estado mensual de formularios', error: error.message });
  }
});

app.get('/api/formularios/:username', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);
    const targetUsername = req.params.username;

    if (isManagerRole(requester.role) && !isSuperadmin(requester)) {
      const targetClubCode = await fetchUserClubCode(targetUsername);
      if (!requester.clubCode || !targetClubCode || requester.clubCode !== targetClubCode) {
        return res.status(403).json({ message: 'No autorizado para consultar formularios de otro club' });
      }
    }

    const { data, error } = await supabase
      .from('formularios')
      .select('*')
      .eq('username', targetUsername)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    // Mapear los campos de snake_case a camelCase para el frontend
    const formularios = await Promise.all(data.map(async (form) => {
      let matches = [];
      let transportExpenses = [];
      let dietExpenses = [];

      if (form.id) {
        const { data: desplazamientosData, error: desplazamientosError } = await supabase
          .from('desplazamientos')
          .select('fecha, localidad, lugar, km')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (desplazamientosError) {
          console.error(`❌ Error al obtener desplazamientos para formulario ${form.id}:`, desplazamientosError);
          throw desplazamientosError;
        } else {
          matches = (desplazamientosData || []).map((desp) => ({
            date: desp.fecha,
            locality: desp.localidad,
            place: desp.lugar,
            km: desp.km?.toString() || '0'
          }));
        }

        const { data: gastosTransporteData, error: gastosTransporteError } = await supabase
          .from('gastos_transporte')
          .select('id, fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosTransporteError) {
          console.error(`❌ Error al obtener gastos de transporte para formulario ${form.id}:`, gastosTransporteError);
          throw gastosTransporteError;
        } else {
          transportExpenses = (gastosTransporteData || []).map((gasto) => ({
            id: gasto.id,
            date: gasto.fecha,
            concept: gasto.concepto,
            amount: gasto.importe?.toString() || '0',
            fileUrl: gasto.archivo || null,
            url: gasto.archivo || null
          }));
        }

        const { data: gastosDietasData, error: gastosDietasError } = await supabase
          .from('gastos_dietas')
          .select('id, fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosDietasError) {
          console.error(`❌ Error al obtener gastos de dietas para formulario ${form.id}:`, gastosDietasError);
          throw gastosDietasError;
        } else {
          dietExpenses = (gastosDietasData || []).map((gasto) => ({
            id: gasto.id,
            date: gasto.fecha,
            concept: gasto.concepto,
            amount: gasto.importe?.toString() || '0',
            fileUrl: gasto.archivo || null,
            url: gasto.archivo || null
          }));
        }
      }

      return {
        ...form,
        completed: form.completado === true,
        completedAt: form.completado_at || null,
        completedBy: form.completado_by || null,
        matches,
        trainingAttendance: form.asistencia || 0,
        transportExpenses,
        dietExpenses,
        weeksInMonth: form.semanas || 4,
        residenceAddress: form.residence_address || null,
        residenceKm: form.residence_km ?? null,
        direccionResidencia: form.residence_address || null,
        kmResidencia: form.residence_km ?? null,
        // Mantener compatibilidad con nombres anteriores
        gastosTransporte: transportExpenses,
        gastosDietas: dietExpenses
      };
    }));

    res.json(formularios);
  } catch (error) {
    console.error('Error al obtener formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.post('/api/formularios', requireAuthenticated, async (req, res) => {
  const {
    username,
    year,
    month,
    asistencia,
    desplazamientos,
    gastosTransporte,
    gastosDietas,
    semanas,
    completado,
    residenceAddress,
    residenceKm
  } = req.body;
  const requester = req.requester || getRequesterIdentity(req);

  console.log('📝 Datos recibidos:', {
    username, year, month, asistencia, desplazamientos, gastosTransporte, gastosDietas, semanas
  });

  try {
    if (!username) {
      return res.status(400).json({ message: 'username es obligatorio' });
    }

    const isSelf = requester.username === username;
    const isManager = isManagerRole(requester.role);

    if (!isSelf && !isManager) {
      return res.status(403).json({ message: 'No autorizado para guardar formularios de otros usuarios' });
    }

    if (isManager && !isSuperadmin(requester)) {
      const targetClubCode = await fetchUserClubCode(username);
      if (!requester.clubCode || !targetClubCode || requester.clubCode !== targetClubCode) {
        return res.status(403).json({ message: 'No autorizado para guardar formularios de otro club' });
      }
    }

    const parsedYear = parseInt(year);
    const parsedMonth = parseInt(month);

    const { data: existingForm, error: existingFormError } = await supabase
      .from('formularios')
      .select('completado, completado_at, completado_by')
      .eq('username', username)
      .eq('year', parsedYear)
      .eq('month', parsedMonth)
      .maybeSingle();

    if (existingFormError) {
      throw existingFormError;
    }

    const completionRequested = typeof completado === 'boolean';
    const completedValue = completionRequested
      ? completado
      : (existingForm?.completado === true);

    let completedAtValue = existingForm?.completado_at || null;
    let completedByValue = existingForm?.completado_by || null;

    let finalResidenceAddress = residenceAddress || null;
    let finalResidenceKm = residenceKm !== undefined && residenceKm !== null && String(residenceKm).trim() !== ''
      ? parseInt(residenceKm, 10)
      : null;

    if (!finalResidenceAddress || finalResidenceKm === null || Number.isNaN(finalResidenceKm)) {
      const { data: userProfile, error: userProfileError } = await supabase
        .from('users')
        .select('address, km')
        .eq('username', username)
        .maybeSingle();

      if (userProfileError) {
        console.error('⚠️ No se pudo obtener perfil para fallback de residencia:', userProfileError);
      }

      if (!finalResidenceAddress) {
        finalResidenceAddress = userProfile?.address || null;
      }
      if (finalResidenceKm === null || Number.isNaN(finalResidenceKm)) {
        finalResidenceKm = userProfile?.km ?? null;
      }
    }

    if (completionRequested) {
      if (completedValue) {
        completedAtValue = existingForm?.completado_at || new Date().toISOString();
        completedByValue = existingForm?.completado_by || requester.username || username;
      } else {
        completedAtValue = null;
        completedByValue = null;
      }
    }

    const formularioData = {
      username,
      year: parsedYear,
      month: parsedMonth,
      asistencia: parseInt(asistencia || 0),
      // La tabla formularios ya no es la fuente de verdad para desplazamientos.
      // Se gestionan en la tabla desplazamientos usando formulario_id.
      desplazamientos: [],
      // Los gastos de transporte se gestionan en la tabla gastos_transporte.
      gastos_transporte: [],
      // Los gastos de dietas se gestionan en la tabla gastos_dietas.
      gastos_dietas: [],
      semanas: parseInt(semanas || 0),
      residence_address: finalResidenceAddress,
      residence_km: finalResidenceKm,
      completado: completedValue,
      completado_at: completedAtValue,
      completado_by: completedByValue,
      updated_at: new Date().toISOString()
    };

    console.log('💾 Guardando en Supabase:', formularioData);

    const { data, error } = await supabase
      .from('formularios')
      .upsert(formularioData, { onConflict: 'username,year,month' })
      .select()
      .single();

    if (error) throw error;

    const formularioId = data?.id;
    if (!formularioId) {
      throw new Error('No se pudo obtener el id del formulario para guardar desplazamientos');
    }

    // Reemplazar desplazamientos del formulario con el estado actual enviado por frontend.
    const { error: deleteDesplazamientosError } = await supabase
      .from('desplazamientos')
      .delete()
      .eq('formulario_id', formularioId);

    if (deleteDesplazamientosError) throw deleteDesplazamientosError;

    const desplazamientosRows = (desplazamientos || [])
      .filter((d) => d && (d.date || d.locality || d.place || d.km))
      .map((d) => ({
        formulario_id: formularioId,
        fecha: d.date || null,
        localidad: d.locality || '',
        lugar: d.place || '',
        km: Number(d.km || 0),
        created_at: new Date().toISOString()
      }));

    if (desplazamientosRows.length > 0) {
      const { error: insertDesplazamientosError } = await supabase
        .from('desplazamientos')
        .insert(desplazamientosRows);

      if (insertDesplazamientosError) throw insertDesplazamientosError;
    }
    const { data: oldTransportExpenses, error: oldTransportExpensesError } = await supabase
      .from('gastos_transporte')
      .select('archivo')
      .eq('formulario_id', formularioId);

    if (oldTransportExpensesError) throw oldTransportExpensesError;

    const { data: oldDietExpenses, error: oldDietExpensesError } = await supabase
      .from('gastos_dietas')
      .select('archivo')
      .eq('formulario_id', formularioId);

    if (oldDietExpensesError) throw oldDietExpensesError;
    // Reemplazar gastos de transporte del formulario con el estado actual enviado por frontend.
    const { error: deleteGastosTransporteError } = await supabase
      .from('gastos_transporte')
      .delete()
      .eq('formulario_id', formularioId);

    if (deleteGastosTransporteError) throw deleteGastosTransporteError;

    const gastosTransporteRows = (gastosTransporte || [])
      .filter((g) => g && (g.date || g.concept || g.amount || g.fileUrl || g.url))
      .map((g) => ({
        formulario_id: formularioId,
        fecha: g.date || null,
        concepto: g.concept || '',
        importe: Number(g.amount || 0),
        archivo: g.fileUrl || g.url || null,
        created_at: new Date().toISOString()
      }));

    if (gastosTransporteRows.length > 0) {
      const { error: insertGastosTransporteError } = await supabase
        .from('gastos_transporte')
        .insert(gastosTransporteRows);

      if (insertGastosTransporteError) throw insertGastosTransporteError;
    }

    // Reemplazar gastos de dietas del formulario con el estado actual enviado por frontend.
    const { error: deleteGastosDietasError } = await supabase
      .from('gastos_dietas')
      .delete()
      .eq('formulario_id', formularioId);

    if (deleteGastosDietasError) throw deleteGastosDietasError;

    const gastosDietasRows = (gastosDietas || [])
      .filter((g) => g && (g.date || g.concept || g.amount || g.fileUrl || g.url))
      .map((g) => ({
        formulario_id: formularioId,
        fecha: g.date || null,
        concepto: g.concept || '',
        importe: Number(g.amount || 0),
        archivo: g.fileUrl || g.url || null,
        created_at: new Date().toISOString()
      }));

    if (gastosDietasRows.length > 0) {
      const { error: insertGastosDietasError } = await supabase
        .from('gastos_dietas')
        .insert(gastosDietasRows);

      if (insertGastosDietasError) throw insertGastosDietasError;
    }
    const currentFileUrls = [
      ...(gastosTransporteRows || []),
      ...(gastosDietasRows || [])
    ]
      .map((gasto) => gasto.archivo)
      .filter(Boolean);

    const currentFilePaths = new Set(
      currentFileUrls
        .map(getTicketStoragePath)
        .filter(Boolean)
    );
    const oldFilePaths = [
      ...(oldTransportExpenses || []),
      ...(oldDietExpenses || [])
    ]
      .map((gasto) => getTicketStoragePath(gasto.archivo))
      .filter(Boolean);

    const filesToDelete = [
      ...new Set(oldFilePaths)
    ].filter((filePath) => !currentFilePaths.has(filePath));

    if (filesToDelete.length > 0) {
      const { error: deleteFilesError } = await supabase.storage
        .from(TICKET_BUCKET)
        .remove(filesToDelete);

      if (deleteFilesError) {
        console.error('Error eliminando justificantes antiguos:', deleteFilesError);
      }
    }

    console.log('✅ Guardado exitoso:', data);
    res.json({ message: 'Formulario guardado exitosamente', formulario: data });
  } catch (error) {
    console.error('❌ Error al guardar formulario:', error);
    res.status(500).json({ message: 'Error al guardar formulario', error: error.message });
  }
});

app.patch('/api/formularios/:username/:year/:month/completar', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  const { username, year, month } = req.params;
  const requester = req.requester || getRequesterIdentity(req);
  const completed = req.body?.completed !== false;

  try {
    if (isManagerRole(requester.role) && !isSuperadmin(requester)) {
      const targetClubCode = await fetchUserClubCode(username);
      if (!requester.clubCode || !targetClubCode || requester.clubCode !== targetClubCode) {
        return res.status(403).json({ message: 'No autorizado para actualizar formularios de otro club' });
      }
    }

    const { data: existingForm, error: existingFormError } = await supabase
      .from('formularios')
      .select('id')
      .eq('username', username)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .maybeSingle();

    if (existingFormError) throw existingFormError;

    if (!existingForm) {
      return res.status(404).json({ message: 'No se encontró el formulario para ese periodo' });
    }

    const updatePayload = {
      completado: completed,
      completado_at: completed ? new Date().toISOString() : null,
      completado_by: completed ? (requester.username || username) : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('formularios')
      .update(updatePayload)
      .eq('username', username)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .select('username, year, month, completado, completado_at, completado_by')
      .single();

    if (error) throw error;

    res.json({
      message: completed ? 'Formulario marcado como completado' : 'Formulario marcado como pendiente',
      formulario: {
        username: data.username,
        year: data.year,
        month: data.month,
        completed: data.completado === true,
        completedAt: data.completado_at || null,
        completedBy: data.completado_by || null
      }
    });
  } catch (error) {
    console.error('❌ Error al actualizar estado de completado:', error);
    res.status(500).json({ message: 'Error al actualizar estado del formulario', error: error.message });
  }
});

app.delete('/api/formularios/:username/:year/:month', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  const { username, year, month } = req.params;
  const requester = req.requester || getRequesterIdentity(req);

  try {
    if (isManagerRole(requester.role) && !isSuperadmin(requester)) {
      const targetClubCode = await fetchUserClubCode(username);
      if (!requester.clubCode || !targetClubCode || requester.clubCode !== targetClubCode) {
        return res.status(403).json({ message: 'No autorizado para borrar formularios de otro club' });
      }
    }

    const { data: formulario, error: formularioError } = await supabase
      .from('formularios')
      .select('id')
      .eq('username', username)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .maybeSingle();

    if (formularioError) throw formularioError;

    if (!formulario) {
      return res.status(404).json({
        message: 'Formulario no encontrado'
      });
    }

    const { data: transportExpenses, error: transportError } = await supabase
      .from('gastos_transporte')
      .select('archivo')
      .eq('formulario_id', formulario.id);

    if (transportError) throw transportError;

    const { data: dietExpenses, error: dietError } = await supabase
      .from('gastos_dietas')
      .select('archivo')
      .eq('formulario_id', formulario.id);

    if (dietError) throw dietError;

    const filesToDelete = [
      ...(transportExpenses || []),
      ...(dietExpenses || [])
    ]
      .map((gasto) => getTicketStoragePath(gasto.archivo))
      .filter(Boolean);

    const { error: deleteError } = await supabase
      .from('formularios')
      .delete()
      .eq('id', formulario.id);

    if (deleteError) throw deleteError;

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(TICKET_BUCKET)
        .remove([...new Set(filesToDelete)]);

      if (storageError) {
        console.error(
          'Error eliminando justificantes del formulario desde Storage:',
          storageError
        );
      }
    }

    res.json({ message: 'Formulario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar formulario:', error);
    res.status(500).json({ message: 'Error al eliminar formulario', error: error.message });
  }
});

// Manejo de errores controlados sin exponer información interna.
app.use((err, req, res, next) => {
  if (err?.status === 403 && err?.message === 'Origen no permitido por CORS') {
    return res.status(403).json({
      message: 'Origen no permitido'
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'El archivo excede el tamaño máximo de 10 MB'
      });
    }

    return res.status(400).json({
      message: 'Error al procesar el archivo'
    });
  }

  if (err?.message === 'Tipo de archivo no permitido') {
    return res.status(400).json({
      message: 'Tipo de archivo no permitido'
    });
  }

  next(err);
});
// ==========================================
// RECORDATORIOS AUTOMÁTICOS DE LIQUIDACIONES
// ==========================================

async function obtenerVoluntariosPendientes(year, month) {
  const { data: usuarios, error: usersError } = await supabase
    .from('users')
    .select('username, club_code, role, active, left_at');
  if (usersError) throw usersError;

  const voluntariosActivos = (usuarios || []).filter(user =>
  (user.role || '').toLowerCase().trim() === 'voluntario' &&
  user.username &&
  user.club_code &&
  user.active !== false &&
  !user.left_at
);

  if (voluntariosActivos.length === 0) {
    return [];
  }

  const { data: formularios, error: formsError } = await supabase
    .from('formularios')
    .select('username, completado')
    .eq('year', year)
    .eq('month', month)
    .in('username', [...new Set(voluntariosActivos.map(user => user.username))]);

  if (formsError) throw formsError;

  const completados = new Set(
    (formularios || [])
      .filter(form => form.completado === true)
      .map(form => form.username)
  );

  return voluntariosActivos.filter(user =>
    !completados.has(user.username)
  );
}
function crearMensajeRecordatorio(dia) {
  if (dia === 25) {
    return JSON.stringify({
      title: 'GestDeVol - Liquidación pendiente',
      body: 'Recuerda completar tu liquidación mensual.',
      url: '/interfaz_personalizada.html'
    });
  }

  if (dia === 28) {
    return JSON.stringify({
      title: 'GestDeVol - Último recordatorio',
      body: 'Tu liquidación mensual sigue pendiente. Recuerda completarla.',
      url: '/interfaz_personalizada.html'
    });
  }

  throw new Error('Día de recordatorio no válido');
}
async function enviarPushRecordatorio(voluntario, dia) {
  const { username, club_code: clubCode } = voluntario;

  const { data: dispositivos, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('username', username)
    .eq('club_code', clubCode);

  if (error) throw error;

  const resultado = {
  enviados: 0,
  fallidos: 0,
  dispositivos: (dispositivos || []).length
};

  const mensaje = crearMensajeRecordatorio(dia);

  for (const dispositivo of dispositivos || []) {
    try {
      await webpush.sendNotification({
        endpoint: dispositivo.endpoint,
        keys: {
          p256dh: dispositivo.p256dh,
          auth: dispositivo.auth
        }
      }, mensaje);

      resultado.enviados++;

    } catch (errorPush) {
      resultado.fallidos++;

      if ([404, 410].includes(errorPush.statusCode)) {
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('username', username)
          .eq('club_code', clubCode)
          .eq('endpoint', dispositivo.endpoint);

        if (deleteError) {
          console.error('Error eliminando suscripción caducada:', deleteError);
        }
      }

      console.error(
        'Error enviando recordatorio Push:',
        errorPush.statusCode || errorPush.message
      );
    }
  }

  return resultado;
}
async function liquidacionSiguePendiente(username, year, month) {
  const { data, error } = await supabase
    .from('formularios')
    .select('completado')
    .eq('username', username)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;

  return !(data || []).some(form => form.completado === true);
}
async function reservarRecordatorio(voluntario, year, month, dia) {
  const { data, error } = await supabase.rpc('claim_push_reminder', {
    p_username: voluntario.username,
    p_club_code: voluntario.club_code,
    p_year: year,
    p_month: month,
    p_reminder_day: dia
  });

  if (error) throw error;

  return data === true;
}
async function registrarResultadoRecordatorio(
  voluntario, year, month, dia, estado
) {
  if (!['sent', 'failed', 'skipped'].includes(estado)) {
    throw new Error('Estado de recordatorio no válido');
  }

  const { error } = await supabase
    .from('push_reminder_log')
    .update({
      status: estado,
      sent_at: estado === 'sent'
        ? new Date().toISOString()
        : null
    })
    .eq('username', voluntario.username)
    .eq('club_code', voluntario.club_code)
    .eq('year', year)
    .eq('month', month)
    .eq('reminder_day', dia)
    .eq('status', 'pending');

  if (error) throw error;
}async function procesarRecordatorios(year, month, dia) {
  if (![25, 28].includes(dia)) {
    throw new Error('Día de recordatorio no válido');
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('Web Push no está configurado');
  }

  const todosPendientes = await obtenerVoluntariosPendientes(year, month);

const pendientes = await obtenerVoluntariosPendientes(year, month);

  console.log(
    `[Recordatorios] ${year}/${month + 1}, día ${dia}: ` +
    `${pendientes.length} voluntarios pendientes`
  );

  const resumen = {
    pendientes: pendientes.length,
    enviados: 0,
    fallidos: 0,
    omitidos: 0
  };

  for (const voluntario of pendientes) {
    try {
      // Comprobar que sigue pendiente.
      if (!await liquidacionSiguePendiente(
        voluntario.username, year, month
      )) {
        resumen.omitidos++;
        continue;
      }

      // No reservar si no tiene dispositivos.
      const { count, error: countError } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('username', voluntario.username)
        .eq('club_code', voluntario.club_code);

      if (countError) throw countError;

      if (!count) {
        resumen.omitidos++;
        continue;
      }

      const reservado = await reservarRecordatorio(
        voluntario, year, month, dia
      );

      if (!reservado) {
        resumen.omitidos++;
        continue;
      }
            // Comprobar nuevamente antes de enviar.
      if (!await liquidacionSiguePendiente(
        voluntario.username, year, month
      )) {
        await registrarResultadoRecordatorio(
          voluntario, year, month, dia, 'skipped'
        );

        resumen.omitidos++;
        continue;
      }

      const resultado = await enviarPushRecordatorio(
        voluntario, dia
      );

      const enviado = resultado.enviados > 0;

      await registrarResultadoRecordatorio(
        voluntario,
        year,
        month,
        dia,
        enviado ? 'sent' : 'failed'
      );

      if (enviado) {
        resumen.enviados++;
      } else {
        resumen.fallidos++;
      }

    } catch (error) {
      resumen.fallidos++;
      console.error(
        `[Recordatorios] Error procesando ${voluntario.username}:`,
        error.message
      );
    }
  }

  console.log('[Recordatorios] Resultado:', resumen);
  return resumen;
}
async function marcarRecordatoriosInterrumpidos() {
  const limite = new Date(
    Date.now() - 30 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('push_reminder_log')
    .update({
      status: 'interrupted'
    })
    .eq('status', 'pending')
    .lt('claimed_at', limite)
    .select('id');

  if (error) throw error;

  if (data?.length) {
    console.warn(
      `[Recordatorios] ${data.length} reservas interrumpidas detectadas`
    );
  }

  return data?.length || 0;
}
// Recordatorios automáticos: días 25 y 28 a las 10:00 (España).
// Desactivados hasta completar las pruebas.
if (process.env.ENABLE_PUSH_REMINDERS === 'true') {
  cron.schedule('0 10 25,28 * *', async () => {
    try {
      const partes = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(new Date());

      const obtener = tipo =>
        Number(partes.find(p => p.type === tipo).value);

      const year = obtener('year');
      const month = obtener('month') - 1;
      const dia = obtener('day');

      await marcarRecordatoriosInterrumpidos();
      await procesarRecordatorios(year, month, dia);

    } catch (error) {
      console.error(
        '[Recordatorios] Error en ejecución automática:',
        error
      );
    }
  }, {
    timezone: 'Europe/Madrid',
    noOverlap: true
  });

  console.log('[Recordatorios] Programador activado');
}
async function recuperarRecordatoriosDelDia() {
  const ahora = new Date();

  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(ahora);

  const obtener = tipo =>
    Number(partes.find(p => p.type === tipo).value);

  const year = obtener('year');
  const month = obtener('month') - 1;
  const dia = obtener('day');
  const hora = obtener('hour');

  if (![25, 28].includes(dia) || hora < 10) {
    return;
  }

  console.log('[Recordatorios] Comprobando envíos pendientes del día');

  await marcarRecordatoriosInterrumpidos();
  await procesarRecordatorios(year, month, dia);
}
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`✓ También accesible desde: http://192.168.0.24:${PORT}`);
  console.log('✓ Conectado a Supabase');
  if (process.env.ENABLE_PUSH_REMINDERS === 'true') {
  try {
    await recuperarRecordatoriosDelDia();
  } catch (error) {
    console.error(
      '[Recordatorios] Error recuperando recordatorios:',
      error
    );
  }
}

  try {
    await cleanupExpiredTicketFiles();
  } catch (error) {
    console.error('Error en limpieza de justificantes caducados:', error);
  }
});
