// Página de pedidos del cliente 
// Aquí vive todo el estado de la página; los componentes hijos solo muestran
// datos y avisan cuando el usuario hace algo.

import { useState, useEffect, useRef } from "react";

import OrderHeader from "./components/OrderHeader";
import CategoryFilter from "./components/CategoryFilter";
import ProductGrid from "./components/ProductGrid";
import ShoppingCart from "./components/ShoppingCart";
import PaymentModal from "./components/PaymentModal";
import OrderConfirmation from "./components/OrderConfirmation";
import { fetchMenu } from "./data/products";
import { useKitchen } from "../../useKitchen";
import { notifyNewOrder } from "../../orderSync";

import "./styles/OrdersPage.css";

const MAX_UNIDADES_PRODUCTO = 15;
const MAX_ITEMS_CARRITO = 50;
const MENSAJE_NO_DISPONIBLE = "¡Lo sentimos! Este producto no está disponible en estos momentos.";

function OrdersPage({ setView, view }) {
  // Categoría seleccionada en el filtro del menú
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  // Productos del carrito: { id, name, price, quantity }
  const [cartItems, setCartItems] = useState([]);
  // true cuando la ventana de pago está abierta
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  // Método elegido: "" (ninguno), "efectivo", "pago_movil" o "tarjeta"
  const [paymentMethod, setPaymentMethod] = useState("");
  // Pedido confirmado (null mientras no se haya confirmado ninguno)
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  // true mientras se registra el pedido en el servidor
  const [processingPayment, setProcessingPayment] = useState(false);
  // Candado para que un mismo pago no genere pedidos duplicados (doble clic, reintentos)
  const submittingRef = useRef(false);
  // Estado para la ventana flotante de avisos / errores de stock o límites
  const [alertaModal, setAlertaModal] = useState({ visible: false, mensaje: "" });

  const { syncOrders } = useKitchen();

  // Función auxiliar para mostrar avisos temporales
  const mostrarAviso = (mensaje) => {
    setAlertaModal({ visible: true, mensaje });
    setTimeout(() => {
      setAlertaModal({ visible: false, mensaje: "" });
    }, 4500);
  };

  // ---------- Menú (desde la base de datos) ----------

  // Productos activos que devuelve el backend y estado de la carga
  const [products, setProducts] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  // Copia del carrito siempre actualizada, para revisarlo cuando se recarga el menú
  const cartRef = useRef(cartItems);
  cartRef.current = cartItems;

  // Las categorías salen de los productos activos: una categoría sin productos activos no se muestra
  const categories = ["Todos", ...new Set(products.map((product) => product.category))];

  async function loadMenu({ avisar = true } = {}) {
    try {
      const menu = await fetchMenu();
      setProducts(menu);
      setMenuError("");

      // Si la categoría elegida ya no existe en el menú, se vuelve a "Todos"
      const nuevasCategorias = new Set(menu.map((product) => product.category));
      setSelectedCategory((actual) =>
        actual === "Todos" || nuevasCategorias.has(actual) ? actual : "Todos"
      );

      // Sincroniza el carrito: quita lo que ya no está activo y actualiza precios
      const menuPorId = new Map(menu.map((product) => [product.id, product]));
      const carritoActual = cartRef.current;
      const quitados = carritoActual.filter((item) => !menuPorId.has(item.id));
      if (quitados.length > 0 || carritoActual.some((item) => menuPorId.get(item.id)?.price !== item.price)) {
        setCartItems(
          carritoActual
            .filter((item) => menuPorId.has(item.id))
            .map((item) => ({ ...item, price: menuPorId.get(item.id).price }))
        );
      }
      if (quitados.length > 0 && avisar) {
        mostrarAviso(
          `Se quitó del carrito porque ya no está disponible: ${quitados.map((item) => item.name).join(", ")}.`
        );
      }
    } catch (error) {
      console.error("Error al cargar el menú:", error);
      setMenuError("No pudimos cargar el menú. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setMenuLoading(false);
    }
  }

  // El menú se consulta cada vez que se muestra esta vista, para reflejar los cambios del admin
  useEffect(() => {
    if (view === undefined || view === "menu") {
      loadMenu();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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

  // Ingredientes consumidos virtualmente por lo que ya está en el carrito
  const consumoCarrito = new Map(); // ingredienteId -> cantidad
  for (const item of cartItems) {
    const prod = products.find((p) => p.id === item.id);
    for (const r of prod?.receta || []) {
      consumoCarrito.set(r.ingredienteId, (consumoCarrito.get(r.ingredienteId) || 0) + r.cantidad * item.quantity);
    }
  }

  // true si, descontando lo del carrito, alcanza para preparar una unidad más del producto
  function canPrepareOneMore(product) {
    return (product.receta || []).every(
      (r) => r.stock - (consumoCarrito.get(r.ingredienteId) || 0) >= r.cantidad - 1e-9
    );
  }

  // ---------- Carrito y Validaciones ----------

  function addToCart(product) {
    if (!canPrepareOneMore(product)) {
      mostrarAviso(MENSAJE_NO_DISPONIBLE);
      return;
    }
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

    const prodInc = products.find((p) => p.id === productId);
    if (prodInc && !canPrepareOneMore(prodInc)) {
      mostrarAviso(MENSAJE_NO_DISPONIBLE);
      return;
    }

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
    if (processingPayment) return;
    setIsPaymentOpen(false);
  }

  // `pago` lo entrega PaymentModal solo cuando el pago quedó aprobado o registrado
  // (o es efectivo); un pago rechazado nunca llega aquí.
  async function confirmOrder(pago) {
    if (cartItems.length === 0 || paymentMethod === "" || !pago || pago.tipo !== paymentMethod) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setProcessingPayment(true);

    const pagoSimulado = paymentMethod !== "efectivo";

    // ID de respaldo según 'metodos_pago' (1: Efectivo, 2: Tarjeta, 3: Pago móvil);
    // el backend resuelve el método por su código.
    const metodoPagoId = { efectivo: 1, tarjeta: 2, pago_movil: 3 }[paymentMethod];

    const payload = {
      mesa: "Mesa / Local",
      nombre_cliente: "Cliente",
      metodo_pago_id: metodoPagoId,
      metodo_pago: paymentMethod,
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

        notifyNewOrder();
        syncOrders();

        setConfirmedOrder({
          number: "SE-" + nuevoPedidoBD.numero,
          items: cartItems,
          total: total,
          paymentMethod: paymentMethod,
          payment: pagoSimulado ? pago : null,
          status: "pendiente",
        });

        setIsPaymentOpen(false);
        setCartItems([]);
        setPaymentMethod("");
      } else {
        // Capturamos el mensaje de error devuelto por el backend (ej. falta de stock de ingredientes)
        const errorData = await response.json();
        setIsPaymentOpen(false); // Cerramos el modal de pago para que vea la alerta
        const detalle = errorData.error || "Error al registrar el pedido en el servidor.";
        mostrarAviso(pagoSimulado ? `${detalle} El pago simulado fue anulado.` : detalle);
        // Si el error fue por un producto que ya no está disponible, se actualiza el menú y el carrito
        loadMenu({ avisar: false });
      }
    } catch (error) {
      console.error("Error de conexión con el backend:", error);
      setIsPaymentOpen(false);
      mostrarAviso(
        pagoSimulado
          ? "⚠️ No pudimos registrar el pedido. El pago simulado fue anulado; inténtalo de nuevo."
          : "⚠️ Error de conexión con el servidor. Inténtalo de nuevo."
      );
    } finally {
      submittingRef.current = false;
      setProcessingPayment(false);
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
          {menuLoading ? (
            <p className="orders-page__empty-products">Cargando el menú...</p>
          ) : menuError ? (
            <p className="orders-page__empty-products">
              {menuError}{" "}
              <button type="button" className="orders-page__add-button" onClick={() => loadMenu()}>
                Reintentar
              </button>
            </p>
          ) : (
            <ProductGrid products={visibleProducts} onAddToCart={addToCart} canPrepare={canPrepareOneMore} />
          )}
        </main>

        <ShoppingCart
          cartItems={cartItems}
          subtotal={subtotal}
          total={total}
          onIncrease={increaseQuantity}
          canIncrease={(id) => { const pr = products.find((p) => p.id === id); return !pr || canPrepareOneMore(pr); }}
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
          processing={processingPayment}
        />
      )}

      {confirmedOrder && (
        <OrderConfirmation order={confirmedOrder} onBackToMenu={backToMenu} />
      )}
    </div>
  );
}

export default OrdersPage;