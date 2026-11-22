import { createContext, useContext, useCallback, useReducer, useEffect, useRef } from "react";
import { ORDERS_CHANNEL } from "./orderSync";

export const COLUMN_IDS = ["pendiente", "preparacion", "listo"];

export const canMove = (from, to) =>
  COLUMN_IDS.includes(from) &&
  COLUMN_IDS.includes(to) &&
  Math.abs(COLUMN_IDS.indexOf(from) - COLUMN_IDS.indexOf(to)) === 1;
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

      // La API solo devuelve comandas activas: conservamos las ya entregadas
      // que el historial necesita para mostrarse.
      const kept = {};
      state.history.forEach((id) => {
        if (state.orders[id]) kept[id] = state.orders[id];
      });

      return {
        ...state,
        orders: { ...kept, ...newOrders },
        columns: newColumns,
      };
    }

    case "SET_HISTORY": {
      const { ordersList } = action;
      const orders = { ...state.orders };
      const history = [];
      ordersList.forEach((o) => {
        if (findColumn(state.columns, o.id)) return;
        orders[o.id] = o;
        history.push(o.id);
      });
      return { ...state, orders, history };
    }

    case "MERGE_ORDERS": {
      const { ordersList, returnFromHistory } = action;
      const fresh = ordersList.filter(
        (o) =>
          !state.orders[o.id] ||
          (returnFromHistory && state.history.includes(o.id) && !findColumn(state.columns, o.id))
      );
      if (fresh.length === 0) return state;

      const orders = { ...state.orders };
      const columns = { ...state.columns };
      let history = state.history;
      fresh.forEach((o) => {
        orders[o.id] = o;
        const col = columns[o.estado] ? o.estado : "pendiente";
        columns[col] = [...columns[col], o.id];
        history = history.filter((x) => x !== o.id);
      });
      return { ...state, orders, columns, history };
    }

    case "move": {
      const { id, to, now } = action;
      const from = findColumn(state.columns, id);
      if (!from || from === to || !canMove(from, to)) return state;

      const order = state.orders[id];
      const fromIndex = state.columns[from].indexOf(id);

      // Al pasar a preparación arrancan las cuentas regresivas de cada plato;
      // si vuelve a pendiente, se reinician (igual que hace el backend).
      let items = order.items;
      if (to === "preparacion") {
        items = items.map((i) => (i.startedAt == null ? { ...i, startedAt: now } : i));
      } else if (to === "pendiente") {
        items = items.map((i) => ({ ...i, startedAt: null, doneAt: null }));
      }

      return {
        ...state,
        orders: {
          ...state.orders,
          [id]: { ...order, estado: to, readyAt: to === "listo" ? now : null, items },
        },
        columns: {
          ...state.columns,
          [from]: state.columns[from].filter((x) => x !== id),
          [to]: [...state.columns[to], id],
        },
        undo: [
          ...state.undo,
          { kind: "move", id, from, to, fromIndex, prevReadyAt: order.readyAt, prevItems: order.items },
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

    case "reopen": {
      const { id } = action;
      const order = state.orders[id];
      const historyIndex = state.history.indexOf(id);
      if (!order || historyIndex === -1) return state;

      return {
        ...state,
        orders: { ...state.orders, [id]: { ...order, estado: "listo", deliveredAt: null } },
        columns: { ...state.columns, listo: [...state.columns.listo, id] },
        history: state.history.filter((x) => x !== id),
        undo: [
          ...state.undo,
          { kind: "reopen", id, historyIndex, prevDeliveredAt: order.deliveredAt },
        ].slice(-MAX_UNDO),
      };
    }

    case "itemDone": {
      const { orderId, itemId, now } = action;
      const order = state.orders[orderId];
      if (!order) return state;
      const prev = order.items.find((i) => i.id === itemId);
      if (!prev || prev.doneAt != null) return state;

      const items = order.items.map((i) =>
        i.id === itemId ? { ...i, doneAt: now, startedAt: i.startedAt ?? now } : i
      );
      const entry = { kind: "item", id: orderId, itemId, prevStartedAt: prev.startedAt, moved: null };

      // Si era el último plato pendiente, la comanda pasa sola a "Listo"
      // (el backend aplica la misma regla).
      if (items.every((i) => i.doneAt != null) && order.estado === "preparacion") {
        entry.moved = {
          from: "preparacion",
          fromIndex: state.columns.preparacion.indexOf(orderId),
          prevReadyAt: order.readyAt,
        };
        return {
          ...state,
          orders: { ...state.orders, [orderId]: { ...order, items, estado: "listo", readyAt: now } },
          columns: {
            ...state.columns,
            preparacion: state.columns.preparacion.filter((x) => x !== orderId),
            listo: [...state.columns.listo, orderId],
          },
          undo: [...state.undo, entry].slice(-MAX_UNDO),
        };
      }

      return {
        ...state,
        orders: { ...state.orders, [orderId]: { ...order, items } },
        undo: [...state.undo, entry].slice(-MAX_UNDO),
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
          orders: {
            ...state.orders,
            [id]: { ...state.orders[id], estado: from, readyAt: prevReadyAt, items: last.prevItems },
          },
          columns: {
            ...state.columns,
            [to]: state.columns[to].filter((x) => x !== id),
            [from]: destino,
          },
        };
      }

      if (last.kind === "item") {
        const { id, itemId, prevStartedAt, moved } = last;
        const order = state.orders[id];
        if (!order) return { ...state, undo };

        const items = order.items.map((i) =>
          i.id === itemId ? { ...i, doneAt: null, startedAt: prevStartedAt } : i
        );
        let next = { ...state, undo, orders: { ...state.orders, [id]: { ...order, items } } };

        if (moved) {
          const destino = [...state.columns[moved.from]];
          destino.splice(Math.min(moved.fromIndex, destino.length), 0, id);
          next = {
            ...next,
            orders: {
              ...next.orders,
              [id]: { ...next.orders[id], estado: moved.from, readyAt: moved.prevReadyAt },
            },
            columns: {
              ...state.columns,
              listo: state.columns.listo.filter((x) => x !== id),
              [moved.from]: destino,
            },
          };
        }
        return next;
      }

      if (last.kind === "reopen") {
        const { id, historyIndex, prevDeliveredAt } = last;
        const history = [...state.history];
        history.splice(Math.min(historyIndex, history.length), 0, id);
        return {
          ...state,
          undo,
          history,
          orders: {
            ...state.orders,
            [id]: { ...state.orders[id], estado: "entregado", deliveredAt: prevDeliveredAt },
          },
          columns: { ...state.columns, listo: state.columns.listo.filter((x) => x !== id) },
        };
      }

      // kind === "deliver": la comanda vuelve a "Listo" en su posición original
      const { id, fromIndex } = last;
      const listo = [...state.columns.listo];
      listo.splice(Math.min(fromIndex, listo.length), 0, id);
      return {
        ...state,
        undo,
        history: state.history.filter((x) => x !== id),
        orders: {
          ...state.orders,
          [id]: { ...state.orders[id], estado: "listo", deliveredAt: null },
        },
        columns: { ...state.columns, listo },
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

const patchJson = (url, body) =>
  fetch(`${API_BASE_URL}${url}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });


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

  const pendingMutations = useRef(0);
  const mutationVersion = useRef(0);

  const fetchHistory = useCallback(async (force = false) => {
    if (!force && pendingMutations.current > 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/pedidos/historial`);
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_HISTORY", ordersList: data });
      }
    } catch (err) {
      console.error("Error al obtener el historial del backend:", err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchHistory();
  }, [fetchOrders, fetchHistory]);

  useEffect(() => {
    const id = setInterval(fetchHistory, 60000);
    const onVisible = () => {
      if (!document.hidden) fetchHistory();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchHistory]);

  const syncOrders = useCallback(async () => {
    const version = mutationVersion.current;
    try {
      const res = await fetch(`${API_BASE_URL}/pedidos/vista`);
      if (res.ok) {
        const data = await res.json();
        const returnFromHistory =
          pendingMutations.current === 0 && mutationVersion.current === version;
        dispatch({ type: "MERGE_ORDERS", ordersList: data, returnFromHistory });
      }
    } catch (err) {
      console.error("Error al sincronizar pedidos:", err);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(syncOrders, 3000);

    const onVisible = () => {
      if (!document.hidden) syncOrders();
    };
    document.addEventListener("visibilitychange", onVisible);

    let channel;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(ORDERS_CHANNEL);
      channel.onmessage = syncOrders;
    }

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [syncOrders]);

  // Mover pedido entre columnas (actualiza BD)
  const move = useCallback(
    async (id, to) => {
      const from = findColumn(state.columns, id);
      if (!from || !canMove(from, to)) return;
      dispatch({ type: "move", id, to, now: Date.now() });
      try {
        const res = await fetch(`${API_BASE_URL}/pedidos/${id}/estado`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: to }),
        });
        if (!res.ok) fetchOrders();
      } catch (err) {
        console.error("Error al actualizar estado en la BD:", err);
      }
    },
    [state.columns, fetchOrders]
  );

  // Entregar pedido (actualiza BD a 'entregado')
  const deliver = useCallback(async (id) => {
    dispatch({ type: "deliver", id, now: Date.now() });
    pendingMutations.current += 1;
    mutationVersion.current += 1;
    try {
      const res = await fetch(`${API_BASE_URL}/pedidos/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "entregado" }),
      });
      if (!res.ok) fetchOrders();
    } catch (err) {
      console.error("Error al entregar pedido en la BD:", err);
    } finally {
      pendingMutations.current -= 1;
    }
    fetchHistory();
  }, [fetchHistory, fetchOrders]);

  // Marcar un plato como terminado (si es el último, la comanda pasa a "Listo")
  const markItemDone = useCallback(async (orderId, itemId) => {
    dispatch({ type: "itemDone", orderId, itemId, now: Date.now() });
    try {
      await patchJson(`/pedidos/${orderId}/items/${itemId}`, { terminado: true });
    } catch (err) {
      console.error("Error al marcar el plato en la BD:", err);
    }
  }, []);

  // Deshacer: revierte la pantalla y también el estado guardado en la BD
  const undo = useCallback(async () => {
    const last = state.undo[state.undo.length - 1];
    if (!last) return;
    dispatch({ type: "undo" });
    pendingMutations.current += 1;
    mutationVersion.current += 1;

    try {
      const respuestas = [];
      if (last.kind === "item") {
        if (last.moved) {
          respuestas.push(await patchJson(`/pedidos/${last.id}/estado`, { estado: last.moved.from }));
        }
        respuestas.push(await patchJson(`/pedidos/${last.id}/items/${last.itemId}`, { terminado: false }));
      } else {
        const destino = { move: last.from, reopen: "entregado", deliver: "listo" }[last.kind];
        respuestas.push(await patchJson(`/pedidos/${last.id}/estado`, { estado: destino }));
      }
      if (respuestas.some((r) => !r.ok)) fetchOrders();
    } catch (err) {
      console.error("Error al deshacer en la BD:", err);
    } finally {
      pendingMutations.current -= 1;
    }
    fetchHistory();
  }, [state.undo, fetchHistory, fetchOrders]);

  const reopen = useCallback(
    async (id) => {
      if (!state.history.includes(id)) return;
      dispatch({ type: "reopen", id });
      pendingMutations.current += 1;
      mutationVersion.current += 1;
      try {
        const res = await patchJson(`/pedidos/${id}/estado`, { estado: "listo" });
        if (!res.ok) fetchOrders();
      } catch (err) {
        console.error("Error al reabrir el pedido en la BD:", err);
      } finally {
        pendingMutations.current -= 1;
      }
      fetchHistory();
    },
    [state.history, fetchOrders, fetchHistory]
  );

  const addOrder = useCallback((order) => {
    dispatch({ type: "add", order });
  }, []);

  return (
    <KitchenContext.Provider value={{ state, move, deliver, reopen, undo, markItemDone, addOrder, refreshOrders: fetchOrders, refreshHistory: fetchHistory, syncOrders }}>
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
