// Utilidades compartidas entre el módulo de administración de productos y el menú del cliente.

export const BACKEND_URL = "http://localhost:5000";
export const API_PRODUCTOS_URL = `${BACKEND_URL}/api/productos`;
export const API_INGREDIENTES_URL = `${BACKEND_URL}/api/ingredientes`;

// Ilustraciones que ya trae el proyecto (src/pages/orders/assets), indexadas por nombre de archivo.
// La columna productos.imagen guarda ese nombre (p. ej. "pizza-pepperoni.svg").
const imagenesIncluidas = import.meta.glob("./pages/orders/assets/*.svg", {
  eager: true,
  import: "default",
});

const imagenesPorNombre = Object.fromEntries(
  Object.entries(imagenesIncluidas).map(([ruta, url]) => [ruta.split("/").pop(), url])
);

// Imagen de reemplazo cuando el producto no tiene foto
export const IMAGEN_VACIA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90">' +
      '<rect width="120" height="90" fill="#fbe6d8"/>' +
      '<circle cx="60" cy="45" r="22" fill="none" stroke="#c8501e" stroke-width="4"/>' +
      '<circle cx="60" cy="45" r="9" fill="#c8501e"/></svg>'
  );

// Devuelve la URL que se debe usar en un <img> para el valor guardado en productos.imagen:
// ilustración incluida en el proyecto, imagen subida (servida por el backend) o imagen vacía.
export function resolveProductImage(imagen) {
  if (!imagen) return IMAGEN_VACIA;
  if (imagenesPorNombre[imagen]) return imagenesPorNombre[imagen];
  return `${BACKEND_URL}/uploads/${encodeURIComponent(imagen)}`;
}
