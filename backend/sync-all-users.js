import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

(async () => {
  // Leer usuarios del archivo local
  const localUsers = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));
  
  console.log('📋 Actualizando contraseñas de usuarios...\n');
  
  for (const user of localUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    
    // Buscar el usuario en Supabase
    const { data: existing, error: searchError } = await supabase
      .from('users')
      .select('id')
      .eq('username', user.username);
    
    if (searchError) {
      console.error(`❌ Error buscando ${user.username}:`, searchError);
      continue;
    }
    
    if (!existing || existing.length === 0) {
      // Crear usuario si no existe
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          username: user.username,
          password: hashedPassword,
          club_code: user.clubCode || '',
          role: user.role || 'voluntario',
          full_name: user.fullName || '',
          email: user.email || '',
          dni: user.dni || '',
          address: user.address || '',
          phone: user.phone || '',
          km: user.km || 0,
          active: true
        });
      
      if (insertError) {
        console.error(`❌ Error creando ${user.username}:`, insertError);
      } else {
        console.log(`✅ ${user.username} - CREADO (contraseña: ${user.password})`);
      }
    } else {
      // Actualizar contraseña si existe
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword, active: true })
        .eq('username', user.username);
      
      if (updateError) {
        console.error(`❌ Error actualizando ${user.username}:`, updateError);
      } else {
        console.log(`✅ ${user.username} - ACTUALIZADO (contraseña: ${user.password})`);
      }
    }
  }
  
  console.log('\n✅ Sincronización completada!');
})();
