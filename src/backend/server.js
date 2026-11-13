import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productosRouter from './routes/productos.js';
import pedidosRouter from './routes/pedidos.js';
import usuariosRouter from './routes/usuarios.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Registrar rutas
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/usuarios', usuariosRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Sazón Express Backend API' });
});


app.listen(PORT, () => {
  console.log(` Servidor backend corriendo en el puerto ${PORT}`);
});
