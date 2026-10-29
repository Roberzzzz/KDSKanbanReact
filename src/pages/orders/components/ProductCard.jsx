// Tarjeta de un producto del menú.

import { formatPrice } from "../data/products";
import "../styles/ProductCard.css";

function ProductCard({ product, onAddToCart }) {
  return (
    <article className="orders-page__product-card">
      <img
        className="orders-page__product-image"
        src={product.image}
        alt={product.name}
        loading="lazy"
      />

      <div className="orders-page__product-body">
        <h3 className="orders-page__product-name">{product.name}</h3>
        <p className="orders-page__product-description">
          {product.description}
        </p>

        <div className="orders-page__product-footer">
          <span className="orders-page__product-price">
            {formatPrice(product.price)}
          </span>
          <button
            type="button"
            className="orders-page__add-button"
            aria-label={`Agregar ${product.name} al carrito`}
            onClick={() => onAddToCart(product)}
          >
            + Agregar
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
