import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const AUTHZ_ENFORCE = process.env.AUTHZ_ENFORCE === 'true';
const AUTH_ALLOW_LEGACY_HEADERS = process.env.AUTH_ALLOW_LEGACY_HEADERS === 'true';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.24:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isPrivateNetworkOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    if (/^10\./.test(hostname)) {
      return true;
    }

    if (/^192\.168\./.test(hostname)) {
      return true;
    }

    const match172 = hostname.match(/^172\.(\d+)\./);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    // Permitir requests sin Origin (curl, herramientas locales, mismo host servidor-servidor)
    if (!origin) return callback(null, true);

    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    if (isPrivateNetworkOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`❌ CORS bloqueado para origin no permitido: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend static folder
const frontendPath = path.resolve(__dirname, "../../frontend");
console.log('Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Ruta raíz - servir inicio_app.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'inicio_app.html'));
});

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const BCRYPT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no definido. Usa uno robusto en producción.');
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

  if (AUTH_ALLOW_LEGACY_HEADERS) {
    // Fallback temporal controlado por entorno para no romper transición.
    const username = req.header('x-user-name') || req.header('x-username') || '';
    const role = (req.header('x-user-role') || '').toLowerCase().trim();
    const clubCode = req.header('x-user-club') || '';
    return { username, role, clubCode, source: 'headers' };
  }

  return { username: '', role: '', clubCode: '', source: 'none' };
}

function requireRole(roles) {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  return (req, res, next) => {
    const requester = getRequesterIdentity(req);
    req.requester = requester;
    const hasAllowedRole = requester.role && normalizedRoles.includes(requester.role);

    if (hasAllowedRole) {
      return next();
    }

    console.warn(
      `⚠️ Acceso sin rol autorizado detectado: ${req.method} ${req.originalUrl} ` +
      `role='${requester.role || 'none'}' user='${requester.username || 'unknown'}' enforce=${AUTHZ_ENFORCE}`
    );

    if (AUTHZ_ENFORCE) {
      return res.status(403).json({
        message: 'Acceso denegado por política de seguridad',
        requiredRoles: roles
      });
    }

    // Modo observación: no bloquear para evitar romper flujos actuales.
    return next();
  };
}

function isManagerRole(role) {
  const normalizedRole = (role || '').toLowerCase().trim();
  return normalizedRole === 'lider' || normalizedRole === 'administrador';
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

function requireAuthenticated(req, res, next) {
  const requester = getRequesterIdentity(req);
  req.requester = requester;

  if (requester.username) {
    return next();
  }

  if (AUTHZ_ENFORCE) {
    return res.status(401).json({ message: 'Autenticación requerida' });
  }

  // Modo observación: permitir para no romper mientras se completa migración.
  return next();
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

    if (AUTHZ_ENFORCE) {
      return res.status(403).json({
        message: 'Acceso denegado por política de seguridad',
        required: `self o rol (${roles.join(', ')})`
      });
    }

    return next();
  };
}

async function isPasswordInUse(password, excludeUsername = null) {
  const { data: usersData, error } = await supabase
    .from('users')
    .select('username, password');

  if (error) {
    throw error;
  }

  for (const user of usersData || []) {
    if (excludeUsername && user.username === excludeUsername) {
      continue;
    }

    const storedPassword = user.password || '';
    if (!storedPassword) {
      continue;
    }

    if (isBcryptHash(storedPassword)) {
      if (await bcrypt.compare(password, storedPassword)) {
        return true;
      }
    } else if (storedPassword === password) {
      return true;
    }
  }

  return false;
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
    let validPassword = false;

    if (isBcryptHash(storedPassword)) {
      validPassword = await bcrypt.compare(password, storedPassword);
    } else {
      validPassword = storedPassword === password;
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Migración progresiva: si la contraseña aún está en texto plano, la actualizamos a hash.
    if (!isBcryptHash(storedPassword)) {
      const migratedHash = await hashPassword(password);
      const { error: migrationError } = await supabase
        .from('users')
        .update({ password: migratedHash })
        .eq('username', username);

      if (migrationError) {
        console.error('Error migrando password a hash:', migrationError);
      }
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('username');

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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', req.params.username)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(mapUserForClient(data, true));
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

app.post('/api/users', requireRole(['lider']), async (req, res) => {
  const { username, password, clubCode, role, fullName, email, dni, address, phone, km } = req.body;

  try {
    // Validar longitud mínima de contraseña
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar que la contraseña no esté en uso
    if (await isPasswordInUse(password)) {
      return res.status(400).json({ error: 'Esta contraseña ya está en uso. Por favor, elige otra diferente' });
    }

    const hashedPassword = await hashPassword(password);

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        club_code: clubCode,
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
  const { username: newUsername, password, clubCode, role, fullName, email, dni, address, phone, km } = req.body;
  const requester = req.requester || getRequesterIdentity(req);
  const isLeader = requester.role === 'lider';

  try {
    // Si se proporciona una nueva contraseña, validarla
    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }

      // Verificar que la contraseña no esté en uso por otro usuario
      if (await isPasswordInUse(password, oldUsername)) {
        return res.status(400).json({ error: 'Esta contraseña ya está en uso. Por favor, elige otra diferente' });
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
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
      }

      // Obtener todos los datos del usuario actual
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('username', oldUsername)
        .single();

      if (fetchError || !currentUser) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Crear un nuevo usuario con el nuevo username y los datos actualizados
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          username: newUsername,
          password: password ? await hashPassword(password) : currentUser.password,
          club_code: clubCode !== undefined ? clubCode : currentUser.club_code,
          role: role || currentUser.role,
          full_name: fullName !== undefined ? fullName : currentUser.full_name,
          email: email !== undefined ? email : currentUser.email,
          dni: dni !== undefined ? dni : currentUser.dni,
          address: address !== undefined ? address : currentUser.address,
          phone: phone !== undefined ? phone : currentUser.phone,
          km: km !== undefined ? (km ? parseInt(km) : null) : currentUser.km,
          active: currentUser.active
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Eliminar el usuario antiguo
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('username', oldUsername);

      if (deleteError) throw deleteError;

      return res.json({ message: 'Usuario actualizado exitosamente', user: mapUserForClient(newUser, true) });
    }

    // Si no se cambia el username, solo actualizar los campos proporcionados
    const updateData = {};
    if (password !== undefined) updateData.password = await hashPassword(password);

    // Solo líder puede cambiar rol y club_code.
    if (isLeader && clubCode !== undefined) updateData.club_code = clubCode;
    if (isLeader && role !== undefined) updateData.role = role;

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
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('username', req.params.username);

    if (error) throw error;

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario', error: error.message });
  }
});

// Eliminar permanentemente un ex-miembro junto con todos sus formularios
app.delete('/api/users/:username/permanent', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;

    // Verificar que el usuario existe y tiene left_at (es ex-miembro)
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('username, left_at')
      .eq('username', username)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!userData.left_at) {
      return res.status(400).json({ message: 'Solo se pueden eliminar permanentemente ex-miembros dados de baja' });
    }

    // Obtener IDs de formularios del usuario
    const { data: formularios } = await supabase
      .from('formularios')
      .select('id')
      .eq('username', username);

    const formularioIds = (formularios || []).map(f => f.id);

    if (formularioIds.length > 0) {
      // Eliminar subtablas en orden
      await supabase.from('desplazamientos').delete().in('formulario_id', formularioIds);
      await supabase.from('gastos_transporte').delete().in('formulario_id', formularioIds);
      await supabase.from('gastos_dietas').delete().in('formulario_id', formularioIds);
      await supabase.from('formularios').delete().in('id', formularioIds);
    }

    // Eliminar el usuario
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('username', username);

    if (deleteError) throw deleteError;

    res.json({ message: `Usuario ${username} y sus formularios eliminados permanentemente` });
  } catch (error) {
    console.error('Error al eliminar usuario permanentemente:', error);
    res.status(500).json({ message: 'Error al eliminar usuario', error: error.message });
  }
});

// Endpoint para cambiar el estado activo del usuario
app.patch('/api/users/:username/toggle-access', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;
    
    // Obtener el estado actual
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('active')
      .eq('username', username)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Alternar el estado activo
    const newActiveState = userData.active === false ? true : false;
    
    const { data, error } = await supabase
      .from('users')
      .update({ active: newActiveState })
      .eq('username', username)
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
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const { error } = await supabase
      .from('users')
      .update({ left_at: today })
      .eq('username', username);

    if (error) throw error;

    res.json({ message: 'Usuario dado de baja del club', leftAt: today });
  } catch (error) {
    res.status(500).json({ message: 'Error al dar de baja', error: error.message });
  }
});

// Readmitir a un usuario al club
app.patch('/api/users/:username/readmit', requireRole(['lider', 'administrador']), async (req, res) => {
  try {
    const { username } = req.params;

    const { error } = await supabase
      .from('users')
      .update({ left_at: null })
      .eq('username', username);

    if (error) throw error;

    res.json({ message: 'Usuario readmitido en el club' });
  } catch (error) {
    res.status(500).json({ message: 'Error al readmitir', error: error.message });
  }
});

// ========== CLUBES ==========
app.get('/api/clubs', async (req, res) => {
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

app.post('/api/clubs', requireRole(['lider']), async (req, res) => {
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

app.patch('/api/clubs/:club_code', requireRole(['lider']), async (req, res) => {
  try {
    // DESPUÉS
// DESPUÉS
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
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error al actualizar club:', error);
    res.status(500).json({ message: 'Error al actualizar club', error: error.message });
  }
});

app.delete('/api/clubs/:club_code', requireRole(['lider']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('club_code', req.params.club_code);

    if (error) throw error;

    res.json({ message: 'Club eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar club:', error);
    res.status(500).json({ message: 'Error al eliminar club', error: error.message });
  }
});

// ========== FORMULARIOS ==========
app.get('/api/formularios', requireAuthenticated, async (req, res) => {
  try {
    console.log('📋 Obteniendo todos los formularios...');
    
    // Obtener todos los formularios
    const { data: formularios, error: formError } = await supabase
      .from('formularios')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (formError) {
      console.error('❌ Error al obtener formularios:', formError);
      return res.status(500).json({ message: 'Error al obtener formularios', error: formError.message });
    }
    
    console.log(`✓ ${formularios?.length || 0} formularios encontrados`);

    // Obtener todos los usuarios para mapear clubCode
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('username, club_code');

    if (userError) {
      console.error('❌ Error al obtener usuarios:', userError);
      return res.status(500).json({ message: 'Error al obtener usuarios', error: userError.message });
    }
    
    console.log(`✓ ${users?.length || 0} usuarios encontrados`);

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
        matches,
        trainingAttendance: form.asistencia || 0,
        transportExpenses,
        dietExpenses,
        weeksInMonth: form.semanas || 0
      };
    }));
    
    console.log(`✓ Formularios procesados con clubCode: ${formulariosConClub.length}`);

    const requester = req.requester || getRequesterIdentity(req);
    let formulariosFiltrados = formulariosConClub;

    if (isManagerRole(requester.role)) {
      formulariosFiltrados = formulariosConClub.filter((form) => form.clubCode === requester.clubCode);
    } else if (requester.role === 'voluntario') {
      formulariosFiltrados = formulariosConClub.filter((form) => form.username === requester.username);
    } else if (AUTHZ_ENFORCE) {
      return res.status(403).json({ message: 'Rol no autorizado para consultar formularios' });
    }

    res.json(formulariosFiltrados);
  } catch (error) {
    console.error('❌ Error en /api/formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.get('/api/formularios/:username', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  try {
    const requester = req.requester || getRequesterIdentity(req);
    const targetUsername = req.params.username;

    if (isManagerRole(requester.role)) {
      const targetClubCode = await fetchUserClubCode(targetUsername);
      if (requester.clubCode && targetClubCode && requester.clubCode !== targetClubCode) {
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
        matches,
        trainingAttendance: form.asistencia || 0,
        transportExpenses,
        dietExpenses,
        weeksInMonth: form.semanas || 4,
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
  const { username, year, month, asistencia, desplazamientos, gastosTransporte, gastosDietas, semanas } = req.body;
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
      if (requester.clubCode && targetClubCode && requester.clubCode !== targetClubCode) {
        return res.status(403).json({ message: 'No autorizado para guardar formularios de otro club' });
      }
    }

    const formularioData = {
      username,
      year: parseInt(year),
      month: parseInt(month),
      asistencia: parseInt(asistencia || 0),
      // La tabla formularios ya no es la fuente de verdad para desplazamientos.
      // Se gestionan en la tabla desplazamientos usando formulario_id.
      desplazamientos: [],
      // Los gastos de transporte se gestionan en la tabla gastos_transporte.
      gastos_transporte: [],
      // Los gastos de dietas se gestionan en la tabla gastos_dietas.
      gastos_dietas: [],
      semanas: parseInt(semanas || 0),
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

app.delete('/api/formularios/:username/:year/:month', requireAuthenticated, requireSelfOrRole('username', ['lider', 'administrador']), async (req, res) => {
  const { username, year, month } = req.params;
  const requester = req.requester || getRequesterIdentity(req);

  try {
    if (isManagerRole(requester.role)) {
      const targetClubCode = await fetchUserClubCode(username);
      if (requester.clubCode && targetClubCode && requester.clubCode !== targetClubCode) {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`✓ También accesible desde: http://192.168.0.24:${PORT}`);
  console.log('✓ Conectado a Supabase');
});
