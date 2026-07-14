const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔍 Verificando usuario Pepe en Supabase...\n');
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', 'Pepe');
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.error('❌ Usuario no encontrado');
    return;
  }
  
  const user = data[0];
  console.log('Usuario encontrado:', user.username);
  console.log('Email:', user.email);
  console.log('Active:', user.active);
  console.log('Password hash:', user.password);
  
  console.log('\n🧪 Probando contraseña "1111" contra el hash...');
  
  const isValid = await bcrypt.compare('1111', user.password);
  console.log('¿Es válida?:', isValid);
  
  if (!isValid) {
    console.log('\n⚠️ La contraseña NO coincide. Actualizando...');
    const newHash = await bcrypt.hash('1111', 10);
    console.log('Nuevo hash:', newHash);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newHash })
      .eq('username', 'Pepe');
    
    if (updateError) {
      console.error('❌ Error al actualizar:', updateError);
    } else {
      console.log('✅ Contraseña actualizada!');
    }
  }
})();
