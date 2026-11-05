import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/productos: Obtiene productos con su categoría y tiempo de preparación
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.nombre, p.descripcion, p.precio, 
             p.tiempo_preparacion_min, p.imagen, p.disponible, 
             c.nombre AS categoria
      FROM public.productos p
      JOIN public.categorias c ON c.id = p.categoria_id
      WHERE p.disponible = true
      ORDER BY c.orden, p.nombre;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error del servidor al obtener productos' });
  }
});

// GET /api/productos/categorias: Obtiene las categorías
router.get('/categorias', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM public.categorias ORDER BY orden ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error del servidor al obtener categorías' });
  }
});

export default router;