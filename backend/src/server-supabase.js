
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));


// Frontend static folder
const frontendPath = path.resolve(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

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
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Verificar contraseña con bcrypt
    const storedPassword = data.password || '';
    let validPassword = false;

    if (storedPassword.startsWith('$2')) {
      // Es un hash bcrypt
      validPassword = await bcrypt.compare(password, storedPassword);
    } else {
      // Comparación en texto plano (fallback para contraseñas antiguas)
      validPassword = storedPassword === password;
    }

    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        username: data.username,
        role: data.role,
        clubCode: data.club_code
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

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
      },
      token: token,
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRES_IN
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
      .select();

    if (error) throw error;

    // data es un array, devolvemos el primer usuario actualizado
    res.json({ message: 'Usuario actualizado exitosamente', user: data && data[0] });
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

    // Mapear los formularios con el club_code correspondiente y desplazamientos
    const formularios = await Promise.all(
      formulariosData.map(async (form) => {
        // Obtener desplazamientos para este formulario
        const { data: desplazamientosData, error: despError } = await supabase
          .from('desplazamientos')
          .select('*')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        // Obtener gastos de transporte para este formulario
        const { data: gastosData, error: gastosError } = await supabase
          .from('gastos_transporte')
          .select('*')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (despError) console.error('Error obteniendo desplazamientos:', despError);
        if (gastosError) console.error('Error obteniendo gastos:', gastosError);

        // Mapear a formato esperado por frontend
        const desplazamientos = (desplazamientosData || []).map(desp => ({
          date: desp.fecha,
          locality: desp.localidad,
          place: desp.lugar,
          km: desp.km.toString()
        }));

        const gastosTransporte = (gastosData || []).map(gasto => ({
          date: gasto.fecha,
          concept: gasto.concepto,
          amount: gasto.importe.toString(),
          fileUrl: gasto.archivo
        }));

        return {
          username: form.username,
          year: form.year,
          month: form.month,
          clubCode: userClubMap[form.username] || null,
          trainingAttendance: form.asistencia || 0,
          matches: desplazamientos,
          transportExpenses: gastosTransporte,
          dietExpenses: form.gastos_dietas || [],
          weeksInMonth: form.semanas || 0,
          // También incluir los nombres antiguos por compatibilidad
          asistencia: form.asistencia,
          desplazamientos: desplazamientos,
          gastosTransporte: gastosTransporte,
          gastosDietas: form.gastos_dietas,
          semanas: form.semanas
        };
      })
    );

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

    // Obtener desplazamientos para cada formulario
    const formularios = await Promise.all(
      data.map(async (form) => {
        const { data: desplazamientosData, error: despError } = await supabase
          .from('desplazamientos')
          .select('*')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        const { data: gastosData, error: gastosError } = await supabase
          .from('gastos_transporte')
          .select('*')
          .eq('formulario_id', form.id)
          .order('fecha', { ascending: true });

        if (despError) console.error('Error obteniendo desplazamientos:', despError);
        if (gastosError) console.error('Error obteniendo gastos:', gastosError);

        // Mapear los datos a los campos esperados por el frontend
        const desplazamientos = (desplazamientosData || []).map(desp => ({
          date: desp.fecha,
          locality: desp.localidad,
          place: desp.lugar,
          km: desp.km.toString()
        }));

        const gastosTransporte = (gastosData || []).map(gasto => ({
          date: gasto.fecha,
          concept: gasto.concepto,
          amount: gasto.importe.toString(),
          fileUrl: gasto.archivo
        }));

        return {
          username: form.username,
          year: form.year,
          month: form.month,
          asistencia: form.asistencia,
          desplazamientos: desplazamientos,
          gastosTransporte: gastosTransporte,
          gastosDietas: form.gastos_dietas,
          semanas: form.semanas
        };
      })
    );

    res.json(formularios);
  } catch (error) {
    console.error('Error al obtener formularios:', error);
    res.status(500).json({ message: 'Error al obtener formularios', error: error.message });
  }
});

app.post('/api/formularios', async (req, res) => {
  const { username, year, month, asistencia, desplazamientos, gastosTransporte, gastosDietas, semanas } = req.body;

  try {
    console.log('📝 Guardando formulario:', { username, year, month });
    console.log('📍 Desplazamientos recibidos:', desplazamientos);
    console.log('💰 Gastos de transporte recibidos:', gastosTransporte);

    // 1. Guardar o actualizar el formulario principal
    const { data: formData, error: formError } = await supabase
      .from('formularios')
      .upsert({
        username,
        year,
        month,
        asistencia: asistencia || 0,
        gastos_transporte: null,
        gastos_dietas: gastosDietas || [],
        semanas: semanas || 0,
        desplazamientos: [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'username,year,month' })
      .select()
      .single();

    if (formError) throw formError;

    console.log('✅ Formulario guardado con ID:', formData?.id);

    // 2. Eliminar y guardar desplazamientos
    const { error: deleteDesplError } = await supabase
      .from('desplazamientos')
      .delete()
      .eq('formulario_id', formData.id);

    if (deleteDesplError) console.error('❌ Error eliminando desplazamientos anteriores:', deleteDesplError);

    if (desplazamientos && desplazamientos.length > 0) {
      const desplazamientosData = desplazamientos.map(desp => ({
        formulario_id: formData.id,
        fecha: desp.date,
        km: parseFloat(desp.km) || 0,
        lugar: desp.place,
        localidad: desp.locality
      }));

      console.log('📤 Insertando desplazamientos:', desplazamientosData);

      const { error: insertDesplError, data: insertDesplData } = await supabase
        .from('desplazamientos')
        .insert(desplazamientosData)
        .select();

      if (insertDesplError) {
        console.error('❌ Error insertando desplazamientos:', insertDesplError);
        throw insertDesplError;
      }
      console.log('✅ Desplazamientos insertados:', insertDesplData);
    } else {
      console.log('ℹ️ No hay desplazamientos para insertar');
    }

    // 3. Eliminar y guardar gastos de transporte
    const { error: deleteGastosError } = await supabase
      .from('gastos_transporte')
      .delete()
      .eq('formulario_id', formData.id);

    if (deleteGastosError) console.error('❌ Error eliminando gastos anteriores:', deleteGastosError);

    if (gastosTransporte && gastosTransporte.length > 0) {
      const gastosData = gastosTransporte.map(gasto => ({
        formulario_id: formData.id,
        fecha: gasto.date,
        importe: parseFloat(gasto.amount) || 0,
        concepto: gasto.concept,
        archivo: gasto.fileUrl || null
      }));

      console.log('📤 Insertando gastos de transporte:', gastosData);

      const { error: insertGastosError, data: insertGastosData } = await supabase
        .from('gastos_transporte')
        .insert(gastosData)
        .select();

      if (insertGastosError) {
        console.error('❌ Error insertando gastos de transporte:', insertGastosError);
        throw insertGastosError;
      }
      console.log('✅ Gastos de transporte insertados:', insertGastosData);
    } else {
      console.log('ℹ️ No hay gastos de transporte para insertar');
    }

    // 4. Eliminar y guardar gastos de dietas
    const { error: deleteGastosDietasError } = await supabase
      .from('gastos_dietas')
      .delete()
      .eq('formulario_id', formData.id);

    if (deleteGastosDietasError) console.error('❌ Error eliminando gastos de dietas anteriores:', deleteGastosDietasError);

    if (gastosDietas && gastosDietas.length > 0) {
      const gastosDietasData = gastosDietas.map(gasto => ({
        formulario_id: formData.id,
        fecha: gasto.date,
        importe: parseFloat(gasto.amount) || 0,
        concepto: gasto.concept,
        archivo: gasto.fileUrl || null
      }));

      console.log('📤 Insertando gastos de dietas:', gastosDietasData);

      const { error: insertGastosDietasError, data: insertGastosDietasData } = await supabase
        .from('gastos_dietas')
        .insert(gastosDietasData)
        .select();

      if (insertGastosDietasError) {
        console.error('❌ Error insertando gastos de dietas:', insertGastosDietasError);
        throw insertGastosDietasError;
      }
      console.log('✅ Gastos de dietas insertados:', insertGastosDietasData);
    } else {
      console.log('ℹ️ No hay gastos de dietas para insertar');
    }

    res.json({ message: 'Formulario guardado exitosamente', formulario: formData });
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
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log('✓ Conectado a Supabase');
});
