// KanbanBoard.jsx — Tablero Kanban del KDS (solo interfaz + Drag & Drop)
// Dependencia: npm i @dnd-kit/core
// Estilos en ./KanbanBoard.css
import { useState } from "react";
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

/* ───────────────────────── Datos iniciales ───────────────────────── */

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

// Estado normalizado: las órdenes viven en un diccionario y las columnas
// solo guardan listas de ids. Mover una tarjeta = cambiar un id de lista.
const INITIAL_ORDERS = {
  "101": {
    id: "101",
    numero: 101,
    mesa: "Mesa 4",
    hora: "12:41",
    items: [
      { cantidad: 2, nombre: "Pabellón criollo", nota: "Sin plátano" },
      { cantidad: 6, nombre: "Tequeños" },
      { cantidad: 2, nombre: "Papelón con limón" },
    ],
  },
  "102": {
    id: "102",
    numero: 102,
    mesa: "Para llevar",
    hora: "12:43",
    items: [
      { cantidad: 1, nombre: "Hamburguesa doble", nota: "Sin cebolla" },
      { cantidad: 1, nombre: "Papas fritas" },
    ],
  },
};

const INITIAL_COLUMNS = {
  pendiente: ["101", "102"],
  preparacion: [],
  listo: [],
};

/* ───────────────────────── Tarjeta (comanda) ───────────────────────── */

// Presentacional pura: se reutiliza en la lista y en el DragOverlay.
function Ticket({ order, accent }) {
  return (
    <div className="kds-ticket" style={{ "--accent": accent }}>
      <div className="kds-ticket-head">
        <span className="kds-ticket-num">#{order.numero}</span>
        <span className="kds-ticket-meta">
          <strong>{order.mesa}</strong>
          <span>Ingresó {order.hora}</span>
        </span>
      </div>
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
    </div>
  );
}

function DraggableTicket({ order, accent }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`kds-ticket-wrap${isDragging ? " is-dragging" : ""}`}
      {...listeners}
      {...attributes}
    >
      <Ticket order={order} accent={accent} />
    </div>
  );
}

/* ───────────────────────── Columna ───────────────────────── */

function Column({ column, orders }) {
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
            <DraggableTicket key={order.id} order={order} accent={column.color} />
          ))
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Tablero ───────────────────────── */

export default function KanbanBoard() {
  const [orders] = useState(INITIAL_ORDERS);
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [activeId, setActiveId] = useState(null);

  // Mouse con umbral de distancia; táctil con pulsación corta para no
  // bloquear el scroll de la columna.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const moveOrder = (id, to) =>
    setColumns((prev) => {
      const from = Object.keys(prev).find((c) => prev[c].includes(id));
      if (!from || from === to || !prev[to]) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((x) => x !== id),
        [to]: [...prev[to], id],
      };
    });

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (over) moveOrder(active.id, over.id);
  };

  const activeOrder = activeId ? orders[activeId] : null;
  const activeColumn = activeId
    ? COLUMNS.find((c) => columns[c.id].includes(activeId))
    : null;
  const total = Object.values(columns).reduce((n, ids) => n + ids.length, 0);

  return (
    <div className="kds">
      <header className="kds-top">
        <div className="kds-brand">
          <span className="kds-logo" aria-hidden="true">S</span>
          <div>
            <h1>BigDip Flavor's</h1>
            <p>Pantalla de cocina</p>
          </div>
        </div>
        <p className="kds-total">
          {total} {total === 1 ? "comanda" : "comandas"} en el tablero
        </p>
      </header>

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
            />
          ))}
        </main>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeOrder ? (
            <div className="kds-ticket-wrap is-overlay">
              <Ticket order={activeOrder} accent={activeColumn?.color} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
