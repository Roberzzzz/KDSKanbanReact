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
import { useKitchen } from "../../useKitchen";

import "./styles/OrdersPage.css";

const MAX_UNIDADES_PRODUCTO = 15;
const MAX_ITEMS_CARRITO = 50;

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
  // Estado para la ventana flotante de avisos / errores de stock o límites
  const [alertaModal, setAlertaModal] = useState({ visible: false, mensaje: "" });

  const { addOrder } = useKitchen();

  // Función auxiliar para mostrar avisos temporales
  const mostrarAviso = (mensaje) => {
    setAlertaModal({ visible: true, mensaje });
    setTimeout(() => {
      setAlertaModal({ visible: false, mensaje: "" });
    }, 4500);
  };

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

  // ---------- Carrito y Validaciones ----------

  function addToCart(product) {
    const existingItem = cartItems.find((item) => item.id === product.id);
    const cantidadActual = existingItem ? existingItem.quantity : 0;

    // Validar límite máximo por producto (15 unidades)
    if (cantidadActual + 1 > MAX_UNIDADES_PRODUCTO) {
      mostrarAviso(`Límite alcanzado: Solo puedes pedir un máximo de ${MAX_UNIDADES_PRODUCTO} unidades de este producto.`);
      return;
    }

    // Validar límite total de items en el carrito (50 unidades)
    if (totalUnits + 1 > MAX_ITEMS_CARRITO) {
      mostrarAviso(`El carrito está lleno. El límite máximo es de ${MAX_ITEMS_CARRITO} items en total.`);
      return;
    }

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
    const item = cartItems.find((cartItem) => cartItem.id === productId);

    // Validar límite por producto al incrementar
    if (item && item.quantity + 1 > MAX_UNIDADES_PRODUCTO) {
      mostrarAviso(`Límite alcanzado: Solo puedes pedir un máximo de ${MAX_UNIDADES_PRODUCTO} unidades de este producto.`);
      return;
    }

    // Validar límite total de items al incrementar
    if (totalUnits + 1 > MAX_ITEMS_CARRITO) {
      mostrarAviso(`El carrito está lleno. El límite máximo es de ${MAX_ITEMS_CARRITO} items en total.`);
      return;
    }

    setCartItems(
      cartItems.map((cartItem) =>
        cartItem.id === productId ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
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

  // ---------- Pago y confirmación ----------

  function openPayment() {
    if (cartItems.length === 0) return; 
    setPaymentMethod("");
    setIsPaymentOpen(true);
  }

  function closePayment() {
    setIsPaymentOpen(false);
  }

  async function confirmOrder() {
    if (cartItems.length === 0 || paymentMethod === "") return;

    // ID de método de pago según tu tabla 'metodos_pago' (1: Efectivo, 2: Tarjeta)
    const metodoPagoId = paymentMethod === "efectivo" ? 1 : 2;

    const payload = {
      mesa: "Mesa / Local",
      nombre_cliente: "Cliente",
      metodo_pago_id: metodoPagoId,
      items: cartItems.map((item) => ({
        producto_id: item.id,
        cantidad: item.quantity,
        precio_unitario: item.price,
        nota: item.note || "",
      })),
    };

    try {
      const response = await fetch("http://localhost:5000/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const nuevoPedidoBD = await response.json();

        // Estructuramos la orden para el estado local del KDS Kanban
        const newKitchenOrder = {
          id: String(nuevoPedidoBD.id),
          numero: nuevoPedidoBD.numero,
          mesa: "Mesa / Local",
          createdAt: new Date(nuevoPedidoBD.creado_en).getTime(),
          readyAt: null,
          deliveredAt: null,
          estado: "pendiente",
          objetivoMin: 15,
          items: cartItems.map((item) => ({
            cantidad: item.quantity,
            nombre: item.name,
            nota: item.note || "",
            minutos: 10,
          })),
        };

        // Añadir a la vista local del KDS
        addOrder(newKitchenOrder);

        setConfirmedOrder({
          number: "SE-" + nuevoPedidoBD.numero,
          items: cartItems,
          total: total,
          paymentMethod: paymentMethod,
          status: "pendiente",
        });

        setIsPaymentOpen(false);
        setCartItems([]);
        setPaymentMethod("");
      } else {
        // Capturamos el mensaje de error devuelto por el backend (ej. falta de stock de ingredientes)
        const errorData = await response.json();
        setIsPaymentOpen(false); // Cerramos el modal de pago para que vea la alerta
        mostrarAviso(errorData.error || "Error al registrar el pedido en el servidor.");
      }
    } catch (error) {
      console.error("Error de conexión con el backend:", error);
      mostrarAviso("⚠️ Error de conexión con el servidor. Inténtalo de nuevo.");
    }
  }

  function backToMenu() {
    setConfirmedOrder(null);
  }

  return (
    <div className="orders-page">
      {/* Ventana flotante / Modal de aviso intuitivo para límites o errores de stock */}
      {alertaModal.visible && (
        <div className="modal-aviso-flotante">
          <div className="modal-contenido">
            <span>{alertaModal.mensaje}</span>
            <button onClick={() => setAlertaModal({ visible: false, mensaje: "" })}>&times;</button>
          </div>
        </div>
      )}

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