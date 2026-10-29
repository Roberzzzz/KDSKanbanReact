import { memo, useEffect, useRef, useState } from "react";
import "./KanbanBoard.css";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { NowProvider, useNow } from "./NowProvider";
import { useKitchen, COLUMN_IDS } from "./useKitchen";
import { formatClock, formatElapsed, timerStatus } from "./timeUtils";
const COLUMNS = [
  {
    id: "pendiente",
    title: "Pendiente",
    color: "#e0a526",
    empty: "Las comandas nuevas aparecen aquí",
  },
  {
    id: "preparacion",
    title: "En preparación",
    color: "#c8501e",
    empty: "Arrastra una comanda para empezar a prepararla",
  },
  {
    id: "listo",
    title: "Listo",
    color: "#6a9a4a",
    empty: "Arrastra aquí lo que ya está para servir",
  },
];

const COLUMN_TITLES = Object.fromEntries(COLUMNS.map((c) => [c.id, c.title]));

function Timer({ order }) {
  const now = useNow();
  const done = order.readyAt != null;
  const elapsed = (done ? order.readyAt : now) - order.createdAt;
  const status = timerStatus(elapsed, order.objetivoMin);
  const text = formatElapsed(elapsed);

  let label = "";
  if (done) label = "Listo en";
  else if (status === "late") label = "Retraso";
  else if (status === "warn") label = "Por vencer";

  return (
    <span
      className={`kds-timer is-${status}`}
      role="timer"
      aria-label={`${label} ${text}`.trim()}
    >
      {label && <span className="kds-timer-label">{label}</span>}
      {text}
    </span>
  );
}

const stop = (e) => e.stopPropagation();

function Ticket({ order, onDeliver }) {
  return (
    <div className="kds-ticket">
      <div className="kds-ticket-head">
        <span className="kds-ticket-num">#{order.numero}</span>
        <Timer order={order} />
      </div>
      <p className="kds-ticket-meta">
        <strong>{order.mesa}</strong>
        <span>Ingresó {formatClock(order.createdAt)}</span>
      </p>
      <ul className="kds-items">
        {order.items.map((item, i) => (
          <li key={i}>
            <span className="kds-qty">{item.cantidad}×</span>
            <span className="kds-item-body">
              <span className="kds-item-name">{item.nombre}</span>
              {item.nota && <span className="kds-note">{item.nota}</span>}
            </span>
          </li>
        ))}
      </ul>
      {onDeliver && (
        <button
          type="button"
          className="kds-deliver"
          onMouseDown={stop}
          onTouchStart={stop}
          onClick={() => onDeliver(order.id)}
        >
          Entregada
        </button>
      )}
    </div>
  );
}

const DraggableTicket = memo(function DraggableTicket({ order, onDeliver }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`kds-ticket-wrap${isDragging ? " is-dragging" : ""}`}
      {...listeners}
      {...attributes}
      role={onDeliver ? "group" : attributes.role}
    >
      <Ticket order={order} onDeliver={onDeliver} />
    </div>
  );
});

function Column({ column, orders, onDeliver }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`kds-col${isOver ? " is-over" : ""}`}
      style={{ "--accent": column.color }}
      aria-label={column.title}
    >
      <header className="kds-col-head">
        <h2>{column.title}</h2>
        <span className="kds-count">{orders.length}</span>
      </header>
      <div className="kds-col-body">
        {orders.length === 0 ? (
          <p className="kds-empty">{column.empty}</p>
        ) : (
          orders.map((order) => (
            <DraggableTicket key={order.id} order={order} onDeliver={onDeliver} />
          ))
        )}
      </div>
    </section>
  );
}

function HistoryModal({ ids, orders, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="kds-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="kds-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kds-history-title"
      >
        <header className="kds-modal-head">
          <h2 id="kds-history-title">Entregadas</h2>
          <button
            ref={closeRef}
            type="button"
            className="kds-btn kds-modal-close"
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>

        <div className="kds-modal-body">
          {ids.length === 0 ? (
            <p className="kds-history-empty">Todavía no hay comandas entregadas.</p>
          ) : (
            <ul className="kds-history-list">
              {ids.map((id) => {
                const o = orders[id];
                const prep = o.readyAt - o.createdAt;
                const aTiempo = timerStatus(prep, o.objetivoMin) !== "late";
                return (
                  <li key={id}>
                    <span className="kds-h-num">#{o.numero}</span>
                    <span>{o.mesa}</span>
                    <span>Preparada en {formatElapsed(prep)}</span>
                    <span className={`kds-h-tag ${aTiempo ? "is-ok" : "is-late"}`}>
                      {aTiempo ? "A tiempo" : "Con retraso"}
                    </span>
                    <span className="kds-h-time">Entregada {formatClock(o.deliveredAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function undoLabel(entry, orders) {
  if (!entry) return "";
  const n = orders[entry.id]?.numero;
  return entry.kind === "move" ? `#${n} → ${COLUMN_TITLES[entry.to]}` : `entrega #${n}`;
}

function Board({ setView }) {
  const { state, move, deliver, undo } = useKitchen();
  const { orders, columns, history } = state;

  const [activeId, setActiveId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // Estado para controlar los 3 clics en el logo
  const [clickCount, setClickCount] = useState(0);
  const [showLoginBtn, setShowLoginBtn] = useState(false);

  const rootRef = useRef(null);

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
    setShowLoginBtn(false);
    setView("login");
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const onKey = (e) => {
      const visible = rootRef.current && rootRef.current.offsetParent !== null;
      if (
        visible &&
        !showHistory &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, showHistory]);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (over && COLUMN_IDS.includes(over.id)) move(active.id, over.id);
  };

  const lastUndo = state.undo[state.undo.length - 1];
  const total = COLUMN_IDS.reduce((n, c) => n + columns[c].length, 0);

  return (
    <div className="kds" ref={rootRef}>
      <header className="kds-top">
        <div className="kds-brand">
          {/* Logo interactivo de la cocina */}
          <span 
            className="kds-logo" 
            aria-hidden="true"
            onClick={handleLogoClick}
            style={{ cursor: "pointer", userSelect: "none" }}
            title="Sazón Express"
          >
            S
          </span>
          <div>
            <h1>BigDip Flavor's</h1>
            <p>Pantalla de cocina</p>
          </div>
        </div>

        {/* Botón desplegado tras 3 clics */}
        {showLoginBtn && (
          <button
            type="button"
            className="kds-btn"
            onClick={handleGoToLogin}
            style={{
              background: "var(--brand)",
              color: "#ffffff",
              borderColor: "var(--brand)",
              fontWeight: "700"
            }}
          >
            Ir al Login 🔓
          </button>
        )}

        <p className="kds-total">
          {total} {total === 1 ? "comanda" : "comandas"} en el tablero
        </p>
      </header>

      <div className="kds-toolbar">
        <div className="kds-group">
          <button type="button" className="kds-btn" disabled={!lastUndo} onClick={undo}>
            Deshacer
            {lastUndo && <span className="kds-btn-hint">{undoLabel(lastUndo, orders)}</span>}
          </button>
          <button
            type="button"
            className="kds-btn"
            aria-haspopup="dialog"
            onClick={() => setShowHistory(true)}
          >
            Historial ({history.length})
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <main className="kds-board">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              orders={columns[col.id].map((id) => orders[id])}
              onDeliver={col.id === "listo" ? deliver : undefined}
            />
          ))}
        </main>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeId ? (
            <div className="kds-ticket-wrap is-overlay">
              <Ticket order={orders[activeId]} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showHistory && (
        <HistoryModal
          ids={history}
          orders={orders}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

export default function KanbanBoard({ setView }) {
  return (
    <NowProvider>
      <Board setView={setView} />
    </NowProvider>
  );
}