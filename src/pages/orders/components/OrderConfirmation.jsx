// Confirmación visual del pedido. Todo es local: no se envía nada a la cocina.

import { formatPrice, paymentMethods } from "../data/products";
import "../styles/PaymentModal.css";

function OrderConfirmation({ order, onBackToMenu }) {
  const method = paymentMethods.find((m) => m.id === order.paymentMethod);
  const methodLabel = method ? method.label : order.paymentMethod;

  return (
    <div className="orders-page__overlay">
      <div
        className="orders-page__modal orders-page__modal--center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orders-confirmation-title"
      >
        <div className="orders-page__check" aria-hidden="true">
          ✓
        </div>

        <h2 id="orders-confirmation-title" className="orders-page__modal-title">
          ¡Pedido recibido!
        </h2>
        <p className="orders-page__order-number">
          Pedido <strong>{order.number}</strong>
        </p>

        <ul className="orders-page__modal-list">
          {order.items.map((item) => (
            <li key={item.id} className="orders-page__modal-item">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="orders-page__modal-total">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
        <p className="orders-page__confirmation-method">
          Método de pago: <strong>{methodLabel}</strong>
        </p>

        <p className="orders-page__modal-note">
          Tu pedido se registró en la demostración. PROXIMAMENTE FUNCIONAL.
        </p>

        <button
          type="button"
          className="orders-page__primary-button"
          onClick={onBackToMenu}
        >
          Volver al menú
        </button>
      </div>
    </div>
  );
}

export default OrderConfirmation;
