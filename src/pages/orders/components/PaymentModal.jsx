// Ventana de pago simulada: resumen, método de pago y confirmación.

import { formatPrice, paymentMethods } from "../data/products";
import "../styles/PaymentModal.css";

function PaymentModal({
  cartItems,
  total,
  paymentMethod,
  onSelectMethod,
  onConfirm,
  onClose,
}) {
  const canConfirm = cartItems.length > 0 && paymentMethod !== "";

  return (
    <div className="orders-page__overlay">
      <div
        className="orders-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orders-payment-title"
      >
        <h2 id="orders-payment-title" className="orders-page__modal-title">
          Resumen y pago
        </h2>

        <ul className="orders-page__modal-list">
          {cartItems.map((item) => (
            <li key={item.id} className="orders-page__modal-item">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="orders-page__modal-total">
          <span>Total a pagar</span>
          <span>{formatPrice(total)}</span>
        </div>

        <fieldset className="orders-page__payment-methods">
          <legend>Método de pago</legend>
          {paymentMethods.map((method) => {
            const isSelected = paymentMethod === method.id;

            return (
              <label
                key={method.id}
                className={
                  isSelected
                    ? "orders-page__payment-option orders-page__payment-option--active"
                    : "orders-page__payment-option"
                }
              >
                <input
                  type="radio"
                  name="orders-payment-method"
                  value={method.id}
                  checked={isSelected}
                  onChange={() => onSelectMethod(method.id)}
                />
                <span>
                  <strong>{method.label}</strong>
                  <small>{method.description}</small>
                </span>
              </label>
            );
          })}
        </fieldset>

        {paymentMethod === "" && (
          <p className="orders-page__modal-hint">
            Selecciona un método de pago para continuar.
          </p>
        )}

        <p className="orders-page__modal-note">
          Esto es una simulación de demostración: no se realiza ningún cobro, POR AHORA.
        </p>

        <div className="orders-page__modal-actions">
          <button
            type="button"
            className="orders-page__secondary-button"
            onClick={onClose}
          >
            Volver al menú
          </button>
          <button
            type="button"
            className="orders-page__primary-button"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            Confirmar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
