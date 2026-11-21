// Datos de la página de pedidos: menú (desde la base de datos) y métodos de pago.
// El menú ya no está escrito a mano: se consulta al backend (GET /api/productos), que solo
// devuelve los productos activos. Las ilustraciones locales y las imágenes subidas desde el
// panel de administración se resuelven en productHelpers.js.

import { API_PRODUCTOS_URL, resolveProductImage } from "../../../productHelpers";

// Consulta el menú y lo deja con el formato que usan los componentes de la página de pedidos.
// Los productos llegan ordenados por categoría (orden definido en la BD) y nombre.
export async function fetchMenu() {
  const response = await fetch(API_PRODUCTOS_URL);
  if (!response.ok) {
    throw new Error("No se pudo cargar el menú");
  }
  const data = await response.json();

  return data.map((p) => ({
    id: p.id,
    name: p.nombre,
    category: p.categoria,
    price: Number(p.precio),
    description: p.descripcion,
    image: resolveProductImage(p.imagen),
  }));
}

export const paymentMethods = [
  {
    id: "efectivo",
    label: "Efectivo",
    description: "Pagas al recibir tu pedido.",
  },
  {
    id: "tarjeta",
    label: "Tarjeta",
    description: "Pago simulado, sin datos bancarios.",
  },
];

// Convierte un número en un precio en dólares, por ejemplo 6.5 -> "$6.50"
export function formatPrice(amount) {
  return "$" + amount.toFixed(2);
}