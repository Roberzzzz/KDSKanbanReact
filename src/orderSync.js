export const ORDERS_CHANNEL = "kds-orders";

// Llamar justo después de que el POST del pedido responda OK.
export function notifyNewOrder() {
  if (!("BroadcastChannel" in window)) return;
  const ch = new BroadcastChannel(ORDERS_CHANNEL);
  ch.postMessage("new-order");
  ch.close();
}