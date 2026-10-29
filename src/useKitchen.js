import { useCallback, useReducer } from "react";
import { getInitialOrders } from "./orderService";

export const COLUMN_IDS = ["pendiente", "preparacion", "listo"];
const MAX_UNDO = 30;

function createInitialState() {
  const lista = getInitialOrders();
  return {
    orders: Object.fromEntries(lista.map((o) => [o.id, o])),
    columns: { pendiente: lista.map((o) => o.id), preparacion: [], listo: [] },
    history: [],
    undo: [],
  };
}

const findColumn = (columns, id) => COLUMN_IDS.find((c) => columns[c].includes(id));

function reducer(state, action) {
  switch (action.type) {
    case "move": {
      const { id, to, now } = action;
      const from = findColumn(state.columns, id);
      if (!from || from === to) return state;

      const order = state.orders[id];
      const fromIndex = state.columns[from].indexOf(id);
      return {
        ...state,
        orders: { ...state.orders, [id]: { ...order, readyAt: to === "listo" ? now : null } },
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
        orders: { ...state.orders, [id]: { ...state.orders[id], deliveredAt: now } },
        columns: { ...state.columns, listo: state.columns.listo.filter((x) => x !== id) },
        history: [id, ...state.history],
        undo: [...state.undo, { kind: "deliver", id, fromIndex }].slice(-MAX_UNDO),
      };
    }

    case "undo": {
      const last = state.undo[state.undo.length - 1];
      if (!last) return state;
      const undo = state.undo.slice(0, -1);

      if (last.kind === "move") {
        const { id, from, to, fromIndex, prevReadyAt } = last;
        const destino = [...state.columns[from]];
        destino.splice(Math.min(fromIndex, destino.length), 0, id);
        return {
          ...state,
          undo,
          orders: { ...state.orders, [id]: { ...state.orders[id], readyAt: prevReadyAt } },
          columns: {
            ...state.columns,
            [to]: state.columns[to].filter((x) => x !== id),
            [from]: destino,
          },
        };
      }

      const { id, fromIndex } = last;
      const listo = [...state.columns.listo];
      listo.splice(Math.min(fromIndex, listo.length), 0, id);
      return {
        ...state,
        undo,
        history: state.history.filter((x) => x !== id),
        orders: { ...state.orders, [id]: { ...state.orders[id], deliveredAt: null } },
        columns: { ...state.columns, listo },
      };
    }

    default:
      return state;
  }
}

export function useKitchen() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const move = useCallback((id, to) => dispatch({ type: "move", id, to, now: Date.now() }), []);
  const deliver = useCallback((id) => dispatch({ type: "deliver", id, now: Date.now() }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);

  return { state, move, deliver, undo };
}
