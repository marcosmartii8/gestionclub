import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

(async () => {
  const users = [
    { username: 'Pepe', password: '1111' },
    { username: 'MarcosTBCF', password: '1111' },
    { username: 'adminTBCF', password: '1111' }
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('username', user.username);
    
    if (error) {
      console.error(`❌ Error actualizando ${user.username}:`, error);
    } else {
      console.log(`✅ ${user.username} - contraseña: ${user.password}`);
    }
  }
  
  console.log('\n✅ Contraseñas actualizadas. Intenta iniciar sesión con:');
  console.log('Usuario: Pepe\nContraseña: 1111');
})();
