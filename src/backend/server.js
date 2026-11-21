import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productosRouter, { UPLOADS_DIR } from './routes/productos.js';
import pedidosRouter from './routes/pedidos.js';
import usuariosRouter from './routes/usuarios.js';
import ingredientesRouter from './routes/ingredientes.js'; // <-- NUEVO

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Límite ampliado: las imágenes de productos llegan como base64 (máx. 2 MB reales)
app.use(express.json({ limit: '4mb' }));

// Imágenes subidas desde el módulo de productos
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

// Registrar rutas
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/ingredientes', ingredientesRouter); // <-- NUEVO

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Sazón Express Backend API' });
});

// Errores de parseo / tamaño del body en formato JSON (en lugar de HTML)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande (la imagen supera el límite).' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido.' });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(` Servidor backend corriendo en el puerto ${PORT}`);
});