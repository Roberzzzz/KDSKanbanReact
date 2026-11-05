import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// GET /api/pedidos/vista: Consulta la vista v_pedidos con ítems organizados para el Kanban
router.get('/vista', async (req, res) => {
  try {
    const queryPedidos = `
      SELECT id, numero, codigo_retiro, nombre_cliente, mesa, estado, 
             metodo_pago, creado_en, listo_en, entregado_en, unidades, total, objetivo_min
      FROM public.v_pedidos
      WHERE estado != 'entregado'
      ORDER BY creado_en ASC;
    `;
    const { rows: pedidos } = await pool.query(queryPedidos);

    // Adjuntar los ítems a cada pedido
    const result = await Promise.all(
      pedidos.map(async (p) => {
        const itemsQuery = `
          SELECT d.cantidad, pr.nombre, d.nota, pr.tiempo_preparacion_min AS minutos
          FROM public.detalle_pedido d
          JOIN public.productos pr ON pr.id = d.producto_id
          WHERE d.pedido_id = $1;
        `;
        const { rows: items } = await pool.query(itemsQuery, [p.id]);
        return {
          id: String(p.id),
          numero: p.numero,
          mesa: p.mesa || 'Sin mesa',
          estado: p.estado,
          createdAt: new Date(p.creado_en).getTime(),
          readyAt: p.listo_en ? new Date(p.listo_en).getTime() : null,
          deliveredAt: p.entregado_en ? new Date(p.entregado_en).getTime() : null,
          objetivoMin: p.objetivo_min || 15,
          items,
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Error al obtener vista de pedidos:', error);
    res.status(500).json({ error: 'Error al consultar el tablero de cocina' });
  }
});

// POST /api/pedidos: Crear pedido desde OrdersPage
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { mesa, nombre_cliente, metodo_pago_id, items } = req.body;

    await client.query('BEGIN');

    // 1. Insertar en la tabla pedidos
    const insertPedido = `
      INSERT INTO public.pedidos (mesa, nombre_cliente, metodo_pago_id, estado)
      VALUES ($1, $2, $3, 'pendiente')
      RETURNING id, numero, creado_en, estado;
    `;
    const { rows: pedidoRows } = await client.query(insertPedido, [
      mesa || 'Mesa / Local',
      nombre_cliente || 'Cliente',
      metodo_pago_id || 1, // 1: Efectivo / 2: Tarjeta según tu tabla metodos_pago
    ]);
    const nuevoPedido = pedidoRows[0];

    // 2. Insertar detalles en detalle_pedido
    for (const item of items) {
      const insertDetalle = `
        INSERT INTO public.detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, nota)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await client.query(insertDetalle, [
        nuevoPedido.id,
        item.producto_id,
        item.cantidad,
        item.precio_unitario,
        item.nota || '',
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      id: String(nuevoPedido.id),
      numero: nuevoPedido.numero,
      creado_en: nuevoPedido.creado_en,
      estado: nuevoPedido.estado,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar pedido:', error);
    res.status(500).json({ error: 'Error al registrar la comanda' });
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/estado: Actualizar estado desde el Kanban (mover columnas)
router.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'preparacion', 'listo', 'entregado'

    let updateQuery = 'UPDATE public.pedidos SET estado = $1';
    const params = [estado, id];

    if (estado === 'listo') {
      updateQuery += ', listo_en = NOW() WHERE id = $2 RETURNING *;';
    } else if (estado === 'entregado') {
      updateQuery += ', entregado_en = NOW() WHERE id = $2 RETURNING *;';
    } else {
      updateQuery += ' WHERE id = $2 RETURNING *;';
    }

    const { rows } = await pool.query(updateQuery, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({ success: true, pedido: rows[0] });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al mover comanda' });
  }
});

export default router;