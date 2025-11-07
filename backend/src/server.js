import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { pool } from "./db/index.js";

const app = express();
app.use(cors());
app.use(express.json());

// Utils: resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend static folder (project root ../frontend relative to backend/src)
const frontendPath = path.resolve(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// Data files fallback (if no DB)
const dataDir = path.resolve(__dirname, "../data");
const usersFile = path.join(dataDir, "users.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    try { await fs.access(usersFile); } catch { await fs.writeFile(usersFile, "[]"); }
  } catch (err) {
    console.error("Error creando data dir:", err);
  }
}

async function readUsersFromFile() {
  try {
    const content = await fs.readFile(usersFile, "utf8");
    return JSON.parse(content || "[]");
  } catch (err) {
    return [];
  }
}
async function writeUsersToFile(users) {
  await ensureDataDir();
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

// Helper: try DB query, return null on failure
async function tryDbQuery(query, params = []) {
  if (!process.env.DATABASE_URL) return null;
  try {
    const res = await pool.query(query, params);
    return res;
  } catch (err) {
    console.warn("DB query failed, falling back to file storage:", err.message);
    return null;
  }
}

// API: listar usuarios
app.get("/api/users", async (req, res) => {
  // Intentar BD
  const dbRes = await tryDbQuery("SELECT username, fullname, email, dni, address, phone, km, clubcode, role FROM users");
  if (dbRes) return res.json(dbRes.rows);

  // Fallback fichero
  const users = await readUsersFromFile();
  return res.json(users);
});

// API: obtener usuario por username
app.get("/api/users/:username", async (req, res) => {
  const username = req.params.username;
  const dbRes = await tryDbQuery("SELECT * FROM users WHERE username = $1", [username]);
  if (dbRes) {
    if (dbRes.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json(dbRes.rows[0]);
  }
  const users = await readUsersFromFile();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(user);
});

// API: crear usuario
app.post("/api/users", async (req, res) => {
  const u = req.body;
  // Minimal validation
  if (!u.username || !u.password) return res.status(400).json({ error: "username y password requeridos" });

  // Try DB insert
  const insertQuery = `INSERT INTO users (username, fullname, email, dni, address, phone, km, clubcode, role, password)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`;
  const dbRes = await tryDbQuery(insertQuery, [
    u.username, u.fullName || null, u.email || null, u.dni || null, u.address || null,
    u.phone || null, u.km || null, u.clubCode || null, u.role || null, u.password
  ]);
  if (dbRes) return res.status(201).json(dbRes.rows[0]);

  // Fallback file
  const users = await readUsersFromFile();
  if (users.find(x => x.username === u.username)) return res.status(409).json({ error: "Usuario ya existe" });
  users.push(u);
  await writeUsersToFile(users);
  res.status(201).json(u);
});

// API: actualizar usuario
app.put("/api/users/:username", async (req, res) => {
  const username = req.params.username;
  const u = req.body;

  const dbRes = await tryDbQuery(
    `UPDATE users SET username=$1, fullname=$2, email=$3, dni=$4, address=$5, phone=$6, km=$7, clubcode=$8, role=$9, password=$10
     WHERE username=$11 RETURNING *`,
    [u.username, u.fullName || null, u.email || null, u.dni || null, u.address || null, u.phone || null, u.km || null, u.clubCode || null, u.role || null, u.password || null, username]
  );
  if (dbRes) {
    if (dbRes.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json(dbRes.rows[0]);
  }

  // Fallback file update
  const users = await readUsersFromFile();
  const idx = users.findIndex(x => x.username === username);
  if (idx === -1) return res.status(404).json({ error: "Usuario no encontrado" });
  users[idx] = { ...users[idx], ...u };
  // Handle username change: ensure not duplicate
  if (u.username && u.username !== username && users.some((x, i) => x.username === u.username && i !== idx)) {
    return res.status(409).json({ error: "El nuevo username ya existe" });
  }
  await writeUsersToFile(users);
  res.json(users[idx]);
});

// API: borrar usuario
app.delete("/api/users/:username", async (req, res) => {
  const username = req.params.username;
  const dbRes = await tryDbQuery("DELETE FROM users WHERE username=$1 RETURNING *", [username]);
  if (dbRes) {
    if (dbRes.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ success: true });
  }
  const users = await readUsersFromFile();
  const filtered = users.filter(u => u.username !== username);
  if (filtered.length === users.length) return res.status(404).json({ error: "Usuario no encontrado" });
  await writeUsersToFile(filtered);
  res.json({ success: true });
});

// API: login (simple)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username y password requeridos" });

  const dbRes = await tryDbQuery("SELECT * FROM users WHERE username=$1 LIMIT 1", [username]);
  if (dbRes && dbRes.rows.length > 0) {
    const user = dbRes.rows[0];
    if (user.password === password) return res.json({ success: true, user });
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  // Fallback file lookup
  const users = await readUsersFromFile();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });
  res.json({ success: true, user });
});

// Endpoint para inicializar tablas si conectas DB (opcional)
app.post("/api/init-db", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(400).json({ error: "DATABASE_URL no configurada" });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        fullname TEXT,
        email TEXT,
        dni TEXT,
        address TEXT,
        phone TEXT,
        km TEXT,
        clubcode TEXT,
        role TEXT,
        password TEXT
      );
    `);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Fallback: servir index.html para rutas no API (SPA)
app.get("*", (req, res) => {
  const isApi = req.path.startsWith("/api/");
  if (isApi) return res.status(404).json({ error: "API endpoint no encontrado" });
  res.sendFile(path.join(frontendPath, "inicio_app1.html")); // página principal del frontend
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
