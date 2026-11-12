import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// POST /api/usuarios/login: Autenticación
router.post('/login', async (req, res) => {
  try {
    const { nombre_usuario, contrasena } = req.body;

    const query = `
      SELECT u.id, u.nombre_usuario, u.nombre_completo, u.activo, r.nombre AS rol
      FROM public.usuarios u
      JOIN public.roles r ON r.id = u.rol_id
      WHERE u.nombre_usuario = $1
        AND u.contrasena_hash = crypt($2, u.contrasena_hash);
    `;
    const { rows } = await pool.query(query, [nombre_usuario, contrasena]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const user = rows[0];
    if (!user.activo) {
      return res.status(403).json({ error: 'Tu usuario está bloqueado. Contacta al administrador.' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error del servidor al iniciar sesión' });
  }
});

// GET /api/usuarios: Listar todos los usuarios y roles disponibles
router.get('/', async (req, res) => {
  try {
    const usersQuery = `
      SELECT u.id, u.nombre_usuario, u.nombre_completo, u.rol_id, r.nombre AS rol, u.activo, u.creado_en
      FROM public.usuarios u
      JOIN public.roles r ON r.id = u.rol_id
      ORDER BY u.id ASC;
    `;
    const rolesQuery = `SELECT id, nombre FROM public.roles ORDER BY id ASC;`;

    const [usersRes, rolesRes] = await Promise.all([
      pool.query(usersQuery),
      pool.query(rolesQuery),
    ]);

    res.json({ usuarios: usersRes.rows, roles: rolesRes.rows });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener la lista de usuarios' });
  }
});

// POST /api/usuarios: Crear nuevo usuario
router.post('/', async (req, res) => {
  try {
    const { nombre_usuario, nombre_completo, contrasena, rol_id } = req.body;

    if (!nombre_usuario || !nombre_completo || !contrasena || !rol_id) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const query = `
      INSERT INTO public.usuarios (nombre_usuario, nombre_completo, contrasena_hash, rol_id, activo)
      VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, true)
      RETURNING id, nombre_usuario, nombre_completo, rol_id, activo, creado_en;
    `;
    const { rows } = await pool.query(query, [
      nombre_usuario.trim(),
      nombre_completo.trim(),
      contrasena,
      rol_id,
    ]);

    res.status(201).json({ success: true, usuario: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ese nombre de usuario ya existe.' });
    }
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id: Editar datos del usuario (y contraseña opcional)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_usuario, nombre_completo, rol_id, contrasena } = req.body;

    let query;
    let params;

    if (contrasena && contrasena.trim() !== '') {
      query = `
        UPDATE public.usuarios
        SET nombre_usuario = $1, nombre_completo = $2, rol_id = $3, contrasena_hash = crypt($4, gen_salt('bf'))
        WHERE id = $5
        RETURNING id;
      `;
      params = [nombre_usuario.trim(), nombre_completo.trim(), rol_id, contrasena, id];
    } else {
      query = `
        UPDATE public.usuarios
        SET nombre_usuario = $1, nombre_completo = $2, rol_id = $3
        WHERE id = $4
        RETURNING id;
      `;
      params = [nombre_usuario.trim(), nombre_completo.trim(), rol_id, id];
    }

    const { rowCount } = await pool.query(query, params);
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ success: true });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso.' });
    }
    console.error('Error al editar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PATCH /api/usuarios/:id/bloquear: Activar o bloquear usuario
router.patch('/:id/bloquear', async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const { rowCount } = await pool.query(
      'UPDATE public.usuarios SET activo = $1 WHERE id = $2',
      [activo, id]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error);
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
});

export default router;