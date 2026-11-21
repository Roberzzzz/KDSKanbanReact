import { useState, useEffect, useRef, useMemo } from "react";
import "./AdminUsers.css";
import "./KanbanDishes.css";
import "./AdminProducts.css";
import {
  API_PRODUCTOS_URL,
  API_INGREDIENTES_URL,
  resolveProductImage,
} from "./productHelpers";

const MAX_IMAGEN_BYTES = 2 * 1024 * 1024; // 2 MB (igual que el backend)
const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp"];

// Solo letras (con tildes/ñ/ü), números y espacios; sin caracteres especiales
const NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

function limpiarNombre(valor) {
  return valor.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+/g, "");
}

function maxDosDecimales(n) {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

function formatoPrecio(n) {
  return "$" + Number(n).toFixed(2);
}

const FORM_VACIO = {
  nombre: "",
  categoria_id: "",
  descripcion: "",
  precio: "",
  tiempo: "",
  disponible: true,
};

export default function AdminProducts() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorLista, setErrorLista] = useState("");

  // Filtros del listado
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Formulario (crear / editar) dentro de una ventana
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [receta, setReceta] = useState([]); // [{ key, ingrediente_id, cantidad }]
  const [imagenActual, setImagenActual] = useState(null); // nombre guardado en la BD
  const [imagenNueva, setImagenNueva] = useState(null); // data URL de la imagen elegida
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const claveFilaRef = useRef(0);

  // Activar / inactivar
  const [productoAInactivar, setProductoAInactivar] = useState(null);
  const [cambiandoId, setCambiandoId] = useState(null);

  // Ventanilla emergente de aviso
  const [aviso, setAviso] = useState({ visible: false, mensaje: "", tipo: "ok" });
  const timerRef = useRef(null);

  const mostrarAviso = (mensaje, tipo = "ok") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAviso({ visible: true, mensaje, tipo });
    timerRef.current = setTimeout(() => {
      setAviso((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ---------- Carga de datos ----------

  const cargarDatos = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [resProd, resCat, resIng] = await Promise.all([
        fetch(`${API_PRODUCTOS_URL}/admin/lista`),
        fetch(`${API_PRODUCTOS_URL}/categorias`),
        fetch(API_INGREDIENTES_URL),
      ]);
      if (!resProd.ok || !resCat.ok || !resIng.ok) {
        throw new Error("Respuesta no válida del servidor");
      }
      const [prod, cat, ing] = await Promise.all([resProd.json(), resCat.json(), resIng.json()]);
      setProductos(prod);
      setCategorias(cat);
      setIngredientes(ing);
      setErrorLista("");
    } catch (err) {
      console.error(err);
      setErrorLista("No se pudieron cargar los productos. Verifica que el servidor esté activo.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Refresca solo el inventario para que la receta use datos actuales
  const refrescarIngredientes = async () => {
    try {
      const res = await fetch(API_INGREDIENTES_URL);
      if (res.ok) setIngredientes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- Listado filtrado ----------

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (texto && !p.nombre.toLowerCase().includes(texto)) return false;
      if (filtroCategoria !== "todas" && String(p.categoria_id) !== filtroCategoria) return false;
      if (filtroEstado === "activos" && !p.disponible) return false;
      if (filtroEstado === "inactivos" && p.disponible) return false;
      return true;
    });
  }, [productos, busqueda, filtroCategoria, filtroEstado]);

  // ---------- Ventana del formulario ----------

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
  };

  useEffect(() => {
    if (!modalAbierto || guardando) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setModalAbierto(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalAbierto, guardando]);

  useEffect(() => {
    if (!productoAInactivar || cambiandoId) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setProductoAInactivar(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [productoAInactivar, cambiandoId]);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setReceta([]);
    setImagenActual(null);
    setImagenNueva(null);
    setErrorForm("");
    setModalAbierto(true);
    refrescarIngredientes();
  };

  const abrirEditar = (producto) => {
    setEditandoId(producto.id);
    setForm({
      nombre: producto.nombre,
      categoria_id: String(producto.categoria_id),
      descripcion: producto.descripcion || "",
      precio: String(producto.precio),
      tiempo: String(producto.tiempo_preparacion_min),
      disponible: producto.disponible,
    });
    setReceta(
      producto.ingredientes.map((ing) => ({
        key: ++claveFilaRef.current,
        ingrediente_id: String(ing.ingrediente_id),
        cantidad: String(ing.cantidad_necesaria),
      }))
    );
    setImagenActual(producto.imagen || null);
    setImagenNueva(null);
    setErrorForm("");
    setModalAbierto(true);
    refrescarIngredientes();
  };

  const cambiarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm("");
  };

  // ---------- Imagen ----------

  const handleImagen = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      setErrorForm("La imagen debe ser PNG, JPG o WEBP.");
      return;
    }
    if (archivo.size > MAX_IMAGEN_BYTES) {
      setErrorForm("La imagen supera el tamaño máximo de 2 MB.");
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      setImagenNueva(lector.result);
      setErrorForm("");
    };
    lector.onerror = () => setErrorForm("No se pudo leer la imagen seleccionada.");
    lector.readAsDataURL(archivo);
  };

  const quitarImagen = () => {
    setImagenNueva(null);
    setImagenActual(null);
  };

  const vistaPrevia = imagenNueva || (imagenActual ? resolveProductImage(imagenActual) : null);

  // ---------- Receta ----------

  const agregarFila = () => {
    setReceta((prev) => [...prev, { key: ++claveFilaRef.current, ingrediente_id: "", cantidad: "" }]);
    if (errorForm) setErrorForm("");
  };

  const cambiarFila = (key, campo, valor) => {
    setReceta((prev) => prev.map((fila) => (fila.key === key ? { ...fila, [campo]: valor } : fila)));
    if (errorForm) setErrorForm("");
  };

  const quitarFila = (key) => {
    setReceta((prev) => prev.filter((fila) => fila.key !== key));
  };

  const ingredientePorId = (id) => ingredientes.find((i) => String(i.id) === String(id));

  // ---------- Validación y guardado ----------

  const validarFormulario = () => {
    const nombre = form.nombre.trim().replace(/\s+/g, " ");
    if (!nombre) return "El nombre del producto es obligatorio.";
    if (nombre.length < 2 || nombre.length > 80) return "El nombre debe tener entre 2 y 80 caracteres.";
    if (!NOMBRE_REGEX.test(nombre)) {
      return "El nombre solo puede contener letras, números y espacios (sin caracteres especiales).";
    }

    if (!form.categoria_id) return "Selecciona una categoría.";

    if (form.descripcion.trim().length > 250) {
      return "La descripción no puede superar los 250 caracteres.";
    }

    const precio = Number(form.precio);
    if (form.precio === "" || Number.isNaN(precio) || precio <= 0) {
      return "El precio debe ser un número mayor a 0.";
    }
    if (precio > 999999.99 || !maxDosDecimales(precio)) {
      return "El precio debe ser menor a 1.000.000 y tener máximo 2 decimales.";
    }

    const tiempo = Number(form.tiempo);
    if (form.tiempo === "" || !Number.isInteger(tiempo) || tiempo < 1 || tiempo > 240) {
      return "El tiempo de preparación debe ser un número entero entre 1 y 240 minutos.";
    }

    const vistos = new Set();
    for (const fila of receta) {
      if (!fila.ingrediente_id) return "Hay un ingrediente sin seleccionar en la receta. Elígelo o quita la fila.";
      if (vistos.has(fila.ingrediente_id)) return "No repitas el mismo ingrediente en la receta.";
      vistos.add(fila.ingrediente_id);

      const cantidad = Number(fila.cantidad);
      const ing = ingredientePorId(fila.ingrediente_id);
      const nombreIng = ing ? ing.nombre : "el ingrediente";
      if (fila.cantidad === "" || Number.isNaN(cantidad) || cantidad <= 0) {
        return `Indica una cantidad mayor a 0 para "${nombreIng}".`;
      }
      if (cantidad > 99999999.99 || !maxDosDecimales(cantidad)) {
        return `La cantidad de "${nombreIng}" es demasiado grande o tiene más de 2 decimales.`;
      }
    }

    return "";
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setErrorForm("");

    const mensaje = validarFormulario();
    if (mensaje) {
      setErrorForm(mensaje);
      return;
    }

    const body = {
      nombre: form.nombre.trim().replace(/\s+/g, " "),
      categoria_id: Number(form.categoria_id),
      descripcion: form.descripcion.trim().replace(/\s+/g, " "),
      precio: Number(form.precio),
      tiempo_preparacion_min: Number(form.tiempo),
      disponible: form.disponible,
      ingredientes: receta.map((fila) => ({
        ingrediente_id: Number(fila.ingrediente_id),
        cantidad_necesaria: Number(fila.cantidad),
      })),
    };
    if (imagenNueva) body.imagen_base64 = imagenNueva;
    else body.imagen = imagenActual;

    const esEdicion = editandoId !== null;
    setGuardando(true);
    try {
      const res = await fetch(esEdicion ? `${API_PRODUCTOS_URL}/${editandoId}` : API_PRODUCTOS_URL, {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || "No se pudo guardar el producto.";
        setErrorForm(msg);
        mostrarAviso(msg, "error");
        return;
      }

      setModalAbierto(false);
      await cargarDatos({ silent: true });
      mostrarAviso(
        esEdicion
          ? `✅ Producto "${data.nombre}" actualizado.`
          : `✅ Producto "${data.nombre}" registrado${data.disponible ? "" : " (inactivo)"}.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión con el servidor.";
      setErrorForm(msg);
      mostrarAviso(msg, "error");
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Activar / inactivar ----------

  const cambiarEstado = async (producto, disponible) => {
    setCambiandoId(producto.id);
    try {
      const res = await fetch(`${API_PRODUCTOS_URL}/${producto.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponible }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        mostrarAviso(data.error || "No se pudo cambiar el estado del producto.", "error");
        return;
      }

      setProductoAInactivar(null);
      await cargarDatos({ silent: true });
      mostrarAviso(
        disponible
          ? `✅ "${producto.nombre}" activado: ya aparece en el menú de los clientes.`
          : `⏸️ "${producto.nombre}" inactivado: ya no aparece en el menú de los clientes.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      mostrarAviso("Error de conexión al cambiar el estado.", "error");
    } finally {
      setCambiandoId(null);
    }
  };

  const resumenReceta = (ings) => {
    if (ings.length === 0) return null;
    const visibles = ings.slice(0, 3).map((i) => i.nombre).join(", ");
    return ings.length > 3 ? `${visibles} +${ings.length - 3}` : visibles;
  };

  // ---------- Pantalla ----------

  return (
    <>
      {aviso.visible && (
        <div className="modal-aviso-flotante" role="status" aria-live="polite">
          <div
            className="modal-contenido"
            style={
              aviso.tipo === "error"
                ? { backgroundColor: "#fbe6d8", color: "#a83e12", borderColor: "#c8501e" }
                : { backgroundColor: "#e6efd9", color: "#3b5f1f", borderColor: "#6a9a4a" }
            }
          >
            <span>{aviso.mensaje}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setAviso((prev) => ({ ...prev, visible: false }))}
              style={aviso.tipo === "error" ? { color: "#a83e12" } : { color: "#3b5f1f" }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Confirmación antes de inactivar */}
      {productoAInactivar && (
        <div
          className="kds-modal-backdrop"
          style={{ zIndex: 1100 }}
          onMouseDown={(e) => {
            if (!cambiandoId && e.target === e.currentTarget) setProductoAInactivar(null);
          }}
        >
          <section
            className="kds-modal admin-products__modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="prod-inactivar-title"
            style={{ maxWidth: 440 }}
          >
            <header className="kds-modal-head">
              <h2 id="prod-inactivar-title">⚠️ Inactivar producto</h2>
              <button
                type="button"
                className="kds-btn kds-modal-close"
                disabled={!!cambiandoId}
                onClick={() => setProductoAInactivar(null)}
              >
                Cerrar
              </button>
            </header>
            <div className="kds-modal-body">
              <p style={{ margin: 0, fontSize: 16 }}>
                Vas a inactivar <strong>{productoAInactivar.nombre}</strong>.
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Dejará de aparecer en el menú de los clientes y no se podrá pedir. Los pedidos ya
                registrados no se ven afectados y puedes volver a activarlo cuando quieras.
              </p>
              <div className="admin-users__actions" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-users__btn admin-users__btn--secondary"
                  disabled={!!cambiandoId}
                  onClick={() => setProductoAInactivar(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="admin-users__btn admin-users__btn--danger"
                  disabled={!!cambiandoId}
                  onClick={() => cambiarEstado(productoAInactivar, false)}
                >
                  {cambiandoId ? "Inactivando..." : "Sí, inactivar"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Formulario de producto */}
      {modalAbierto && (
        <div
          className="kds-modal-backdrop"
          style={{ zIndex: 1050 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarModal();
          }}
        >
          <section
            className="kds-modal admin-products__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prod-form-title"
          >
            <header className="kds-modal-head">
              <h2 id="prod-form-title">{editandoId ? "Editar producto" : "Nuevo producto"}</h2>
              <button
                type="button"
                className="kds-btn kds-modal-close"
                disabled={guardando}
                onClick={cerrarModal}
              >
                Cerrar
              </button>
            </header>

            <form className="kds-modal-body" onSubmit={handleGuardar} noValidate>
              <div className="admin-products__grid">
                <div className="admin-users__field is-full">
                  <label htmlFor="prod-nombre">Nombre del producto</label>
                  <input
                    id="prod-nombre"
                    type="text"
                    maxLength={80}
                    value={form.nombre}
                    disabled={guardando}
                    onChange={(e) => cambiarCampo("nombre", limpiarNombre(e.target.value))}
                    placeholder="Ej. Pizza cuatro quesos"
                  />
                </div>

                <div className="admin-users__field">
                  <label htmlFor="prod-categoria">Categoría</label>
                  <select
                    id="prod-categoria"
                    value={form.categoria_id}
                    disabled={guardando}
                    onChange={(e) => cambiarCampo("categoria_id", e.target.value)}
                  >
                    <option value="">Selecciona una categoría</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-users__field">
                  <label htmlFor="prod-precio">Precio ($)</label>
                  <input
                    id="prod-precio"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.precio}
                    disabled={guardando}
                    onChange={(e) => cambiarCampo("precio", e.target.value)}
                    placeholder="Ej. 8.50"
                  />
                </div>

                <div className="admin-users__field">
                  <label htmlFor="prod-tiempo">Tiempo de preparación (minutos)</label>
                  <input
                    id="prod-tiempo"
                    type="number"
                    min="1"
                    max="240"
                    step="1"
                    value={form.tiempo}
                    disabled={guardando}
                    onChange={(e) => cambiarCampo("tiempo", e.target.value)}
                    placeholder="Ej. 10"
                  />
                </div>

                <div className="admin-users__field">
                  <label htmlFor="prod-estado">Estado</label>
                  <label className="admin-products__check" htmlFor="prod-estado">
                    <input
                      id="prod-estado"
                      type="checkbox"
                      checked={form.disponible}
                      disabled={guardando}
                      onChange={(e) => cambiarCampo("disponible", e.target.checked)}
                    />
                    {form.disponible ? "Activo (visible en el menú)" : "Inactivo (oculto en el menú)"}
                  </label>
                </div>

                <div className="admin-users__field is-full">
                  <label htmlFor="prod-descripcion">Descripción</label>
                  <textarea
                    id="prod-descripcion"
                    maxLength={250}
                    value={form.descripcion}
                    disabled={guardando}
                    onChange={(e) => cambiarCampo("descripcion", e.target.value)}
                    placeholder="Ej. Mozzarella, parmesano, gorgonzola y provolone."
                  />
                  <span className="admin-products__counter">{form.descripcion.length}/250</span>
                </div>
              </div>

              <div>
                <h3 className="admin-products__section-title">Imagen</h3>
                <div className="admin-products__image-box" style={{ marginTop: 10 }}>
                  {vistaPrevia ? (
                    <img className="admin-products__preview" src={vistaPrevia} alt="Vista previa del producto" />
                  ) : (
                    <img
                      className="admin-products__preview"
                      src={resolveProductImage(null)}
                      alt="Producto sin imagen"
                    />
                  )}
                  <div className="admin-products__image-actions">
                    <input
                      className="admin-products__file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={guardando}
                      onChange={handleImagen}
                      aria-label="Elegir imagen del producto"
                    />
                    <span className="admin-products__muted">PNG, JPG o WEBP. Máximo 2 MB.</span>
                    {vistaPrevia && (
                      <button
                        type="button"
                        className="admin-users__small-btn is-warn"
                        disabled={guardando}
                        onClick={quitarImagen}
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-products__recipe">
                <h3 className="admin-products__section-title">Ingredientes de la receta</h3>
                <span className="admin-products__muted">
                  La cantidad se descuenta del inventario por cada unidad pedida, en la unidad de medida del ingrediente.
                </span>

                {receta.length === 0 && (
                  <p className="admin-products__notice">
                    Sin ingredientes: este producto no descontará inventario al venderse.
                  </p>
                )}

                {receta.map((fila) => {
                  const ing = ingredientePorId(fila.ingrediente_id);
                  const usados = new Set(
                    receta.filter((f) => f.key !== fila.key).map((f) => f.ingrediente_id)
                  );
                  return (
                    <div className="admin-products__recipe-row" key={fila.key}>
                      <select
                        aria-label="Ingrediente"
                        value={fila.ingrediente_id}
                        disabled={guardando}
                        onChange={(e) => cambiarFila(fila.key, "ingrediente_id", e.target.value)}
                      >
                        <option value="">Selecciona un ingrediente</option>
                        {ingredientes
                          .filter((i) => !usados.has(String(i.id)))
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nombre} (stock: {Number(i.stock_actual)} {i.unidad_medida})
                            </option>
                          ))}
                      </select>
                      <div className="admin-products__qty">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          aria-label="Cantidad necesaria"
                          placeholder="Cantidad"
                          value={fila.cantidad}
                          disabled={guardando}
                          onChange={(e) => cambiarFila(fila.key, "cantidad", e.target.value)}
                        />
                        <span>{ing ? ing.unidad_medida : ""}</span>
                      </div>
                      <button
                        type="button"
                        className="admin-users__small-btn is-warn"
                        disabled={guardando}
                        onClick={() => quitarFila(fila.key)}
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}

                <div>
                  <button
                    type="button"
                    className="admin-users__small-btn is-ok"
                    disabled={guardando || ingredientes.length === 0}
                    onClick={agregarFila}
                  >
                    + Agregar ingrediente
                  </button>
                  {ingredientes.length === 0 && (
                    <span className="admin-products__muted" style={{ marginLeft: 10 }}>
                      Primero registra ingredientes en la pestaña Inventario.
                    </span>
                  )}
                </div>
              </div>

              {errorForm && <p className="admin-users__error">{errorForm}</p>}

              <div className="admin-products__form-actions">
                <button
                  type="button"
                  className="admin-users__btn admin-users__btn--secondary"
                  disabled={guardando}
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button type="submit" className="admin-users__btn admin-users__btn--primary" disabled={guardando}>
                  {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Registrar producto"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <main className="admin-users__layout">
        <section className="admin-users__card">
          <h2>Productos ({productosFiltrados.length}{productosFiltrados.length !== productos.length ? ` de ${productos.length}` : ""})</h2>

          <div className="admin-products__toolbar">
            <div className="admin-users__field admin-users__field--grow">
              <label htmlFor="prod-busqueda">Buscar por nombre</label>
              <input
                id="prod-busqueda"
                type="text"
                maxLength={80}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej. hamburguesa"
              />
            </div>
            <div className="admin-users__field">
              <label htmlFor="prod-filtro-cat">Categoría</label>
              <select
                id="prod-filtro-cat"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              >
                <option value="todas">Todas</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-users__field">
              <label htmlFor="prod-filtro-estado">Estado</label>
              <select
                id="prod-filtro-estado"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
            <button
              type="button"
              className="admin-users__btn admin-users__btn--primary"
              style={{ flex: "0 0 auto" }}
              onClick={abrirNuevo}
              disabled={loading || !!errorLista}
            >
              + Nuevo producto
            </button>
          </div>

          {errorLista && (
            <p className="admin-users__error">
              {errorLista}{" "}
              <button type="button" className="admin-users__small-btn" onClick={() => cargarDatos()}>
                Reintentar
              </button>
            </p>
          )}

          {loading ? (
            <p>Cargando productos...</p>
          ) : !errorLista && productos.length === 0 ? (
            <p>No hay productos registrados. Crea el primero con «Nuevo producto».</p>
          ) : !errorLista && productosFiltrados.length === 0 ? (
            <p>Ningún producto coincide con los filtros seleccionados.</p>
          ) : (
            !errorLista && (
              <div className="admin-users__table-wrap">
                <table className="admin-users__table">
                  <thead>
                    <tr>
                      <th>Imagen</th>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Precio</th>
                      <th>Preparación</th>
                      <th>Ingredientes</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map((p) => {
                      const resumen = resumenReceta(p.ingredientes);
                      const cambiando = cambiandoId === p.id;
                      return (
                        <tr key={p.id} className={p.disponible ? "" : "is-blocked"}>
                          <td>
                            <img
                              className="admin-products__thumb"
                              src={resolveProductImage(p.imagen)}
                              alt={p.nombre}
                              loading="lazy"
                            />
                          </td>
                          <td>
                            <div className="admin-products__name">{p.nombre}</div>
                            {p.descripcion && (
                              <div className="admin-products__desc" title={p.descripcion}>
                                {p.descripcion}
                              </div>
                            )}
                          </td>
                          <td>{p.categoria}</td>
                          <td>
                            <strong>{formatoPrecio(p.precio)}</strong>
                          </td>
                          <td>{p.tiempo_preparacion_min} min</td>
                          <td>
                            {resumen ? (
                              <span
                                className="admin-products__recipe-summary"
                                title={p.ingredientes
                                  .map((i) => `${i.nombre}: ${i.cantidad_necesaria} ${i.unidad_medida}`)
                                  .join("\n")}
                              >
                                {resumen}
                              </span>
                            ) : (
                              <span className="admin-products__tag admin-products__tag--warn">Sin receta</span>
                            )}
                          </td>
                          <td>
                            <span className={`admin-users__status ${p.disponible ? "is-active" : "is-inactive"}`}>
                              {p.disponible ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            <div className="admin-users__row-actions">
                              <button
                                type="button"
                                className="admin-users__small-btn"
                                disabled={cambiando}
                                onClick={() => abrirEditar(p)}
                              >
                                Editar
                              </button>
                              {p.disponible ? (
                                <button
                                  type="button"
                                  className="admin-users__small-btn is-warn"
                                  disabled={cambiando}
                                  onClick={() => setProductoAInactivar(p)}
                                >
                                  Inactivar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-users__small-btn is-ok"
                                  disabled={cambiando}
                                  onClick={() => cambiarEstado(p, true)}
                                >
                                  {cambiando ? "Activando..." : "Activar"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      </main>
    </>
  );
}
