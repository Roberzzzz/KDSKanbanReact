import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Forzamos a que el password se convierta siempre en un string de texto, 
// sin importar si escribiste números, letras o si se deja vacío.
const rawPassword = process.env.DB_PASSWORD;
const safePassword = rawPassword !== undefined && rawPassword !== null ? String(rawPassword) : '';

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: safePassword,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'kanban',
});

pool.on('connect', () => {
  console.log('Conectado exitosamente a PostgreSQL (kanban)');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente de PostgreSQL', err);
});