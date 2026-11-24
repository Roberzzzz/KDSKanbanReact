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
    // Receta con el stock actual de cada ingrediente (para validar disponibilidad en el carrito)
    receta: (p.receta || []).map((r) => ({
      ingredienteId: r.ingrediente_id,
      cantidad: Number(r.cantidad),
      stock: Number(r.stock),
    })),
  }));
}

export const paymentMethods = [
  {
    id: "efectivo",
    label: "Efectivo",
    description: "Paga al recibir tu pedido.",
  },
  {
    id: "pago_movil",
    label: "Pago móvil",
    description: "Realiza pago móvil e indica la referencia.",
  },
  {
    id: "tarjeta",
    label: "Tarjeta",
    description: "Paga con punto de venta.",
  },
];

// Convierte un número en un precio en dólares, por ejemplo 6.5 -> "$6.50"
export function formatPrice(amount) {
  return "$" + amount.toFixed(2);
}