import { createContext, useContext, useCallback, useReducer, useEffect } from "react";
import { getInitialOrders } from "./orderService";

export const COLUMN_IDS = ["pendiente", "preparacion", "listo"];
const MAX_UNDO = 30;

const API_BASE_URL = "http://localhost:5000/api";

function createInitialState() {
  return {
    orders: {},
    columns: { pendiente: [], preparacion: [], listo: [] },
    history: [],
    undo: [],
  };
}
const findColumn = (columns, id) => COLUMN_IDS.find((c) => columns[c].includes(id));

function reducer(state, action) {
  switch (action.type) {
    case "SET_ORDERS": {
      const { ordersList } = action;
      const newOrders = {};
      const newColumns = { pendiente: [], preparacion: [], listo: [] };

      ordersList.forEach((o) => {
        newOrders[o.id] = o;
        if (newColumns[o.estado]) {
          newColumns[o.estado].push(o.id);
        } else {
          newColumns.pendiente.push(o.id);
        }
      });

      return {
        ...state,
        orders: newOrders,
        columns: newColumns,
      };
    }

    case "move": {
      const { id, to, now } = action;
      const from = findColumn(state.columns, id);
      if (!from || from === to) return state;

      const order = state.orders[id];
      const fromIndex = state.columns[from].indexOf(id);
      return {
        ...state,
        orders: { ...state.orders, [id]: { ...order, estado: to, readyAt: to === "listo" ? now : order.readyAt } },
        columns: {
          ...state.columns,
          [from]: state.columns[from].filter((x) => x !== id),
          [to]: [...state.columns[to], id],
        },
        undo: [
          ...state.undo,
          { kind: "move", id, from, to, fromIndex, prevReadyAt: order.readyAt },
        ].slice(-MAX_UNDO),
      };
    }

    case "deliver": {
      const { id, now } = action;
      const fromIndex = state.columns.listo.indexOf(id);
      if (fromIndex === -1) return state;

      return {
        ...state,
        orders: { ...state.orders, [id]: { ...state.orders[id], estado: "entregado", deliveredAt: now } },
        columns: { ...state.columns, listo: state.columns.listo.filter((x) => x !== id) },
        history: [id, ...state.history],
        undo: [...state.undo, { kind: "deliver", id, fromIndex }].slice(-MAX_UNDO),
      };
    }

    case "add": {
      const { order } = action;
      return {
        ...state,
        orders: { ...state.orders, [order.id]: order },
        columns: {
          ...state.columns,
          pendiente: [order.id, ...state.columns.pendiente],
        },
      };
    }

    default:
      return state;
  }
}
const KitchenContext = createContext(null);


export function KitchenProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Cargar comandas activas desde PostgreSQL al iniciar
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/pedidos/vista`);
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_ORDERS", ordersList: data });
      }
    } catch (err) {
      console.error("Error al obtener pedidos del backend:", err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Mover pedido entre columnas (actualiza BD)
  const move = useCallback(async (id, to) => {
    dispatch({ type: "move", id, to, now: Date.now() });
    try {
      await fetch(`${API_BASE_URL}/pedidos/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: to }),
      });
    } catch (err) {
      console.error("Error al actualizar estado en la BD:", err);
    }
  }, []);

  // Entregar pedido (actualiza BD a 'entregado')
  const deliver = useCallback(async (id) => {
    dispatch({ type: "deliver", id, now: Date.now() });
    try {
      await fetch(`${API_BASE_URL}/pedidos/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "entregado" }),
      });
    } catch (err) {
      console.error("Error al entregar pedido en la BD:", err);
    }
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);

  const addOrder = useCallback((order) => {
    dispatch({ type: "add", order });
  }, []);

  return (
    <KitchenContext.Provider value={{ state, move, deliver, undo, addOrder, refreshOrders: fetchOrders }}>
      {children}
    </KitchenContext.Provider>
  );
}

export function useKitchen() {
  const context = useContext(KitchenContext);
  if (!context) {
    throw new Error("useKitchen debe ser usado dentro de un KitchenProvider");
  }
  return context;
}
