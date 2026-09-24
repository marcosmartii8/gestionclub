import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import { cleanupTicketFiles } from './cleanup-ticket-files.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
const TICKET_BUCKET = 'formularios-archivos';

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
      service: 'tuGestClub backend',
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
const TICKET_CLEANUP_ENABLED = process.env.TICKET_CLEANUP_ENABLED === 'true';
const TICKET_CLEANUP_INTERVAL_MS = Number(process.env.TICKET_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000);



if (TICKET_CLEANUP_ENABLED) {
  setInterval(() => {
    cleanupTicketFiles({ execute: true }).catch((error) => {
      console.error('❌ Error en limpieza automática de tickets:', error.message);
    });
  }, TICKET_CLEANUP_INTERVAL_MS);
  console.log(`🧹 Limpieza automática de tickets activada cada ${TICKET_CLEANUP_INTERVAL_MS} ms`);
}

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
    .single();

  if (error || !data) {
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

    return next();
  };
}
// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
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
      .single();

    if (error || !data) {
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
      .single();

    if (targetUserError || !targetUser) {
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
      .select('username, club_code')
      .eq('username', req.params.username)
      .single();

    if (fetchError || !targetUser) {
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
      .single();

    if (fetchError || !userData) {
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
      .single();

    if (fetchError || !userData) {
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
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (!requester.clubCode) {
      return res.status(403).json({
        message: 'No se ha podido identificar el club del usuario'
      });
    }

    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('username, club_code')
      .eq('username', username)
      .single();

    if (fetchError || !userData) {
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
      .single();

    if (fetchError || !userData) {
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
      .single();

    if (error || !data) {
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
        .single();

      if (targetUserError || !targetUser) {
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
      const fileStem = baseName || uniquePart;
      const fileName = `${fileStem}.${extension}`;
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
      .select('username, club_code');

    if (isManagerRole(requester.role)) {
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
    if (users && Array.isArray(users)) {
      users.forEach(user => {
        if (user && user.username) {
          userClubMap[user.username] = user.club_code;
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
          .select('fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosTransporteError) {
          console.error(`❌ Error al obtener gastos de transporte para formulario ${form.id}:`, gastosTransporteError);
        } else {
          transportExpenses = (gastosTransporteData || []).map((gasto) => ({
            date: gasto.fecha,
            concept: gasto.concepto,
            amount: gasto.importe?.toString() || '0',
            fileUrl: gasto.archivo || null,
            url: gasto.archivo || null
          }));
        }

        const { data: gastosDietasData, error: gastosDietasError } = await supabase
          .from('gastos_dietas')
          .select('fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosDietasError) {
          console.error(`❌ Error al obtener gastos de dietas para formulario ${form.id}:`, gastosDietasError);
        } else {
          dietExpenses = (gastosDietasData || []).map((gasto) => ({
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

    if (isManagerRole(requester.role)) {
      formulariosFiltrados = formulariosConClub.filter((form) => form.clubCode === requester.clubCode);
    } else if (requester.role === 'voluntario') {
      formulariosFiltrados = formulariosConClub.filter((form) => form.username === requester.username);
    } else {
      return res.status(403).json({ message: 'Rol no autorizado para consultar formularios' });
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

    if (isManagerRole(requester.role)) {
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
          .select('fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosTransporteError) {
          console.error(`❌ Error al obtener gastos de transporte para formulario ${form.id}:`, gastosTransporteError);
        } else {
          transportExpenses = (gastosTransporteData || []).map((gasto) => ({
            date: gasto.fecha,
            concept: gasto.concepto,
            amount: gasto.importe?.toString() || '0',
            fileUrl: gasto.archivo || null,
            url: gasto.archivo || null
          }));
        }

        const { data: gastosDietasData, error: gastosDietasError } = await supabase
          .from('gastos_dietas')
          .select('fecha, concepto, importe, archivo')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (gastosDietasError) {
          console.error(`❌ Error al obtener gastos de dietas para formulario ${form.id}:`, gastosDietasError);
        } else {
          dietExpenses = (gastosDietasData || []).map((gasto) => ({
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

    if (isManager) {
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

    console.log('✅ Guardado exitoso:', data);
    res.json({ message: 'Formulario guardado exitosamente', formulario: data });
  } catch (error) {
    console.error('❌ Error al guardar formulario:', error);
    res.status(400).json({ message: 'Error al guardar formulario', error: error.message });
  }
});

app.patch('/api/formularios/:username/:year/:month/completar', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  const { username, year, month } = req.params;
  const requester = req.requester || getRequesterIdentity(req);
  const completed = req.body?.completed !== false;

  try {
    if (isManagerRole(requester.role)) {
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

    const { error } = await supabase
      .from('formularios')
      .delete()
      .eq('username', username)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month));

    if (error) throw error;

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
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`✓ También accesible desde: http://192.168.0.24:${PORT}`);
  console.log('✓ Conectado a Supabase');
});
