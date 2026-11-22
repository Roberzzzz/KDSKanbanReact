import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const TRANSICIONES = {
  pendiente: ['preparacion'],
  preparacion: ['pendiente', 'listo'],
  listo: ['preparacion', 'entregado'],
  entregado: ['listo'],
};

const mapItem = (d) => ({
  id: String(d.id),
  cantidad: d.cantidad,
  nombre: d.nombre,
  nota: d.nota,
  minutos: d.minutos,
  startedAt: d.iniciado_en ? new Date(d.iniciado_en).getTime() : null,
  doneAt: d.terminado_en ? new Date(d.terminado_en).getTime() : null,
});

const mapPedido = (p, items) => ({
  id: String(p.id),
  numero: p.numero,
  mesa: p.mesa || 'Sin mesa',
  estado: p.estado,
  createdAt: new Date(p.creado_en).getTime(),
  readyAt: p.listo_en ? new Date(p.listo_en).getTime() : null,
  deliveredAt: p.entregado_en ? new Date(p.entregado_en).getTime() : null,
  objetivoMin: p.objetivo_min || 15,
  items,
});

async function adjuntarItems(pedidos) {
  if (pedidos.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT d.pedido_id, d.id, d.cantidad, pr.nombre, d.nota,
            pr.tiempo_preparacion_min AS minutos,
            d.iniciado_en, d.terminado_en
     FROM public.detalle_pedido d
     JOIN public.productos pr ON pr.id = d.producto_id
     WHERE d.pedido_id = ANY($1::int[])
     ORDER BY d.id;`,
    [pedidos.map((p) => p.id)]
  );
  const porPedido = new Map();
  for (const d of rows) {
    if (!porPedido.has(d.pedido_id)) porPedido.set(d.pedido_id, []);
    porPedido.get(d.pedido_id).push(mapItem(d));
  }
  return pedidos.map((p) => mapPedido(p, porPedido.get(p.id) || []));
}

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
    res.json(await adjuntarItems(pedidos));
  } catch (error) {
    console.error('Error al obtener vista de pedidos:', error);
    res.status(500).json({ error: 'Error al consultar el tablero de cocina' });
  }
});

router.get('/historial', async (req, res) => {
  try {
    const { rows: pedidos } = await pool.query(
      `SELECT id, numero, codigo_retiro, nombre_cliente, mesa, estado,
              metodo_pago, creado_en, listo_en, entregado_en, unidades, total, objetivo_min
       FROM public.v_pedidos
       WHERE estado = 'entregado'
         AND (entregado_en AT TIME ZONE COALESCE($1::text, current_setting('TimeZone')))::date
           = (NOW() AT TIME ZONE COALESCE($1::text, current_setting('TimeZone')))::date
       ORDER BY entregado_en DESC, id DESC;`,
      [process.env.APP_TIMEZONE || null]
    );
    res.json(await adjuntarItems(pedidos));
  } catch (error) {
    console.error('Error al obtener historial de pedidos:', error);
    res.status(500).json({ error: 'Error al consultar el historial de entregas' });
  }
});

// POST /api/pedidos: Crear pedido desde OrdersPage + descontar inventario
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { mesa, nombre_cliente, metodo_pago_id, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }

    // Validación básica de cada ítem (ids y cantidades enteras positivas)
    for (const item of items) {
      const pid = Number(item?.producto_id);
      const cant = Number(item?.cantidad);
      if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(cant) || cant <= 0 || cant > 99) {
        return res.status(400).json({ error: 'El pedido contiene productos o cantidades no válidos.' });
      }
    }

    await client.query('BEGIN');

    // ── 0. Verificar que los productos existan y estén activos; el precio sale de la BD ──
    // FOR SHARE evita que el admin inactive/modifique un producto justo durante este pedido.
    const idsProductos = [...new Set(items.map((i) => Number(i.producto_id)))];
    const { rows: productosBD } = await client.query(
      `SELECT id, nombre, precio, disponible
       FROM public.productos
       WHERE id = ANY($1::int[])
       ORDER BY id
       FOR SHARE`,
      [idsProductos]
    );
    const preciosBD = new Map(productosBD.map((p) => [p.id, p.precio]));
    for (const id of idsProductos) {
      if (!preciosBD.has(id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Uno de los productos del pedido ya no existe. Actualiza el menú.' });
      }
    }
    const inactivo = productosBD.find((p) => !p.disponible);
    if (inactivo) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `El producto "${inactivo.nombre}" ya no está disponible. Actualiza el menú y vuelve a intentarlo.`,
      });
    }

    // ── 1. Calcular cuánto de cada ingrediente necesita TODO el pedido ──
    const necesarios = new Map(); // ingrediente_id -> cantidad total necesaria

    for (const item of items) {
      const { rows: receta } = await client.query(
        `SELECT ingrediente_id, cantidad_necesaria
         FROM public.producto_ingredientes
         WHERE producto_id = $1`,
        [item.producto_id]
      );
      for (const r of receta) {
        const total = Number(r.cantidad_necesaria) * Number(item.cantidad);
        necesarios.set(r.ingrediente_id, (necesarios.get(r.ingrediente_id) || 0) + total);
      }
    }

    // ── 2. Bloquear esas filas y validar stock ──
    // ORDER BY id evita deadlocks entre pedidos simultáneos
    const ids = [...necesarios.keys()];
    if (ids.length > 0) {
      const { rows: stock } = await client.query(
        `SELECT id, nombre, stock_actual
         FROM public.ingredientes
         WHERE id = ANY($1::int[])
         ORDER BY id
         FOR UPDATE`,
        [ids]
      );

      for (const ing of stock) {
        if (Number(ing.stock_actual) < necesarios.get(ing.id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `No hay suficiente disponibilidad para "${ing.nombre}". Solo quedan ${ing.stock_actual}.`,
          });
        }
      }

      // ── 3. Descontar ──
      for (const [ingId, total] of necesarios) {
        await client.query(
          `UPDATE public.ingredientes
           SET stock_actual = stock_actual - $1
           WHERE id = $2`,
          [total, ingId]
        );
      }
    }

    // ── 4. Insertar el pedido (igual que antes) ──
    const insertPedido = `
      INSERT INTO public.pedidos (mesa, nombre_cliente, metodo_pago_id, estado)
      VALUES ($1, $2, $3, 'pendiente')
      RETURNING id, numero, creado_en, estado;
    `;
    const { rows: pedidoRows } = await client.query(insertPedido, [
      mesa || 'Mesa / Local',
      nombre_cliente || 'Cliente',
      metodo_pago_id || 1,
    ]);
    const nuevoPedido = pedidoRows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO public.detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, nota)
         VALUES ($1, $2, $3, $4, $5);`,
        [nuevoPedido.id, item.producto_id, item.cantidad, preciosBD.get(Number(item.producto_id)), item.nota || '']
      );
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
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'pendiente', 'preparacion', 'listo', 'entregado'

    if (!['pendiente', 'preparacion', 'listo', 'entregado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    await client.query('BEGIN');

    const { rows: actual } = await client.query(
      'SELECT estado FROM public.pedidos WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (actual.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoActual = actual[0].estado;

    if (estadoActual === estado) {
      await client.query('ROLLBACK');
      return res.json({ success: true, sinCambios: true });
    }

    if (!TRANSICIONES[estadoActual]?.includes(estado)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Movimiento no permitido: de "${estadoActual}" a "${estado}"`,
      });
    }

    // Marcas de tiempo del pedido según el nuevo estado
    let updateQuery = 'UPDATE public.pedidos SET estado = $1';
    if (estado === 'listo') {
      updateQuery += ', listo_en = COALESCE(listo_en, NOW()), entregado_en = NULL';
    } else if (estado === 'entregado') {
      updateQuery += ', listo_en = COALESCE(listo_en, NOW()), entregado_en = NOW()';
    } else {
      // Si la comanda sale de "listo", su cronómetro se reanuda
      updateQuery += ', listo_en = NULL, entregado_en = NULL';
    }
    updateQuery += ' WHERE id = $2 RETURNING *;';

    const { rows } = await client.query(updateQuery, [estado, id]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Tiempos por plato: al pasar a preparación arrancan las cuentas regresivas;
    // si vuelve a pendiente, se reinician.
    if (estado === 'preparacion') {
      await client.query(
        'UPDATE public.detalle_pedido SET iniciado_en = COALESCE(iniciado_en, NOW()) WHERE pedido_id = $1',
        [id]
      );
    } else if (estado === 'pendiente') {
      await client.query(
        'UPDATE public.detalle_pedido SET iniciado_en = NULL, terminado_en = NULL WHERE pedido_id = $1',
        [id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, pedido: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al mover comanda' });
  } finally {
    client.release();
  }
});

// PATCH /api/pedidos/:id/items/:itemId: marcar (o desmarcar) un plato como terminado.
// Si era el último plato pendiente de una comanda en preparación, la comanda pasa a "listo".
router.patch('/:id/items/:itemId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, itemId } = req.params;
    const { terminado } = req.body; // true | false

    await client.query('BEGIN');

    const updateItem = terminado
      ? `UPDATE public.detalle_pedido
         SET terminado_en = NOW(), iniciado_en = COALESCE(iniciado_en, NOW())
         WHERE id = $1 AND pedido_id = $2
         RETURNING id;`
      : `UPDATE public.detalle_pedido
         SET terminado_en = NULL
         WHERE id = $1 AND pedido_id = $2
         RETURNING id;`;
    const { rowCount } = await client.query(updateItem, [itemId, id]);

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    let estado = null;
    if (terminado) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS faltan
         FROM public.detalle_pedido
         WHERE pedido_id = $1 AND terminado_en IS NULL;`,
        [id]
      );
      if (rows[0].faltan === 0) {
        const moved = await client.query(
          `UPDATE public.pedidos
           SET estado = 'listo', listo_en = COALESCE(listo_en, NOW())
           WHERE id = $1 AND estado = 'preparacion'
           RETURNING estado;`,
          [id]
        );
        if (moved.rowCount > 0) estado = 'listo';
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, estado });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar plato:', error);
    res.status(500).json({ error: 'Error al actualizar el plato' });
  } finally {
    client.release();
  }
});

export default router;