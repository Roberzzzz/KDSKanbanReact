// Encabezado compacto: logotipo, nombre, bienvenida y acceso al carrito.

function OrderHeader({ totalUnits }) {
  return (
    <header className="orders-page__header">
      <div className="orders-page__brand">
        <div className="orders-page__logo" aria-hidden="true">
          <span className="orders-page__logo-letter">S</span>
        </div>
        <div>
          <h1 className="orders-page__title">BigDip Flavor's</h1>
          <p className="orders-page__welcome">¿Qué hay pa' hoy?</p>
        </div>
      </div>

      <a
        className="orders-page__cart-link"
        href="#orders-cart"
        aria-label={`Ir al carrito. Unidades seleccionadas: ${totalUnits}`}
      >
        <svg
          className="orders-page__cart-icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
        >
          <path
            d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20 8H6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.5" fill="currentColor" />
          <circle cx="17" cy="20" r="1.5" fill="currentColor" />
        </svg>
        <span>Carrito</span>
        <span className="orders-page__cart-badge">{totalUnits}</span>
      </a>
    </header>
  );
}

export default OrderHeader;
