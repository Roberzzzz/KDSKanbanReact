function buildOrder(numero, mesa, items, createdAt) {
  return {
    id: String(numero),
    numero,
    mesa,
    items,
    objetivoMin: Math.max(...items.map((i) => i.minutos)),
    createdAt,
    readyAt: null,
    deliveredAt: null,
  };
}

export function getInitialOrders(now = Date.now()) {
  return [
    buildOrder(
      101,
      "Mesa 4",
      [
        { cantidad: 2, nombre: "Hamburguesa especial", nota: "Sin tomate", minutos: 10 },
        { cantidad: 1, nombre: "Papas fritas", minutos: 6 },
        { cantidad: 2, nombre: "Refresco", minutos: 2 },
      ],
      now - 3 * 60000
    ),
    buildOrder(
      102,
      "Para llevar",
      [
        { cantidad: 1, nombre: "Hamburguesa clásica", nota: "Sin cebolla", minutos: 8 },
        { cantidad: 1, nombre: "Aros de cebolla", minutos: 6 },
        { cantidad: 1, nombre: "Limonada", minutos: 2 },
      ],
      now - 6.5 * 60000
    ),
    buildOrder(
      103,
      "Mesa 2",
      [
        { cantidad: 1, nombre: "Pizza pepperoni", nota: "Bien cocida", minutos: 14 },
        { cantidad: 2, nombre: "Malteada de fresa", minutos: 4 },
      ],
      now - 1 * 60000
    ),
    buildOrder(
      104,
      "Mesa 7",
      [
        { cantidad: 1, nombre: "Pizza personal", minutos: 12 },
        { cantidad: 1, nombre: "Papas fritas", nota: "Poca sal", minutos: 6 },
        { cantidad: 1, nombre: "Brownie", minutos: 3 },
      ],
      now - 13 * 60000
    ),
  ];
}
