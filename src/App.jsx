import { useState } from "react";
import OrdersPage from "./pages/orders";
import KanbanBoard from "./KanbanBoard";
import "./App.css";

const VIEWS = [
  { id: "menu", label: "Menú" },
  { id: "kanban", label: "Cocina" },
];

function App() {
  const [view, setView] = useState("menu");

  return (
    <>
      <nav className="app-nav">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`app-tab${view === v.id ? " is-active" : ""}`}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {/* Ambas vistas siguen montadas; solo se oculta la que no toca,
          así no se pierde el carrito ni las comandas al cambiar. */}
      <div hidden={view !== "menu"}>
        <OrdersPage />
      </div>
      <div hidden={view !== "kanban"}>
        <KanbanBoard />
      </div>
    </>
  );
}

export default App;
