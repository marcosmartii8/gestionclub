import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'configurada' : 'NO configurada');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateUsers() {
  console.log('Migrando usuarios...');
  
  const usersData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf8')
  );

  for (const user of usersData) {
    // Saltar usuarios sin username o datos incompletos
    if (!user.username || !user.password || !user.clubCode || !user.role) {
      console.log(`⚠ Usuario sin datos obligatorios, saltando:`, user);
      continue;
    }

    const { error } = await supabase
      .from('users')
      .insert({
        username: user.username,
        password: user.password,
        club_code: user.clubCode,
        role: user.role,
        full_name: user.fullName || null,
        email: user.email || null,
        dni: user.dni || null,
        address: user.address || null,
        phone: user.phone || null,
        km: user.km ? parseInt(user.km) : null
      });

    if (error) {
      console.error(`❌ Error al insertar ${user.username}:`, error.message);
    } else {
      console.log(`✓ Usuario ${user.username} migrado`);
    }
  }
}

async function migrateFormularios() {
  console.log('\nMigrando formularios...');
  
  const formulariosPath = path.join(__dirname, 'data', 'formularios.json');
  
  if (!fs.existsSync(formulariosPath)) {
    console.log('No hay formularios para migrar');
    return;
  }

  const formulariosData = JSON.parse(
    fs.readFileSync(formulariosPath, 'utf8')
  );

  for (const form of formulariosData) {
    const { error } = await supabase
      .from('formularios')
      .insert({
        username: form.username,
        year: form.year,
        month: form.month,
        asistencia: form.asistencia || 0,
        desplazamientos: form.desplazamientos || [],
        gastos_transporte: form.gastosTransporte || [],
        gastos_dietas: form.gastosDietas || [],
        semanas: form.semanas || 0
      });

    if (error) {
      console.error(`❌ Error al insertar formulario ${form.username}-${form.year}-${form.month}:`, error.message);
    } else {
      console.log(`✓ Formulario ${form.username}-${form.year}-${form.month} migrado`);
    }
  }
}

async function main() {
  console.log('Iniciando migración a Supabase...\n');
  
  await migrateUsers();
  await migrateFormularios();
  
  console.log('\n¡Migración completada!');
}

main().catch(console.error);