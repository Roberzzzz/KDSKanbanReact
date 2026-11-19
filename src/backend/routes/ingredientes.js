import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Obtener todos los ingredientes ordenados alfabéticamente
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, stock_actual, unidad_medida
       FROM public.ingredientes
       ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener ingredientes:', err);
    res.status(500).json({ error: 'Error al obtener el inventario de ingredientes.' });
  }
});

// Registrar un nuevo ingrediente en la base de datos
router.post('/', async (req, res) => {
  const { nombre, unidad_medida, stock_actual } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del ingrediente es obligatorio.' });
  }

  const unidad = (unidad_medida && unidad_medida.trim()) || 'unidad';
  const stockInicial = Number(stock_actual);

  if (Number.isNaN(stockInicial) || stockInicial < 0) {
    return res.status(400).json({ error: 'El stock inicial debe ser un número mayor o igual a 0.' });
  }

  try {
    const existe = await pool.query(
      'SELECT id FROM public.ingredientes WHERE LOWER(nombre) = LOWER($1)',
      [nombre.trim()]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un ingrediente con ese nombre. Usa la opción de reabastecer stock.',
      });
    }

    const result = await pool.query(
      `INSERT INTO public.ingredientes (nombre, unidad_medida, stock_actual)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, unidad_medida, stock_actual`,
      [nombre.trim(), unidad, stockInicial]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear ingrediente:', err);
    res.status(500).json({ error: 'No se pudo registrar el ingrediente en la base de datos.' });
  }
});

// Sumar stock a un ingrediente existente
router.patch('/:id/stock', async (req, res) => {
  const { id } = req.params;
  const cantidadAgregar = Number(req.body.cantidad);

  if (Number.isNaN(cantidadAgregar) || cantidadAgregar <= 0) {
    return res.status(400).json({ error: 'Ingresa una cantidad válida mayor a 0.' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.ingredientes
       SET stock_actual = stock_actual + $1
       WHERE id = $2
       RETURNING id, nombre, unidad_medida, stock_actual`,
      [cantidadAgregar, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrediente no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar stock:', err);
    res.status(500).json({ error: 'Error al actualizar el stock del ingrediente.' });
  }
});

export default router;