import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config(); // Cargar variables del archivo .env

const { Pool } = pg;

// Si no hay DATABASE_URL, pool seguirá existiendo pero las queries fallarán y el server usará fallback.
// Crear la conexión a PostgreSQL usando DATABASE_URL del .env si está presente
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // opcional: añadir ssl para producción si es necesario:
    // ssl: { rejectUnauthorized: false }
  });

  // Verificar la conexión (no bloquear si falla)
  pool.connect()
    .then(client => {
      client.release();
      console.log("✅ Conectado a PostgreSQL");
    })
    .catch(err => console.error("❌ Error al conectar a PostgreSQL:", err.message));
} else {
  console.warn("⚠️ DATABASE_URL no configurada. Se usará almacenamiento en fichero JSON como fallback.");
  // Crear un pool de juguete que lance error en queries para que el servidor detecte el fallo y use fallback
  pool = {
    query: async () => { throw new Error("DATABASE_URL no configurada"); }
  };
}

export { pool };
