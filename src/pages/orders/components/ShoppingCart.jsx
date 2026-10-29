// Carrito de compras (panel lateral en computadoras).

import { formatPrice } from "../data/products";
import "../styles/ShoppingCart.css";

function ShoppingCart({
  cartItems,
  subtotal,
  total,
  onIncrease,
  onDecrease,
  onRemove,
  onContinue,
}) {
  const isEmpty = cartItems.length === 0;

  return (
    <aside
      id="orders-cart"
      className="orders-page__cart"
      aria-label="Carrito de compras"
    >
      <h2 className="orders-page__cart-title">Tu pedido</h2>

      {isEmpty ? (
        <div className="orders-page__cart-empty">
          <p className="orders-page__cart-empty-title">
            Tu carrito está vacío, echale ganas
          </p>
          <p>Elige algo cheveroski del menú y aparecerá aquí.</p>
        </div>
      ) : (
        <ul className="orders-page__cart-list">
          {cartItems.map((item) => (
            <li key={item.id} className="orders-page__cart-item">
              <div className="orders-page__cart-item-info">
                <span className="orders-page__cart-item-name">{item.name}</span>
                <span className="orders-page__cart-item-unit">
                  {formatPrice(item.price)} c/u
                </span>
              </div>

              <div className="orders-page__cart-item-controls">
                <div className="orders-page__quantity">
                  <button
                    type="button"
                    className="orders-page__quantity-button"
                    aria-label={`Disminuir cantidad de ${item.name}`}
                    onClick={() => onDecrease(item.id)}
                  >
                    −
                  </button>
                  <span
                    className="orders-page__quantity-value"
                    aria-label={`Cantidad: ${item.quantity}`}
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="orders-page__quantity-button"
                    aria-label={`Aumentar cantidad de ${item.name}`}
                    onClick={() => onIncrease(item.id)}
                  >
                    +
                  </button>
                </div>

                <span className="orders-page__cart-item-subtotal">
                  {formatPrice(item.price * item.quantity)}
                </span>

                <button
                  type="button"
                  className="orders-page__remove-button"
                  aria-label={`Eliminar ${item.name} del carrito`}
                  onClick={() => onRemove(item.id)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="orders-page__cart-summary">
        <div className="orders-page__summary-row">
          <span>Subtotal de artículos</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="orders-page__summary-row orders-page__summary-row--total">
          <span>Total del pedido</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <button
        type="button"
        className="orders-page__primary-button"
        disabled={isEmpty}
        onClick={onContinue}
      >
        Continuar al pago
      </button>
      {isEmpty && (
        <p className="orders-page__cart-hint">
          Agrega al menos un producto para continuar.
        </p>
      )}
    </aside>
  );
}

export default ShoppingCart;
