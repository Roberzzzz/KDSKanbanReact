// Tarjeta de un producto del menú.

import { formatPrice } from "../data/products";
import "../styles/ProductCard.css";

function ProductCard({ product, onAddToCart, available = true }) {
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
            disabled={!available}
            style={available ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
            onClick={() => available && onAddToCart(product)}
          >
            + Agregar
          </button>
        </div>
        {!available && (
          <p className="orders-page__product-unavailable" style={{ color: "#c0392b", fontSize: "0.8rem", margin: "6px 0 0" }}>
            ¡Lo sentimos! Este producto no está disponible en estos momentos.
          </p>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
