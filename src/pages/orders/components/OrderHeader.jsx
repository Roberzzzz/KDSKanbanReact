import { useState } from "react";

export default function OrderHeader({ totalUnits, setView }) {
  const [clickCount, setClickCount] = useState(0);
  const [showLoginBtn, setShowLoginBtn] = useState(false);

  const handleLogoClick = () => {
    setClickCount((prev) => {
      const nextCount = prev + 1;
      if (nextCount >= 3) {
        setShowLoginBtn(true);
        return 0;
      }
      return nextCount;
    });
  };

  const handleGoToLogin = () => {
    setShowLoginBtn(false); // Oculta el botón antes de cambiar de vista
    setView("login");
  };

  return (
    <header className="orders-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
      <div className="orders-brand" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        
        <span 
          className="orders-logo" 
          onClick={handleLogoClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "46px",
            height: "46px",
            borderRadius: "50%",
            background: "#c8501e",
            boxShadow: "inset 0 0 0 4px #fbe6d8",
            color: "#fff",
            fontSize: "24px",
            fontWeight: "800",
            cursor: "pointer",
            userSelect: "none"
          }}
          title="Sazón Express"
        >
          S
        </span>

        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800" }}>Sazón Express</h1>
          <p style={{ margin: 0, fontSize: "15px", color: "#6f6254" }}>Menú de Pedidos</p>
        </div>
      </div>

      {showLoginBtn && (
        <button
          type="button"
          onClick={handleGoToLogin} // Oculta y redirige
          style={{
            background: "#c8501e",
            color: "#ffffff",
            border: "2px solid #c8501e",
            padding: "8px 16px",
            borderRadius: "10px",
            fontSize: "15px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Ir al Login 🔓
        </button>
      )}

      <div className="orders-cart-indicator">
        <span style={{ fontSize: "15px", fontWeight: "700", color: "#6f6254" }}>
          🛒 {totalUnits} unidades
        </span>
      </div>
    </header>
  );
}