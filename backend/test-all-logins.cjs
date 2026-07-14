const fetch = require('node-fetch');

async function testLogin(username, password) {
  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${username} - LOGIN EXITOSO`);
      return true;
    } else {
      console.log(`❌ ${username} - ${data.message || 'Error desconocido'}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ ${username} - Error de conexión: ${err.message}`);
    return false;
  }
}

(async () => {
  console.log('🧪 Probando login de todos los usuarios...\n');
  
  const users = [
    { username: 'adminTBCF', password: '1111' },
    { username: 'Pepe', password: '1111' },
    { username: 'MarcosTBCF', password: '1111' },
    { username: 'adminLider', password: '82801' }
  ];
  
  let success = 0;
  for (const user of users) {
    if (await testLogin(user.username, user.password)) {
      success++;
    }
    await new Promise(r => setTimeout(r, 500)); // Delay para no sobrecargar
  }
  
  console.log(`\n📊 Resultado: ${success}/${users.length} usuarios funcionando`);
})();
