import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY existe:', !!process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testConnection() {
  console.log('\n=== Probando conexión a Supabase ===\n');
  
  // Intentar obtener usuarios
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error al conectar:', error.message);
    console.error('Detalles:', error);
  } else {
    console.log('✓ Conexión exitosa!');
    console.log(`✓ Encontrados ${data.length} usuarios:`);
    data.forEach(user => {
      console.log(`  - ${user.username} (${user.role})`);
    });
  }
  
  // Intentar login
  console.log('\n=== Probando login ===\n');
  const { data: loginData, error: loginError } = await supabase
    .from('users')
    .select('*')
    .eq('username', 'MarcosTBCF')
    .eq('password', '1111')
    .single();
    
  if (loginError) {
    console.error('❌ Error en login:', loginError.message);
  } else {
    console.log('✓ Login exitoso para MarcosTBCF');
    console.log('Datos:', loginData);
  }
}

testConnection();
