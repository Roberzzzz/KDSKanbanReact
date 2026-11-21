import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const router = Router();

// ── Carpeta donde se guardan las imágenes subidas desde el panel admin ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Mismas reglas de texto que el módulo de ingredientes
const NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;
const IMAGEN_NOMBRE_REGEX = /^[A-Za-z0-9._-]+$/;
const IMAGEN_SUBIDA_REGEX = /^prod-[a-f0-9]{16}\.(png|jpg|webp)$/;
const MAX_IMAGEN_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_INGREDIENTES = 30;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ───────────────────────── Utilidades ─────────────────────────

function aNumero(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && valor.trim() !== '') return Number(valor);
  return NaN;
}

function maxDosDecimales(n) {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

function parseId(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'Identificador no válido.');
  return n;
}

const TIPOS_IMAGEN = {
  'image/png': {
    ext: 'png',
    firma: (b) =>
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/jpeg': {
    ext: 'jpg',
    firma: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  'image/webp': {
    ext: 'webp',
    firma: (b) =>
      b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
};

// Valida y guarda una imagen enviada como data URL base64. Devuelve el nombre del archivo.
function guardarImagen(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGEN_BYTES * 1.4) {
    throw new ApiError(400, 'La imagen supera el tamaño máximo de 2 MB.');
  }
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) {
    throw new ApiError(400, 'Formato de imagen no válido. Usa PNG, JPG o WEBP.');
  }
  const tipo = TIPOS_IMAGEN[m[1]];
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGEN_BYTES) {
    throw new ApiError(400, 'La imagen supera el tamaño máximo de 2 MB.');
  }
  if (!tipo.firma(buffer)) {
    throw new ApiError(400, 'El archivo no es una imagen válida.');
  }
  const nombre = `prod-${crypto.randomBytes(8).toString('hex')}.${tipo.ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, nombre), buffer);
  return nombre;
}

// Solo borra imágenes que fueron subidas por este módulo (nunca los SVG del proyecto)
function borrarArchivoSubido(nombre) {
  if (typeof nombre !== 'string' || !IMAGEN_SUBIDA_REGEX.test(nombre)) return;
  fs.unlink(path.join(UPLOADS_DIR, nombre), () => {});
}

// Valida el cuerpo de crear/editar. Los campos opcionales ausentes quedan en undefined/null.
function validarPayload(body) {
  const b = body && typeof body === 'object' ? body : {};

  // Nombre
  const nombre = typeof b.nombre === 'string' ? b.nombre.trim().replace(/\s+/g, ' ') : '';
  if (!nombre) throw new ApiError(400, 'El nombre del producto es obligatorio.');
  if (nombre.length < 2 || nombre.length > 80) {
    throw new ApiError(400, 'El nombre debe tener entre 2 y 80 caracteres.');
  }
  if (!NOMBRE_REGEX.test(nombre)) {
    throw new ApiError(400, 'El nombre solo puede contener letras, números y espacios.');
  }

  // Categoría
  const categoria_id = aNumero(b.categoria_id);
  if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
    throw new ApiError(400, 'Selecciona una categoría.');
  }

  // Descripción (opcional, la columna tiene default '')
  let descripcion = '';
  if (b.descripcion !== undefined && b.descripcion !== null) {
    if (typeof b.descripcion !== 'string') {
      throw new ApiError(400, 'La descripción no es válida.');
    }
    descripcion = b.descripcion.trim().replace(/\s+/g, ' ');
    if (descripcion.length > 250) {
      throw new ApiError(400, 'La descripción no puede superar los 250 caracteres.');
    }
  }

  // Precio
  const precio = aNumero(b.precio);
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new ApiError(400, 'El precio debe ser un número mayor a 0.');
  }
  if (precio > 999999.99 || !maxDosDecimales(precio)) {
    throw new ApiError(400, 'El precio debe ser menor a 1.000.000 y tener máximo 2 decimales.');
  }

  // Tiempo de preparación
  const tiempo = aNumero(b.tiempo_preparacion_min);
  if (!Number.isInteger(tiempo) || tiempo < 1 || tiempo > 240) {
    throw new ApiError(400, 'El tiempo de preparación debe ser un entero entre 1 y 240 minutos.');
  }

  // Estado (null = no cambiar al editar; crear usa true por defecto)
  let disponible = null;
  if (b.disponible !== undefined && b.disponible !== null) {
    if (typeof b.disponible !== 'boolean') {
      throw new ApiError(400, 'El estado del producto no es válido.');
    }
    disponible = b.disponible;
  }

  // Ingredientes (null = no tocar la receta al editar; crear usa [])
  let ingredientes = null;
  if (b.ingredientes !== undefined && b.ingredientes !== null) {
    if (!Array.isArray(b.ingredientes)) {
      throw new ApiError(400, 'La lista de ingredientes no es válida.');
    }
    if (b.ingredientes.length > MAX_INGREDIENTES) {
      throw new ApiError(400, `Un producto puede tener como máximo ${MAX_INGREDIENTES} ingredientes.`);
    }
    const vistos = new Set();
    ingredientes = b.ingredientes.map((ing) => {
      const id = aNumero(ing?.ingrediente_id);
      const cantidad = aNumero(ing?.cantidad_necesaria);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ApiError(400, 'Hay un ingrediente sin seleccionar en la receta.');
      }
      if (vistos.has(id)) {
        throw new ApiError(400, 'No repitas el mismo ingrediente en la receta.');
      }
      vistos.add(id);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ApiError(400, 'La cantidad de cada ingrediente debe ser mayor a 0.');
      }
      if (cantidad > 99999999.99 || !maxDosDecimales(cantidad)) {
        throw new ApiError(400, 'La cantidad de un ingrediente es demasiado grande o tiene más de 2 decimales.');
      }
      return { ingrediente_id: id, cantidad_necesaria: cantidad };
    });
  }

  // Imagen: `imagen_base64` sube una nueva; `imagen` (string|null) conserva o quita la actual
  let imagen; // undefined = no se envió
  if (b.imagen !== undefined) {
    if (b.imagen === null || b.imagen === '') {
      imagen = null;
    } else if (
      typeof b.imagen === 'string' &&
      b.imagen.length <= 255 &&
      IMAGEN_NOMBRE_REGEX.test(b.imagen)
    ) {
      imagen = b.imagen;
    } else {
      throw new ApiError(400, 'El nombre de la imagen no es válido.');
    }
  }
  const imagenBase64 =
    b.imagen_base64 !== undefined && b.imagen_base64 !== null && b.imagen_base64 !== ''
      ? b.imagen_base64
      : null;

  return {
    nombre,
    categoria_id,
    descripcion,
    precio,
    tiempo,
    disponible,
    ingredientes,
    imagen,
    imagenBase64,
  };
}

// Comprueba categoría, nombre duplicado e ingredientes dentro de la transacción
async function verificarReferencias(client, d, idActual) {
  const cat = await client.query('SELECT 1 FROM public.categorias WHERE id = $1', [d.categoria_id]);
  if (cat.rowCount === 0) throw new ApiError(400, 'La categoría seleccionada no existe.');

  const dup = await client.query(
    `SELECT id FROM public.productos
     WHERE LOWER(nombre) = LOWER($1) AND ($2::int IS NULL OR id <> $2::int)`,
    [d.nombre, idActual]
  );
  if (dup.rowCount > 0) throw new ApiError(409, 'Ya existe un producto con ese nombre.');

  if (d.ingredientes && d.ingredientes.length > 0) {
    const ids = d.ingredientes.map((i) => i.ingrediente_id);
    const ing = await client.query(
      'SELECT id FROM public.ingredientes WHERE id = ANY($1::int[])',
      [ids]
    );
    if (ing.rowCount !== ids.length) {
      throw new ApiError(400, 'Uno o más ingredientes ya no existen. Actualiza el inventario e inténtalo de nuevo.');
    }
  }
}

async function guardarReceta(client, productoId, ingredientes) {
  await client.query('DELETE FROM public.producto_ingredientes WHERE producto_id = $1', [productoId]);
  if (ingredientes.length === 0) return;
  await client.query(
    `INSERT INTO public.producto_ingredientes (producto_id, ingrediente_id, cantidad_necesaria)
     SELECT $1, t.ingrediente_id, t.cantidad
     FROM unnest($2::int[], $3::numeric[]) AS t(ingrediente_id, cantidad)`,
    [
      productoId,
      ingredientes.map((i) => i.ingrediente_id),
      ingredientes.map((i) => i.cantidad_necesaria),
    ]
  );
}

const SELECT_ADMIN = `
  SELECT p.id, p.nombre, p.descripcion, p.precio, p.tiempo_preparacion_min,
         p.imagen, p.disponible, p.categoria_id, c.nombre AS categoria,
         COALESCE(
           json_agg(
             json_build_object(
               'ingrediente_id', i.id,
               'nombre', i.nombre,
               'unidad_medida', i.unidad_medida,
               'cantidad_necesaria', pi.cantidad_necesaria
             ) ORDER BY i.nombre
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'::json
         ) AS ingredientes
  FROM public.productos p
  JOIN public.categorias c ON c.id = p.categoria_id
  LEFT JOIN public.producto_ingredientes pi ON pi.producto_id = p.id
  LEFT JOIN public.ingredientes i ON i.id = pi.ingrediente_id
`;

function formatearProducto(row) {
  return {
    ...row,
    precio: Number(row.precio),
    ingredientes: (row.ingredientes || []).map((i) => ({
      ...i,
      cantidad_necesaria: Number(i.cantidad_necesaria),
    })),
  };
}

async function obtenerProducto(client, id) {
  const { rows } = await client.query(`${SELECT_ADMIN} WHERE p.id = $1 GROUP BY p.id, c.id`, [id]);
  return rows.length ? formatearProducto(rows[0]) : null;
}

function responderError(res, err, mensajeGenerico) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
  }
  if (err?.code === '23503') {
    return res.status(400).json({ error: 'La categoría o algún ingrediente ya no existe. Actualiza e inténtalo de nuevo.' });
  }
  if (err?.code === '22003' || err?.code === '23514') {
    return res.status(400).json({ error: 'Alguno de los valores está fuera del rango permitido.' });
  }
  console.error(mensajeGenerico, err);
  return res.status(500).json({ error: mensajeGenerico });
}

// ───────────────────────── Rutas públicas (menú del cliente) ─────────────────────────

// GET /api/productos: solo productos activos (disponible = true)
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

// ───────────────────────── Rutas de administración ─────────────────────────

// GET /api/productos/admin/lista: todos los productos (activos e inactivos) con su receta
router.get('/admin/lista', async (req, res) => {
  try {
    const { rows } = await pool.query(`${SELECT_ADMIN} GROUP BY p.id, c.id ORDER BY c.orden, p.nombre`);
    res.json(rows.map(formatearProducto));
  } catch (error) {
    responderError(res, error, 'Error al obtener la lista de productos.');
  }
});

// POST /api/productos: crear producto + receta (una sola transacción)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  let archivoNuevo = null;
  let confirmado = false;
  try {
    const d = validarPayload(req.body);

    let imagen = d.imagen ?? null;
    if (imagen && IMAGEN_SUBIDA_REGEX.test(imagen)) {
      throw new ApiError(400, 'La imagen indicada no es válida para un producto nuevo.');
    }
    if (d.imagenBase64) {
      archivoNuevo = guardarImagen(d.imagenBase64);
      imagen = archivoNuevo;
    }

    await client.query('BEGIN');
    await verificarReferencias(client, d, null);

    const { rows } = await client.query(
      `INSERT INTO public.productos
         (categoria_id, nombre, descripcion, precio, tiempo_preparacion_min, imagen, disponible)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [d.categoria_id, d.nombre, d.descripcion, d.precio, d.tiempo, imagen, d.disponible ?? true]
    );
    const id = rows[0].id;
    await guardarReceta(client, id, d.ingredientes ?? []);
    await client.query('COMMIT');
    confirmado = true;

    res.status(201).json(await obtenerProducto(client, id));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (archivoNuevo && !confirmado) borrarArchivoSubido(archivoNuevo);
    responderError(res, error, 'No se pudo registrar el producto.');
  } finally {
    client.release();
  }
});

// PUT /api/productos/:id: modificar datos y, si se envía `ingredientes`, reemplazar la receta
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  let archivoNuevo = null;
  let confirmado = false;
  let imagenAnterior = null;
  let imagenFinal = null;
  try {
    const id = parseId(req.params.id);
    const d = validarPayload(req.body);

    await client.query('BEGIN');
    // Bloquea la fila: también serializa con POST /api/pedidos (FOR SHARE) para que un
    // pedido no entre justo mientras se cambia el producto.
    const actual = await client.query(
      'SELECT id, imagen FROM public.productos WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (actual.rowCount === 0) throw new ApiError(404, 'Producto no encontrado.');
    imagenAnterior = actual.rows[0].imagen;

    await verificarReferencias(client, d, id);

    imagenFinal = imagenAnterior;
    if (d.imagenBase64) {
      archivoNuevo = guardarImagen(d.imagenBase64);
      imagenFinal = archivoNuevo;
    } else if (d.imagen !== undefined) {
      // No se permite apuntar a una imagen subida de otro producto
      if (d.imagen && IMAGEN_SUBIDA_REGEX.test(d.imagen) && d.imagen !== imagenAnterior) {
        throw new ApiError(400, 'La imagen indicada no es válida.');
      }
      imagenFinal = d.imagen;
    }

    await client.query(
      `UPDATE public.productos
       SET categoria_id = $1, nombre = $2, descripcion = $3, precio = $4,
           tiempo_preparacion_min = $5, imagen = $6, disponible = COALESCE($7, disponible)
       WHERE id = $8`,
      [d.categoria_id, d.nombre, d.descripcion, d.precio, d.tiempo, imagenFinal, d.disponible, id]
    );
    if (d.ingredientes !== null) {
      await guardarReceta(client, id, d.ingredientes);
    }
    await client.query('COMMIT');
    confirmado = true;

    if (imagenAnterior && imagenAnterior !== imagenFinal) borrarArchivoSubido(imagenAnterior);

    res.json(await obtenerProducto(client, id));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (archivoNuevo && !confirmado) borrarArchivoSubido(archivoNuevo);
    responderError(res, error, 'No se pudo actualizar el producto.');
  } finally {
    client.release();
  }
});

// PATCH /api/productos/:id/estado: activar / inactivar (campo `disponible`)
router.patch('/:id/estado', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { disponible } = req.body || {};
    if (typeof disponible !== 'boolean') {
      throw new ApiError(400, 'Indica si el producto debe quedar activo o inactivo.');
    }
    const { rowCount } = await pool.query(
      'UPDATE public.productos SET disponible = $1 WHERE id = $2',
      [disponible, id]
    );
    if (rowCount === 0) throw new ApiError(404, 'Producto no encontrado.');
    res.json(await obtenerProducto(pool, id));
  } catch (error) {
    responderError(res, error, 'No se pudo cambiar el estado del producto.');
  }
});

export default router;