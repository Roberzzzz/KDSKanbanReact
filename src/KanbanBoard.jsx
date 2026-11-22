import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./KanbanBoard.css";
import "./KanbanDishes.css";
import "./KanbanRules.css";
import "./KanbanSort.css";
import "./KanbanHistory.css";
import "./KanbanMobile.css";
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
import { useKitchen, COLUMN_IDS, canMove } from "./useKitchen";
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

const SORT_KEY = "kds-orden";
const MOBILE_QUERY = "(max-width: 700px)";

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && Boolean(window.matchMedia) && window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return mobile;
}

const neighbors = (estado) => {
  const i = COLUMN_IDS.indexOf(estado);
  if (i === -1) return { prev: null, next: null };
  return { prev: COLUMN_IDS[i - 1] ?? null, next: COLUMN_IDS[i + 1] ?? null };
};

function loadSort() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(SORT_KEY));
  } catch {
    saved = null;
  }
  const sort = {};
  COLUMN_IDS.forEach((c) => {
    sort[c] = saved?.[c] === "desc" ? "desc" : "asc";
  });
  return sort;
}

function saveSort(sort) {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(sort));
  } catch {
    return false;
  }
  return true;
}

const sortOrders = (list, dir) => {
  const sign = dir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => sign * (a.createdAt - b.createdAt || a.numero - b.numero));
};

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

// Cuenta regresiva de UN plato: tiempo estimado del producto menos lo que lleva.
// Pasado el tiempo sigue contando en negativo (−01:20).
function DishTimer({ item }) {
  const now = useNow();
  const elapsed = now - item.startedAt;
  const remaining = item.minutos * 60000 - elapsed;
  const status = timerStatus(elapsed, item.minutos);
  const text = remaining >= 0 ? formatElapsed(remaining) : `−${formatElapsed(-remaining)}`;

  let label = "";
  if (status === "late") label = "Retraso";
  else if (status === "warn") label = "Por vencer";

  return (
    <span
      className={`kds-dish-timer is-${status}`}
      role="timer"
      aria-label={`${label} ${text}`.trim()}
    >
      {label && <span className="kds-timer-label">{label}</span>}
      {text}
    </span>
  );
}

// Estado de cada plato según la columna:
// pendiente -> tiempo estimado | preparación -> cuenta regresiva + "Listo" | listo -> terminado
function Dish({ order, item, onItemDone }) {
  const minutos = item.minutos || 0;
  const terminado =
    order.estado === "listo" || (order.estado === "preparacion" && item.doneAt != null);

  if (terminado) {
    return (
      <span className="kds-dish">
        <span className="kds-dish-tag">✓ Listo</span>
      </span>
    );
  }

  if (order.estado === "preparacion" && item.startedAt != null) {
    return (
      <span className="kds-dish">
        {minutos > 0 && <DishTimer item={item} />}
        {onItemDone && item.id != null && (
          <button
            type="button"
            className="kds-dish-done"
            onMouseDown={stop}
            onTouchStart={stop}
            onClick={() => onItemDone(order.id, item.id)}
          >
            Listo
          </button>
        )}
      </span>
    );
  }

  return minutos > 0 ? (
    <span className="kds-dish">
      <span className="kds-dish-est">{minutos} min</span>
    </span>
  ) : null;
}

function MoveActions({ order, onMove }) {
  const { prev, next } = neighbors(order.estado);
  if (!prev && !next) return null;
  return (
    <div className="kds-move">
      {prev && (
        <button
          type="button"
          className="kds-btn kds-move-btn"
          onMouseDown={stop}
          onTouchStart={stop}
          onClick={() => onMove(order.id, prev)}
        >
          ← {COLUMN_TITLES[prev]}
        </button>
      )}
      {next && (
        <button
          type="button"
          className="kds-deliver kds-move-next"
          onMouseDown={stop}
          onTouchStart={stop}
          onClick={() => onMove(order.id, next)}
        >
          {COLUMN_TITLES[next]} →
        </button>
      )}
    </div>
  );
}

function Ticket({ order, onDeliver, onItemDone, onMove }) {
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
          <li key={item.id ?? i}>
            <span className="kds-qty">{item.cantidad}×</span>
            <span className="kds-item-body">
              <span className="kds-item-name">{item.nombre}</span>
              {item.nota && <span className="kds-note">{item.nota}</span>}
              <Dish order={order} item={item} onItemDone={onItemDone} />
            </span>
          </li>
        ))}
      </ul>
      {onMove && <MoveActions order={order} onMove={onMove} />}
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

const DraggableTicket = memo(function DraggableTicket({ order, onDeliver, onItemDone, onMove }) {
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
      <Ticket order={order} onDeliver={onDeliver} onItemDone={onItemDone} onMove={onMove} />
    </div>
  );
});

function LateCount({ orders }) {
  const now = useNow();
  const late = orders.filter(
    (o) => o.readyAt == null && timerStatus(now - o.createdAt, o.objetivoMin) === "late"
  ).length;
  if (late === 0) return null;
  return <span className="kds-late-count">{late} con retraso</span>;
}

function Column({ column, orders, sort, blocked, onToggleSort, onDeliver, onItemDone, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: blocked });

  return (
    <section
      ref={setNodeRef}
      className={`kds-col${isOver ? " is-over" : ""}${blocked ? " is-blocked" : ""}`}
      style={{ "--accent": column.color }}
      aria-label={column.title}
    >
      <header className="kds-col-head">
        <h2>{column.title}</h2>
        <span className="kds-count">{orders.length}</span>
      </header>
      <div className="kds-col-tools">
        <LateCount orders={orders} />
        <button
          type="button"
          className="kds-btn kds-sort"
          onClick={onToggleSort}
          aria-label={`Orden: ${sort === "asc" ? "más viejo primero" : "más nuevo primero"}. Cambiar orden`}
        >
          {sort === "asc" ? "Más viejo primero" : "Más nuevo primero"}
        </button>
      </div>
      <div className="kds-col-body">
        {blocked && (
          <p className="kds-blocked-hint">Primero debe pasar por {COLUMN_TITLES.preparacion}</p>
        )}
        {orders.length === 0 ? (
          <p className="kds-empty">{column.empty}</p>
        ) : (
          orders.map((order) => (
            <DraggableTicket
              key={order.id}
              order={order}
              onDeliver={onDeliver}
              onItemDone={onItemDone}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </section>
  );
}

function HistoryModal({ ids, orders, onClose, onReopen }) {
  const closeRef = useRef(null);
  const [confirmId, setConfirmId] = useState(null);

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
                    <span className="kds-h-actions">
                      {confirmId === id ? (
                        <>
                          <span className="kds-h-ask">¿Devolver a Listo?</span>
                          <button
                            type="button"
                            className="kds-btn kds-h-confirm"
                            onClick={() => {
                              setConfirmId(null);
                              onReopen(id);
                            }}
                          >
                            Sí, reabrir
                          </button>
                          <button
                            type="button"
                            className="kds-btn kds-h-cancel"
                            onClick={() => setConfirmId(null)}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="kds-btn kds-h-reopen"
                          aria-label={`Reabrir comanda #${o.numero}`}
                          onClick={() => setConfirmId(id)}
                        >
                          Reabrir
                        </button>
                      )}
                    </span>
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

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="kds-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <section
        className="kds-modal kds-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kds-confirm-title"
        aria-describedby="kds-confirm-msg"
      >
        <header className="kds-modal-head">
          <h2 id="kds-confirm-title">{title}</h2>
        </header>
        <div className="kds-modal-body">
          <p id="kds-confirm-msg" className="kds-confirm-msg">
            {message}
          </p>
          <div className="kds-confirm-actions">
            <button ref={cancelRef} type="button" className="kds-btn" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="kds-btn kds-h-confirm" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function undoLabel(entry, orders) {
  if (!entry) return "";
  const n = orders[entry.id]?.numero;
  if (entry.kind === "move") return `#${n} → ${COLUMN_TITLES[entry.to]}`;
  if (entry.kind === "item") return `plato de #${n}`;
  if (entry.kind === "reopen") return `reapertura de #${n}`;
  return `entrega #${n}`;
}

function Board({ setView, currentUser, onLogout }) { // <--- Agrégalos aquí
  const { state, move, deliver, reopen, undo, markItemDone, refreshHistory } = useKitchen();
  const { orders, columns, history } = state;

  const [activeId, setActiveId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  
  // Estado para controlar los 3 clics en el logo
  const [clickCount, setClickCount] = useState(0);
  const [showLoginBtn, setShowLoginBtn] = useState(false);
  const [sort, setSort] = useState(loadSort);
  const isMobile = useIsMobile();

  useEffect(() => {
    saveSort(sort);
  }, [sort]);

  const toggleSort = (id) =>
    setSort((s) => ({ ...s, [id]: s[id] === "asc" ? "desc" : "asc" }));

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

  const requestUndo = useCallback(() => {
    const last = state.undo[state.undo.length - 1];
    if (last?.kind === "deliver") setConfirmUndo(true);
    else undo();
  }, [state.undo, undo]);

  useEffect(() => {
    const onKey = (e) => {
      const visible = rootRef.current && rootRef.current.offsetParent !== null;
      if (
        visible &&
        !showHistory &&
        !confirmUndo &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        requestUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestUndo, showHistory, confirmUndo]);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (over && COLUMN_IDS.includes(over.id)) move(active.id, over.id);
  };

  const activeFrom = activeId ? COLUMN_IDS.find((c) => columns[c].includes(activeId)) : null;

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
        {/* Botón condicional para Administradores */}
        {currentUser?.rol === "admin" && (
          <button
            type="button"
            className="kds-btn"
            onClick={() => setView("admin")}
            style={{ background: "var(--brand)", color: "#fff", fontWeight: "700" }}
          >
            Administrar Usuarios
          </button>
        )}

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
          <button type="button" className="kds-btn" disabled={!lastUndo} onClick={requestUndo}>
            Deshacer
            {lastUndo && <span className="kds-btn-hint">{undoLabel(lastUndo, orders)}</span>}
          </button>
          <button
            type="button"
            className="kds-btn"
            aria-haspopup="dialog"
            onClick={() => {
              refreshHistory();
              setShowHistory(true);
            }}
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
              orders={sortOrders(columns[col.id].map((id) => orders[id]), sort[col.id])}
              sort={sort[col.id]}
              onToggleSort={() => toggleSort(col.id)}
              blocked={Boolean(activeFrom) && col.id !== activeFrom && !canMove(activeFrom, col.id)}
              onDeliver={col.id === "listo" ? deliver : undefined}
              onItemDone={markItemDone}
              onMove={isMobile ? move : undefined}
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
          onReopen={reopen}
          onClose={() => setShowHistory(false)}
        />
      )}

      {confirmUndo && lastUndo && (
        <ConfirmDialog
          title={`¿Reabrir la comanda #${orders[lastUndo.id]?.numero ?? ""}?`}
          message="Volverá a la columna Listo y dejará de figurar como entregada."
          confirmLabel="Sí, reabrir"
          onConfirm={() => {
            setConfirmUndo(false);
            undo();
          }}
          onCancel={() => setConfirmUndo(false)}
        />
      )}
    </div>
  );
}

export default function KanbanBoard({ setView, currentUser, onLogout }) {
  return (
    <NowProvider>
      <Board setView={setView} currentUser={currentUser} onLogout={onLogout} />
    </NowProvider>
  );
}