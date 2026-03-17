import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend static folder
const frontendPath = path.resolve(__dirname, "../../frontend");
console.log('Serving frontend from:', frontendPath);
app.use(express.static(frontendPath));

// Ruta raíz - redirigir a inicio
app.get('/', (req, res) => {
  res.redirect('/inicio_app1.html');
});

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar si el usuario está activo
    if (data.active !== true) {
      return res.status(403).json({ error: 'Acceso denegado. Usuario desactivado.' });
    }

    res.json({
      user: {
        username: data.username,
        role: data.role,
        clubCode: data.club_code,
        fullName: data.full_name,
        email: data.email,
        dni: data.dni,
        address: data.address,
        phone: data.phone,
        km: data.km ? data.km.toString() : ''
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ========== USUARIOS ==========
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('username');

    if (error) throw error;

    const users = data.map(user => ({
      username: user.username,
      password: user.password,
      clubCode: user.club_code,
      role: user.role,
      fullName: user.full_name || '',
      email: user.email || '',
      dni: user.dni || '',
      address: user.address || '',
      phone: user.phone || '',
      km: user.km ? user.km.toString() : '',
      active: user.active !== false
    }));

    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

app.get('/api/users/:username', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', req.params.username)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      username: data.username,
      password: data.password,
      clubCode: data.club_code,
      role: data.role,
      fullName: data.full_name || '',
      email: data.email || '',
      dni: data.dni || '',
      address: data.address || '',
      phone: data.phone || '',
      km: data.km ? data.km.toString() : ''
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, clubCode, role, fullName, email, dni, address, phone, km } = req.body;

  try {
    // Validar longitud mínima de contraseña
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar que la contraseña no esté en uso
    const { data: existingPassword } = await supabase
      .from('users')
      .select('username')
      .eq('password', password)
      .single();

    if (existingPassword) {
      return res.status(400).json({ error: 'Esta contraseña ya está en uso. Por favor, elige otra diferente' });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password,
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

    res.status(201).json({ message: 'Usuario creado exitosamente', user: data });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(400).json({ error: 'Error al crear usuario: ' + error.message });
  }
});

app.put('/api/users/:username', async (req, res) => {
  const oldUsername = req.params.username;
  const { username: newUsername, password, clubCode, role, fullName, email, dni, address, phone, km } = req.body;

  try {
    // Si se proporciona una nueva contraseña, validarla
    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }

      // Verificar que la contraseña no esté en uso por otro usuario
      const { data: existingPassword } = await supabase
        .from('users')
        .select('username')
        .eq('password', password)
        .neq('username', oldUsername)
        .single();

      if (existingPassword) {
        return res.status(400).json({ error: 'Esta contraseña ya está en uso. Por favor, elige otra diferente' });
      }
    }

    // Si se proporciona un nuevo username diferente al actual
    if (newUsername && newUsername !== oldUsername) {
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
          password: password || currentUser.password,
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

      return res.json({ message: 'Usuario actualizado exitosamente', user: newUser });
    }

    // Si no se cambia el username, solo actualizar los campos proporcionados
    const updateData = {};
    if (password !== undefined) updateData.password = password;
    if (clubCode !== undefined) updateData.club_code = clubCode;
    if (role !== undefined) updateData.role = role;
    if (fullName !== undefined) updateData.full_name = fullName;
    if (email !== undefined) updateData.email = email;
    if (dni !== undefined) updateData.dni = dni;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (km !== undefined) updateData.km = km ? parseInt(km) : null;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('username', oldUsername)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Usuario actualizado exitosamente', user: data });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(400).json({ error: 'Error al actualizar usuario: ' + error.message });
  }
});

app.delete('/api/users/:username', async (req, res) => {
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

// Endpoint para cambiar el estado activo del usuario
app.patch('/api/users/:username/toggle-access', async (req, res) => {
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

app.post('/api/clubs', async (req, res) => {
  try {
    const { club_code, club_name } = req.body;

    if (!club_code || !club_name) {
      return res.status(400).json({ message: 'Código y nombre del club son requeridos' });
    }

    const { data, error } = await supabase
      .from('clubs')
      .insert([{ club_code, club_name }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error al crear club:', error);
    res.status(500).json({ message: 'Error al crear club', error: error.message });
  }
});

app.patch('/api/clubs/:club_code', async (req, res) => {
  try {
    const { club_name } = req.body;

    const { data, error } = await supabase
      .from('clubs')
      .update({ club_name })
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

app.delete('/api/clubs/:club_code', async (req, res) => {
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
app.get('/api/formularios', async (req, res) => {
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
    const formulariosConClub = (formularios || []).map(form => ({
      ...form,
      clubCode: userClubMap[form.username] || null,
      matches: form.desplazamientos || [],
      trainingAttendance: form.asistencia || 0,
      transportExpenses: form.gastos_transporte || [],
      dietExpenses: form.gastos_dietas || [],
      weeksInMonth: form.semanas || 0
    }));
    
    console.log(`✓ Formularios procesados con clubCode: ${formulariosConClub.length}`);

    res.json(formulariosConClub);
  } catch (error) {
    console.error('❌ Error en /api/formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.get('/api/formularios/:username', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('formularios')
      .select('*')
      .eq('username', req.params.username)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    // Mapear los campos de snake_case a camelCase para el frontend
    const formularios = data.map(form => ({
      ...form,
      matches: form.desplazamientos || [],
      trainingAttendance: form.asistencia || 0,
      transportExpenses: form.gastos_transporte || [],
      dietExpenses: form.gastos_dietas || [],
      weeksInMonth: form.semanas || 4,
      // Mantener compatibilidad con nombres anteriores
      gastosTransporte: form.gastos_transporte || [],
      gastosDietas: form.gastos_dietas || []
    }));

    res.json(formularios);
  } catch (error) {
    console.error('Error al obtener formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.post('/api/formularios', async (req, res) => {
  const { username, year, month, asistencia, desplazamientos, gastosTransporte, gastosDietas, semanas } = req.body;

  console.log('📝 Datos recibidos:', {
    username, year, month, asistencia, desplazamientos, gastosTransporte, gastosDietas, semanas
  });

  try {
    const formularioData = {
      username,
      year: parseInt(year),
      month: parseInt(month),
      asistencia: parseInt(asistencia || 0),
      desplazamientos: desplazamientos || [],
      gastos_transporte: gastosTransporte || [],
      gastos_dietas: gastosDietas || [],
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

    console.log('✅ Guardado exitoso:', data);
    res.json({ message: 'Formulario guardado exitosamente', formulario: data });
  } catch (error) {
    console.error('❌ Error al guardar formulario:', error);
    res.status(400).json({ message: 'Error al guardar formulario', error: error.message });
  }
});

app.delete('/api/formularios/:username/:year/:month', async (req, res) => {
  const { username, year, month } = req.params;

  try {
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
