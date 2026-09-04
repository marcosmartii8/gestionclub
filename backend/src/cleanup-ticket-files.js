import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BUCKET = 'formularios-archivos';
const ROOT_FOLDER = 'clubs';
const RETENTION_MONTHS = 12;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

function getCutoffPeriod() {
  const cutoff = new Date();
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return { year: cutoff.getFullYear(), month: cutoff.getMonth() + 1 };
}

function isOlderThanCutoff(year, month, cutoff) {
  return year < cutoff.year || (year === cutoff.year && month < cutoff.month);
}

function parseManagedPath(path) {
  const parts = path.split('/');
  if (parts.length < 8 || parts[0] !== ROOT_FOLDER || parts[2] !== 'usuarios') {
    return null;
  }

  const year = Number(parts[4]);
  const month = Number(parts[5]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

async function listFiles(prefix = '') {
  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        files.push(...await listFiles(itemPath));
      } else {
        files.push(itemPath);
      }
    }

    if (data.length < 100) break;
    offset += data.length;
  }

  return files;
}

async function clearDatabaseReferences(filePaths) {
  for (const table of ['gastos_transporte', 'gastos_dietas']) {
    const { data, error } = await supabase
      .from(table)
      .select('id, archivo')
      .not('archivo', 'is', null);

    if (error) throw error;

    for (const row of data || []) {
      if (!filePaths.some((filePath) => row.archivo.includes(filePath))) continue;

      const { error: updateError } = await supabase
        .from(table)
        .update({ archivo: null })
        .eq('id', row.id);

      if (updateError) throw updateError;
    }
  }
}

export async function cleanupTicketFiles({ execute = false } = {}) {
  if (!supabase) {
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY son obligatorios para limpiar tickets');
  }

  const cutoff = getCutoffPeriod();
  const allFiles = await listFiles(ROOT_FOLDER);
  const candidates = allFiles.filter((filePath) => {
    const metadata = parseManagedPath(filePath);
    return metadata && isOlderThanCutoff(metadata.year, metadata.month, cutoff);
  });

  console.log(`Archivos organizados encontrados: ${allFiles.length}`);
  console.log(`Periodo de retención: ${cutoff.year}-${String(cutoff.month).padStart(2, '0')}`);
  console.log(`Candidatos con más de ${RETENTION_MONTHS} meses: ${candidates.length}`);

  candidates.forEach((filePath) => console.log(`- ${filePath}`));

  if (!execute) {
    console.log('Modo previsualización: no se ha borrado ningún archivo.');
    console.log('Para ejecutar el borrado usa: npm run cleanup:tickets -- --execute');
    return candidates.length;
  }

  if (candidates.length === 0) return 0;

  await clearDatabaseReferences(candidates);

  for (let index = 0; index < candidates.length; index += 100) {
    const batch = candidates.slice(index, index + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw error;
  }

  console.log(`Eliminados ${candidates.length} archivos y sus referencias. Los formularios se han conservado.`);
  return candidates.length;
}

if (process.argv[1] && process.argv[1].endsWith('cleanup-ticket-files.js')) {
  cleanupTicketFiles({ execute: process.argv.includes('--execute') }).catch((error) => {
    console.error('Error limpiando tickets:', error.message);
    process.exitCode = 1;
  });
}
