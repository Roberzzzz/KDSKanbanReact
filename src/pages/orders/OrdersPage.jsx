// Página de pedidos del cliente 
// Aquí vive todo el estado de la página; los componentes hijos solo muestran
// datos y avisan cuando el usuario hace algo.

import { useState } from "react";

import OrderHeader from "./components/OrderHeader";
import CategoryFilter from "./components/CategoryFilter";
import ProductGrid from "./components/ProductGrid";
import ShoppingCart from "./components/ShoppingCart";
import PaymentModal from "./components/PaymentModal";
import OrderConfirmation from "./components/OrderConfirmation";
import { categories, products } from "./data/products";

import "./styles/OrdersPage.css";

function OrdersPage({ setView }) {
  // Categoría seleccionada en el filtro del menú
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  // Productos del carrito: { id, name, price, quantity }
  const [cartItems, setCartItems] = useState([]);
  // true cuando la ventana de pago está abierta
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  // Método elegido: "" (ninguno), "efectivo" o "tarjeta"
  const [paymentMethod, setPaymentMethod] = useState("");
  // Pedido confirmado (null mientras no se haya confirmado ninguno)
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Valores calculados a partir del estado

  const visibleProducts =
    selectedCategory === "Todos"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal; 

  //carrito 

  function addToCart(product) {
    const existingItem = cartItems.find((item) => item.id === product.id);

    if (existingItem) {
      setCartItems(
        cartItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCartItems([
        ...cartItems,
        { id: product.id, name: product.name, price: product.price, quantity: 1 },
      ]);
    }
  }

  function increaseQuantity(productId) {
    setCartItems(
      cartItems.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQuantity(productId) {
    const item = cartItems.find((cartItem) => cartItem.id === productId);

    if (item.quantity === 1) {
      removeItem(productId);
    } else {
      setCartItems(
        cartItems.map((cartItem) =>
          cartItem.id === productId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        )
      );
    }
  }

  function removeItem(productId) {
    setCartItems(cartItems.filter((item) => item.id !== productId));
  }

  // ---------- Pago y confirmación (simulados) ----------

  function openPayment() {
    if (cartItems.length === 0) return; 
    setPaymentMethod("");
    setIsPaymentOpen(true);
  }

  function closePayment() {
    setIsPaymentOpen(false);
  }

  function confirmOrder() {
    if (cartItems.length === 0 || paymentMethod === "") return;

    // Objeto local que más adelante podría usar el panel de cocina
    const order = {
      number: "SE-" + Math.floor(1000 + Math.random() * 9000),
      items: cartItems,
      total: total,
      paymentMethod: paymentMethod,
      status: "pendiente",
    };

    setConfirmedOrder(order);
    setIsPaymentOpen(false);
    setCartItems([]);
    setPaymentMethod("");
  }

  function backToMenu() {
    setConfirmedOrder(null);
  }

  return (
    <div className="orders-page">
      <OrderHeader totalUnits={totalUnits} setView={setView}/>

      <div className="orders-page__layout">
        <main className="orders-page__menu">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <ProductGrid products={visibleProducts} onAddToCart={addToCart} />
        </main>

        <ShoppingCart
          cartItems={cartItems}
          subtotal={subtotal}
          total={total}
          onIncrease={increaseQuantity}
          onDecrease={decreaseQuantity}
          onRemove={removeItem}
          onContinue={openPayment}
        />
      </div>

      {isPaymentOpen && (
        <PaymentModal
          cartItems={cartItems}
          total={total}
          paymentMethod={paymentMethod}
          onSelectMethod={setPaymentMethod}
          onConfirm={confirmOrder}
          onClose={closePayment}
        />
      )}

      {confirmedOrder && (
        <OrderConfirmation order={confirmedOrder} onBackToMenu={backToMenu} />
      )}
    </div>
  );
}

export default OrdersPage;
