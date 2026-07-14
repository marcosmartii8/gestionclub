const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('🔍 Probando login con Pepe / 1111...\n');
    
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: 'Pepe', 
        password: '1111' 
      })
    });
    
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers));
    
    const data = await response.json();
    console.log('\nRespuesta:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ LOGIN EXITOSO!');
    } else {
      console.log('\n❌ Error en login:', data.error || 'Error desconocido');
    }
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
  }
}

testLogin();
