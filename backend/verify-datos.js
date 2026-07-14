import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarDatos() {
  try {
    console.log('🔍 Verificando datos en tabla formularios para MarcosTBCF 2026-06 (junio)...\n');
    
    // 1. Ver el registro en formularios
    const { data: formulario, error: formError } = await supabase
      .from('formularios')
      .select('*')
      .eq('username', 'MarcosTBCF')
      .eq('year', 2026)
      .eq('month', 5)
      .single();
    
    if (formError) throw formError;
    
    console.log('📋 Registro en tabla formularios:');
    console.log('  ID:', formulario.id);
    console.log('  Username:', formulario.username);
    console.log('  Año:', formulario.year);
    console.log('  Mes:', formulario.month);
    console.log('  Asistencia:', formulario.asistencia);
    console.log('  desplazamientos (JSON):', JSON.stringify(formulario.desplazamientos));
    console.log('  gastos_transporte (JSON):', formulario.gastos_transporte);
    console.log('  gastos_dietas (JSON):', JSON.stringify(formulario.gastos_dietas));
    console.log();
    
    // 2. Ver registros en tabla gastos_transporte
    const { data: gastos, error: gastosError } = await supabase
      .from('gastos_transporte')
      .select('*')
      .eq('formulario_id', formulario.id)
      .order('fecha', { ascending: true });
    
    if (gastosError) throw gastosError;
    
    console.log('💰 Gastos de Transporte en tabla relacional (gastos_transporte):');
    if (gastos.length === 0) {
      console.log('  ⚠️  No hay registros');
    } else {
      gastos.forEach((gasto, idx) => {
        console.log(`  [${idx + 1}] Fecha: ${gasto.fecha}, Importe: ${gasto.importe}, Concepto: ${gasto.concepto}`);
      });
    }
    console.log();
    
    // 3. Ver registros en tabla desplazamientos
    const { data: desplazamientos, error: despError } = await supabase
      .from('desplazamientos')
      .select('*')
      .eq('formulario_id', formulario.id)
      .order('fecha', { ascending: true });
    
    if (despError) throw despError;
    
    console.log('🚗 Desplazamientos en tabla relacional (desplazamientos):');
    if (desplazamientos.length === 0) {
      console.log('  ⚠️  No hay registros');
    } else {
      desplazamientos.forEach((desp, idx) => {
        console.log(`  [${idx + 1}] Fecha: ${desp.fecha}, KM: ${desp.km}, Lugar: ${desp.lugar}`);
      });
    }
    
    console.log('\n✅ Verificación completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarDatos();
