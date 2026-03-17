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
app.use(express.static(frontendPath));

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
      return res.status(401).json({ message: 'Credenciales inválidas' });
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
        km: data.km
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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
      km: user.km ? user.km.toString() : ''
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
    res.status(400).json({ message: 'Error al crear usuario', error: error.message });
  }
});

app.put('/api/users/:username', async (req, res) => {
  const { password, clubCode, role, fullName, email, dni, address, phone, km } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .update({
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
      .eq('username', req.params.username)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Usuario actualizado exitosamente', user: data });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(400).json({ message: 'Error al actualizar usuario', error: error.message });
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

// ========== CLUBS ==========
app.get('/api/clubs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('club_code');

    if (error) throw error;

    const clubs = data.map(club => ({
      club_code: club.club_code,
      club_name: club.club_name,
      created_at: club.created_at
    }));

    res.json(clubs);
  } catch (error) {
    console.error('Error al obtener clubs:', error);
    res.status(500).json({ message: 'Error al obtener clubs', error: error.message });
  }
});

// ========== FORMULARIOS ==========
app.get('/api/formularios', async (req, res) => {
  try {
    // Primero obtener todos los usuarios para tener el mapeo username -> club_code
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('username, club_code');

    if (usersError) {
      console.error('Error al obtener usuarios:', usersError);
      return res.status(500).json({ message: 'Error al obtener usuarios', error: usersError.message });
    }

    // Crear un mapa de username -> club_code
    const userClubMap = {};
    usersData.forEach(user => {
      userClubMap[user.username] = user.club_code;
    });

    // Obtener todos los formularios
    const { data: formulariosData, error: formError } = await supabase
      .from('formularios')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (formError) {
      console.error('Error al obtener formularios:', formError);
      return res.status(500).json({ message: 'Error al obtener formularios', error: formError.message });
    }

    // Mapear los formularios con el club_code correspondiente
    const formularios = formulariosData.map(form => ({
      username: form.username,
      year: form.year,
      month: form.month,
      clubCode: userClubMap[form.username] || null,
      trainingAttendance: form.asistencia || 0,
      matches: form.desplazamientos || [],
      transportExpenses: form.gastos_transporte || [],
      dietExpenses: form.gastos_dietas || [],
      weeksInMonth: form.semanas || 0,
      // También incluir los nombres antiguos por compatibilidad
      asistencia: form.asistencia,
      desplazamientos: form.desplazamientos,
      gastosTransporte: form.gastos_transporte,
      gastosDietas: form.gastos_dietas,
      semanas: form.semanas
    }));

    res.json(formularios);
  } catch (error) {
    console.error('Error al obtener formularios:', error);
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

    const formularios = data.map(form => ({
      username: form.username,
      year: form.year,
      month: form.month,
      asistencia: form.asistencia,
      desplazamientos: form.desplazamientos,
      gastosTransporte: form.gastos_transporte,
      gastosDietas: form.gastos_dietas,
      semanas: form.semanas
    }));

    res.json(formularios);
  } catch (error) {
    console.error('Error al obtener formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.post('/api/formularios', async (req, res) => {
  const { username, year, month, asistencia, desplazamientos, gastosTransporte, gastosDietas, semanas } = req.body;

  try {
    const { data, error } = await supabase
      .from('formularios')
      .upsert({
        username,
        year,
        month,
        asistencia: asistencia || 0,
        desplazamientos: desplazamientos || [],
        gastos_transporte: gastosTransporte || [],
        gastos_dietas: gastosDietas || [],
        semanas: semanas || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'username,year,month' })
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Formulario guardado exitosamente', formulario: data });
  } catch (error) {
    console.error('Error al guardar formulario:', error);
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
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log('✓ Conectado a Supabase');
});
