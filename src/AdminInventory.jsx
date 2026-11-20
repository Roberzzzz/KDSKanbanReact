import { useState, useEffect, useRef } from "react";
import "./KanbanDishes.css";

const API_ING_URL = "http://localhost:5000/api/ingredientes";

// Solo letras (con tildes/ñ/ü), números y espacios; sin caracteres especiales
const NOMBRE_INGREDIENTE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

function limpiarNombreIngrediente(valor) {
  return valor.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+/g, "");
}

export default function AdminInventory() {
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  // Formulario de nuevo ingrediente
  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("unidad");
  const [stockActual, setStockActual] = useState("");

  // Ventanilla emergente de confirmación / aviso
  const [aviso, setAviso] = useState({ visible: false, mensaje: "", tipo: "ok" });
  const timerRef = useRef(null);

  // Sumar stock rápido por fila
  const [cantidadesSumar, setCantidadesSumar] = useState({});

  // Ajustar stock real por fila
  const [ajustandoId, setAjustandoId] = useState(null);
  const [stockAjuste, setStockAjuste] = useState("");
  const [guardandoId, setGuardandoId] = useState(null);

  // Advertencia antes de borrar ingrediente
  const [ingredienteAEliminar, setIngredienteAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

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

  useEffect(() => {
    if (!ingredienteAEliminar || eliminando) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setIngredienteAEliminar(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ingredienteAEliminar, eliminando]);

  const fetchIngredientes = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(API_ING_URL);
      if (res.ok) {
        const data = await res.json();
        setIngredientes(data);
      } else {
        setError("No se pudo cargar el inventario de ingredientes.");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el inventario de ingredientes.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredientes();
  }, []);

  const handleNombreChange = (e) => {
    const limpio = limpiarNombreIngrediente(e.target.value);
    setNombre(limpio);
    if (error) setError("");
  };

  const handleCrearIngrediente = async (e) => {
    e.preventDefault();
    setError("");

    const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
    if (!nombreLimpio) {
      setError("El nombre del ingrediente es obligatorio.");
      return;
    }

    if (!NOMBRE_INGREDIENTE_REGEX.test(nombreLimpio)) {
      setError("El nombre solo puede contener letras, números y espacios (sin caracteres especiales).");
      return;
    }

    const stockNum = stockActual === "" ? 0 : Number(stockActual);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      setError("El stock inicial debe ser un número mayor o igual a 0.");
      return;
    }

    setCreando(true);
    try {
      const res = await fetch(API_ING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreLimpio,
          unidad_medida: unidadMedida,
          stock_actual: stockNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Error al guardar el ingrediente.";
        setError(msg);
        mostrarAviso(msg, "error");
        return;
      }

      setNombre("");
      setUnidadMedida("unidad");
      setStockActual("");
      await fetchIngredientes({ silent: true });

      mostrarAviso(
        `✅ Ingrediente "${data.nombre}" añadido (${Number(data.stock_actual)} ${data.unidad_medida}).`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión con el servidor.";
      setError(msg);
      mostrarAviso(msg, "error");
    } finally {
      setCreando(false);
    }
  };

  const handleAgregarStock = async (ingrediente) => {
    setError("");
    const cantidad = Number(cantidadesSumar[ingrediente.id]);
    const stockAnterior = Number(ingrediente.stock_actual);

    if (!cantidad || cantidad <= 0) {
      setError(`Ingresa una cantidad mayor a 0 para sumar a "${ingrediente.nombre}".`);
      return;
    }

    setGuardandoId(ingrediente.id);
    try {
      const res = await fetch(`${API_ING_URL}/${ingrediente.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "No se pudo sumar el stock.";
        setError(msg);
        mostrarAviso(msg, "error");
        return;
      }

      setCantidadesSumar((prev) => ({ ...prev, [ingrediente.id]: "" }));
      await fetchIngredientes({ silent: true });

      const nuevoStock = Number(data.stock_actual);
      mostrarAviso(
        `✅ ${ingrediente.nombre}: se sumaron +${cantidad} ${ingrediente.unidad_medida} (${stockAnterior} → ${nuevoStock}).`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión al sumar stock.";
      setError(msg);
      mostrarAviso(msg, "error");
    } finally {
      setGuardandoId(null);
    }
  };

  const abrirAjuste = (ingrediente) => {
    setError("");
    setAjustandoId(ingrediente.id);
    setStockAjuste(String(Number(ingrediente.stock_actual)));
  };

  const cancelarAjuste = () => {
    setAjustandoId(null);
    setStockAjuste("");
  };

  const handleGuardarAjuste = async (ingrediente) => {
    setError("");
    const stockAnterior = Number(ingrediente.stock_actual);
    const valorAjustado = Number(stockAjuste);

    if (stockAjuste === "" || Number.isNaN(valorAjustado) || valorAjustado < 0) {
      setError(`Ingresa un stock real válido (0 o mayor) para "${ingrediente.nombre}".`);
      return;
    }

    setGuardandoId(ingrediente.id);
    try {
      const res = await fetch(`${API_ING_URL}/${ingrediente.id}/ajustar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_actual: valorAjustado }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "No se pudo ajustar el stock.";
        setError(msg);
        mostrarAviso(msg, "error");
        return;
      }

      setAjustandoId(null);
      setStockAjuste("");
      await fetchIngredientes({ silent: true });

      const nuevoStock = Number(data.stock_actual);
      mostrarAviso(
        `🔧 Stock de ${ingrediente.nombre} ajustado: ${stockAnterior} → ${nuevoStock} ${ingrediente.unidad_medida}.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión al ajustar el stock.";
      setError(msg);
      mostrarAviso(msg, "error");
    } finally {
      setGuardandoId(null);
    }
  };

  const handleConfirmarBorrar = async () => {
    if (!ingredienteAEliminar) return;

    setError("");
    setEliminando(true);
    try {
      const res = await fetch(`${API_ING_URL}/${ingredienteAEliminar.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "No se pudo borrar el ingrediente.";
        setError(msg);
        mostrarAviso(msg, "error");
        setIngredienteAEliminar(null);
        return;
      }

      if (ajustandoId === ingredienteAEliminar.id) {
        cancelarAjuste();
      }

      const nombreBorrado = ingredienteAEliminar.nombre;
      setIngredienteAEliminar(null);
      await fetchIngredientes({ silent: true });

      mostrarAviso(`🗑️ Ingrediente "${nombreBorrado}" eliminado del inventario.`, "ok");
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión al borrar el ingrediente.";
      setError(msg);
      mostrarAviso(msg, "error");
      setIngredienteAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <>
      {aviso.visible && (
        <div
          className="modal-aviso-flotante"
          role="status"
          aria-live="polite"
        >
          <div
            className="modal-contenido"
            style={
              aviso.tipo === "error"
                ? {
                    backgroundColor: "#fbe6d8",
                    color: "#a83e12",
                    borderColor: "#c8501e",
                  }
                : {
                    backgroundColor: "#e6efd9",
                    color: "#3b5f1f",
                    borderColor: "#6a9a4a",
                  }
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

      {ingredienteAEliminar && (
        <div
          className="kds-modal-backdrop"
          style={{ zIndex: 1100 }}
          onMouseDown={(e) => {
            if (!eliminando && e.target === e.currentTarget) {
              setIngredienteAEliminar(null);
            }
          }}
        >
          <section
            className="kds-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ing-delete-title"
            style={{ maxWidth: 440 }}
          >
            <header className="kds-modal-head">
              <h2 id="ing-delete-title">⚠️ Advertencia al borrar</h2>
              <button
                type="button"
                className="kds-btn kds-modal-close"
                disabled={eliminando}
                onClick={() => setIngredienteAEliminar(null)}
              >
                Cerrar
              </button>
            </header>

            <div className="kds-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
              <p style={{ margin: 0, fontSize: 16 }}>
                Vas a eliminar <strong>{ingredienteAEliminar.nombre}</strong> (stock actual:{" "}
                <strong>
                  {Number(ingredienteAEliminar.stock_actual)} {ingredienteAEliminar.unidad_medida}
                </strong>
                ).
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Esta acción quitará el ingrediente de la base de datos y no se puede deshacer.
              </p>

              <div className="admin-users__actions" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-users__btn admin-users__btn--secondary"
                  disabled={eliminando}
                  onClick={() => setIngredienteAEliminar(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="admin-users__btn admin-users__btn--danger"
                  disabled={eliminando}
                  onClick={handleConfirmarBorrar}
                >
                  {eliminando ? "Borrando..." : "Sí, borrar"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <main className="admin-users__layout">
        {/* Menú / Formulario para añadir nuevos ingredientes */}
        <section className="admin-users__card">
          <h2>Nuevo Ingrediente</h2>

          <form className="admin-users__form" onSubmit={handleCrearIngrediente}>
            <div className="admin-users__field">
              <label htmlFor="ing-nombre">Nombre del ingrediente</label>
              <input
                id="ing-nombre"
                type="text"
                maxLength={60}
                value={nombre}
                disabled={creando}
                onChange={handleNombreChange}
                placeholder="Ej. Carne de res, Queso mozzarella"
              />
            </div>

            <div className="admin-users__field">
              <label htmlFor="ing-unidad">Unidad de medida</label>
              <select
                id="ing-unidad"
                value={unidadMedida}
                disabled={creando}
                onChange={(e) => setUnidadMedida(e.target.value)}
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="litro">Litros (L)</option>
                <option value="ml">Mililitros (ml)</option>
              </select>
            </div>

            <div className="admin-users__field">
              <label htmlFor="ing-stock">Stock inicial</label>
              <input
                id="ing-stock"
                type="number"
                min="0"
                step="0.01"
                value={stockActual}
                disabled={creando}
                onChange={(e) => setStockActual(e.target.value)}
                placeholder="Ej. 50"
              />
            </div>

            {error && <p className="admin-users__error">{error}</p>}

            <div className="admin-users__actions">
              <button
                type="submit"
                className="admin-users__btn admin-users__btn--primary"
                disabled={creando}
              >
                {creando ? "Guardando..." : "Añadir al Inventario"}
              </button>
            </div>
          </form>
        </section>

        {/* Tabla de Inventario Actual */}
        <section className="admin-users__card">
          <h2>Inventario de Ingredientes ({ingredientes.length})</h2>

          {loading ? (
            <p>Cargando inventario...</p>
          ) : ingredientes.length === 0 ? (
            <p>No hay ingredientes registrados en la base de datos.</p>
          ) : (
            <div className="admin-users__table-wrap">
              <table className="admin-users__table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Stock Actual</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((ing) => {
                    const stockNum = Number(ing.stock_actual);
                    const sinStock = stockNum <= 0;
                    const estaAjustando = ajustandoId === ing.id;
                    const estaGuardando = guardandoId === ing.id;

                    return (
                      <tr key={ing.id}>
                        <td><strong>{ing.nombre}</strong></td>
                        <td>
                          <strong>{stockNum}</strong> {ing.unidad_medida}
                        </td>
                        <td>
                          <span
                            className={`admin-users__status ${
                              sinStock ? "is-inactive" : "is-active"
                            }`}
                          >
                            {sinStock ? "Sin stock" : "Disponible"}
                          </span>
                        </td>
                        <td>
                          {estaAjustando ? (
                            <div className="admin-users__restock">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label={`Nuevo stock real para ${ing.nombre}`}
                                value={stockAjuste}
                                disabled={estaGuardando || eliminando}
                                onChange={(e) => setStockAjuste(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleGuardarAjuste(ing);
                                  if (e.key === "Escape") cancelarAjuste();
                                }}
                              />
                              <button
                                type="button"
                                className="admin-users__small-btn is-ok"
                                disabled={estaGuardando || eliminando}
                                onClick={() => handleGuardarAjuste(ing)}
                              >
                                {estaGuardando ? "Guardando..." : "Guardar"}
                              </button>
                              <button
                                type="button"
                                className="admin-users__small-btn"
                                disabled={estaGuardando || eliminando}
                                onClick={cancelarAjuste}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="admin-users__restock">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="+ Cant."
                                aria-label={`Cantidad a sumar para ${ing.nombre}`}
                                value={cantidadesSumar[ing.id] ?? ""}
                                disabled={estaGuardando || eliminando}
                                onChange={(e) =>
                                  setCantidadesSumar((prev) => ({
                                    ...prev,
                                    [ing.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleAgregarStock(ing);
                                }}
                              />
                              <button
                                type="button"
                                className="admin-users__small-btn is-ok"
                                disabled={estaGuardando || eliminando}
                                onClick={() => handleAgregarStock(ing)}
                              >
                                {estaGuardando ? "Sumando..." : "Sumar"}
                              </button>
                              <button
                                type="button"
                                className="admin-users__small-btn"
                                disabled={estaGuardando || eliminando}
                                onClick={() => abrirAjuste(ing)}
                              >
                                Ajustar
                              </button>
                              <button
                                type="button"
                                className="admin-users__small-btn is-warn"
                                disabled={estaGuardando || eliminando}
                                onClick={() => {
                                  setError("");
                                  setIngredienteAEliminar(ing);
                                }}
                              >
                                Borrar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}