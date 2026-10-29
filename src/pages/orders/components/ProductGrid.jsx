// Cuadrícula con las tarjetas de los productos que se están mostrando.

import ProductCard from "./ProductCard";

function ProductGrid({ products, onAddToCart }) {
  if (products.length === 0) {
    return (
      <p className="orders-page__empty-products">
        No hay productos en esta categoría por ahora.
      </p>
    );
  }

  return (
    <section className="orders-page__grid" aria-label="Productos del menú">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </section>
  );
}

export default ProductGrid;
