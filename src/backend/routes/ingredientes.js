import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

const NOMBRE_INGREDIENTE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

async function obtenerRecetasPorIngrediente(clientOrPool, ingredienteId) {
  const { rows } = await clientOrPool.query(
    `SELECT DISTINCT p.id, p.nombre, p.disponible, pi.cantidad_necesaria
     FROM public.producto_ingredientes pi
     JOIN public.productos p ON p.id = pi.producto_id
     WHERE pi.ingrediente_id = $1
     ORDER BY p.nombre ASC`,
    [ingredienteId]
  );
  return rows;
}

async function eliminarIngredientePorId(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de ingrediente no válido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const actual = await client.query(
      'SELECT id, nombre FROM public.ingredientes WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingrediente no encontrado.' });
    }

    const recetas = await obtenerRecetasPorIngrediente(client, id);
    if (recetas.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `No se puede eliminar "${actual.rows[0].nombre}" porque está siendo utilizado en recetas.`,
        recetas,
      });
    }

    const deleted = await client.query(
      `DELETE FROM public.ingredientes
       WHERE id = $1
       RETURNING id, nombre, unidad_medida, stock_actual`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ eliminado: true, ingrediente: deleted.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al eliminar ingrediente:', err);
    res.status(500).json({ error: 'No se pudo eliminar el ingrediente.' });
  } finally {
    client.release();
  }
}

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

router.get('/:id/recetas', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de ingrediente no válido.' });
  }

  try {
    const ing = await pool.query(
      'SELECT id, nombre FROM public.ingredientes WHERE id = $1',
      [id]
    );
    if (ing.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrediente no encontrado.' });
    }

    const recetas = await obtenerRecetasPorIngrediente(pool, id);
    res.json({ recetas });
  } catch (err) {
    console.error('Error al consultar recetas del ingrediente:', err);
    res.status(500).json({ error: 'No se pudieron consultar las recetas del ingrediente.' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, unidad_medida, stock_actual } = req.body;

  const nombreLimpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!nombreLimpio) {
    return res.status(400).json({ error: 'El nombre del ingrediente es obligatorio.' });
  }

  if (!NOMBRE_INGREDIENTE_REGEX.test(nombreLimpio)) {
    return res.status(400).json({
      error: 'El nombre del ingrediente solo puede contener letras, números y espacios.',
    });
  }

  const unidad = (unidad_medida && unidad_medida.trim()) || 'unidad';
  const stockInicial = Number(stock_actual);

  if (Number.isNaN(stockInicial) || stockInicial < 0) {
    return res.status(400).json({ error: 'El stock inicial debe ser un número mayor o igual a 0.' });
  }

  try {
    const existe = await pool.query(
      'SELECT id FROM public.ingredientes WHERE LOWER(nombre) = LOWER($1)',
      [nombreLimpio]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un ingrediente con ese nombre. Usa las opciones de sumar o ajustar stock.',
      });
    }

    const result = await pool.query(
      `INSERT INTO public.ingredientes (nombre, unidad_medida, stock_actual)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, unidad_medida, stock_actual`,
      [nombreLimpio, unidad, stockInicial]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear ingrediente:', err);
    res.status(500).json({ error: 'No se pudo registrar el ingrediente en la base de datos.' });
  }
});

router.patch('/:id/stock', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de ingrediente no válido.' });
  }

  const cantidadAgregar = Number(req.body.cantidad);

  if (Number.isNaN(cantidadAgregar) || cantidadAgregar <= 0) {
    return res.status(400).json({ error: 'Ingresa una cantidad válida mayor a 0 para sumar.' });
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
    console.error('Error al sumar stock:', err);
    res.status(500).json({ error: 'Error al sumar stock al ingrediente.' });
  }
});

router.patch('/:id/ajustar', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador de ingrediente no válido.' });
  }

  const nuevoStock = Number(req.body.stock_actual);

  if (Number.isNaN(nuevoStock) || nuevoStock < 0) {
    return res.status(400).json({ error: 'Ingresa un stock real válido (0 o mayor).' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.ingredientes
       SET stock_actual = $1
       WHERE id = $2
       RETURNING id, nombre, unidad_medida, stock_actual`,
      [nuevoStock, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingrediente no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al ajustar stock:', err);
    res.status(500).json({ error: 'Error al ajustar el stock del ingrediente.' });
  }
});

router.delete('/:id', eliminarIngredientePorId);
router.patch('/:id/estado', eliminarIngredientePorId);

export default router;