// Datos de la página de pedidos: categorías, productos y métodos de pago.
// Las imágenes son ilustraciones locales (carpeta ../assets), así que no
// dependen de enlaces externos que puedan dejar de funcionar.

import hamburguesaClasica from "../assets/hamburguesa-clasica.svg";
import hamburguesaEspecial from "../assets/hamburguesa-especial.svg";
import pizzaPersonal from "../assets/pizza-personal.svg";
import pizzaPepperoni from "../assets/pizza-pepperoni.svg";
import papasFritas from "../assets/papas-fritas.svg";
import arosDeCebolla from "../assets/aros-de-cebolla.svg";
import refresco from "../assets/refresco.svg";
import limonada from "../assets/limonada.svg";
import brownie from "../assets/brownie.svg";
import malteada from "../assets/malteada.svg";

export const categories = [
  "Todos",
  "Hamburguesas",
  "Pizzas",
  "Acompañantes",
  "Bebidas",
  "Postres",
];

export const products = [
  {
    id: 1,
    name: "Hamburguesa clásica",
    category: "Hamburguesas",
    price: 6.5,
    description: "Carne de res, queso, lechuga y salsa de la casa.",
    image: hamburguesaClasica,
  },
  {
    id: 2,
    name: "Hamburguesa especial",
    category: "Hamburguesas",
    price: 8.5,
    description: "Doble carne, queso, tomate, tocineta y lechuga.",
    image: hamburguesaEspecial,
  },
  {
    id: 3,
    name: "Pizza personal",
    category: "Pizzas",
    price: 7.0,
    description: "Salsa de tomate, queso mozzarella y albahaca.",
    image: pizzaPersonal,
  },
  {
    id: 4,
    name: "Pizza pepperoni",
    category: "Pizzas",
    price: 8.0,
    description: "Mozzarella derretida y abundante pepperoni.",
    image: pizzaPepperoni,
  },
  {
    id: 5,
    name: "Papas fritas",
    category: "Acompañantes",
    price: 2.5,
    description: "Crujientes, doradas y recién hechas.",
    image: papasFritas,
  },
  {
    id: 6,
    name: "Aros de cebolla",
    category: "Acompañantes",
    price: 3.0,
    description: "Empanizados y fritos, con salsa para mojar.",
    image: arosDeCebolla,
  },
  {
    id: 7,
    name: "Refresco",
    category: "Bebidas",
    price: 1.5,
    description: "Bebida gaseosa bien fría.",
    image: refresco,
  },
  {
    id: 8,
    name: "Limonada",
    category: "Bebidas",
    price: 2.0,
    description: "Limón natural, hielo y un toque de azúcar.",
    image: limonada,
  },
  {
    id: 9,
    name: "Malteada de fresa",
    category: "Bebidas",
    price: 3.5,
    description: "Cremosa, con crema batida y una cereza.",
    image: malteada,
  },
  {
    id: 10,
    name: "Brownie",
    category: "Postres",
    price: 2.0,
    description: "Chocolate intenso con trocitos de chocolate.",
    image: brownie,
  },
];

export const paymentMethods = [
  {
    id: "efectivo",
    label: "Efectivo",
    description: "Pagas al recibir tu pedido.",
  },
  {
    id: "tarjeta",
    label: "Tarjeta",
    description: "Pago simulado, sin datos bancarios.",
  },
];

// Convierte un número en un precio en dólares, por ejemplo 6.5 -> "$6.50"
export function formatPrice(amount) {
  return "$" + amount.toFixed(2);
}
