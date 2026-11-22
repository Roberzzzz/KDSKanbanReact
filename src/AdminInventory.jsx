import { useState, useEffect, useRef } from "react";
import "./KanbanDishes.css";

const API_ING_URL = "http://localhost:5000/api/ingredientes";

const NOMBRE_INGREDIENTE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

function limpiarNombreIngrediente(valor) {
  return valor.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+/g, "");
}

export default function AdminInventory() {
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("unidad");
  const [stockActual, setStockActual] = useState("");

  const [aviso, setAviso] = useState({ visible: false, mensaje: "", tipo: "ok" });
  const timerRef = useRef(null);

  const [cantidadesSumar, setCantidadesSumar] = useState({});

  const [ajustandoId, setAjustandoId] = useState(null);
  const [stockAjuste, setStockAjuste] = useState("");
  const [guardandoId, setGuardandoId] = useState(null);

  const [ingredienteAInactivar, setIngredienteAInactivar] = useState(null);
  const [recetasEnUso, setRecetasEnUso] = useState([]);
  const [cargandoRecetas, setCargandoRecetas] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const mostrarAviso = (mensaje, tipo = "ok") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAviso({ visible: true, mensaje, tipo });
    timerRef.current = setTimeout(() => {
      setAviso((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  const validarRangoValor = (valor, etiquetaCampo) => {
    if (valor === "" || valor === "-") return true;
    const num = Number(valor);
    if (Number.isNaN(num)) return true;

    if (num < 0) {
      mostrarAviso(`⚠️ ${etiquetaCampo} no puede ser menor a 0.`, "error");
      return false;
    }

    return true;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cerrarModalInactivar = () => {
    if (cambiandoEstado) return;
    setIngredienteAInactivar(null);
    setRecetasEnUso([]);
    setCargandoRecetas(false);
  };

  useEffect(() => {
    if (!ingredienteAInactivar || cambiandoEstado) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        cerrarModalInactivar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ingredienteAInactivar, cambiandoEstado]);

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
      const msg = "El stock inicial no puede ser menor a 0.";
      setError(msg);
      mostrarAviso(`⚠️ ${msg}`, "error");
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
    const rawValor = cantidadesSumar[ingrediente.id];
    const cantidad = Number(rawValor);
    const stockAnterior = Number(ingrediente.stock_actual);

    if (rawValor === undefined || rawValor === "" || Number.isNaN(cantidad) || cantidad <= 0) {
      const msg =
        cantidad < 0
          ? `La cantidad a sumar para "${ingrediente.nombre}" no puede ser menor a 0.`
          : `Ingresa una cantidad mayor a 0 para sumar a "${ingrediente.nombre}".`;
      setError(msg);
      mostrarAviso(`⚠️ ${msg}`, "error");
      return;
    }

    if (!Number.isInteger(cantidad) || String(rawValor).includes(".") || String(rawValor).includes(",")) {
      const msg = `No se permiten decimales al sumar stock a "${ingrediente.nombre}". Ingresa un número entero.`;
      setError(msg);
      mostrarAviso(`⚠️ ${msg}`, "error");
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
      const msg = `El stock ajustado para "${ingrediente.nombre}" no puede ser menor a 0.`;
      setError(msg);
      mostrarAviso(`⚠️ ${msg}`, "error");
      return;
    }

    if (!Number.isInteger(valorAjustado) || String(stockAjuste).includes(".") || String(stockAjuste).includes(",")) {
      const msg = `No se permiten decimales al ajustar el stock de "${ingrediente.nombre}". Ingresa un número entero.`;
      setError(msg);
      mostrarAviso(`⚠️ ${msg}`, "error");
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

  const abrirModalInactivar = async (ingrediente) => {
    setError("");
    setIngredienteAInactivar(ingrediente);
    setRecetasEnUso([]);
    setCargandoRecetas(true);

    try {
      const res = await fetch(`${API_ING_URL}/${ingrediente.id}/recetas`);
      if (res.ok) {
        const data = await res.json();
        setRecetasEnUso(Array.isArray(data.recetas) ? data.recetas : []);
      } else {
        setRecetasEnUso([]);
      }
    } catch (err) {
      console.error(err);
      setRecetasEnUso([]);
    } finally {
      setCargandoRecetas(false);
    }
  };

  const cambiarEstadoIngrediente = async (ingrediente, activo) => {
    setError("");
    setCambiandoEstado(true);
    try {
      const res = await fetch(`${API_ING_URL}/${ingrediente.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data.recetas) && data.recetas.length > 0) {
          setRecetasEnUso(data.recetas);
        }
        const msg = data.error || "No se pudo cambiar el estado del ingrediente.";
        setError(msg);
        mostrarAviso(msg, "error");
        return;
      }

      if (!activo && ajustandoId === ingrediente.id) {
        cancelarAjuste();
      }

      setIngredienteAInactivar(null);
      setRecetasEnUso([]);
      await fetchIngredientes({ silent: true });

      mostrarAviso(
        activo
          ? `✅ Ingrediente "${ingrediente.nombre}" activado.`
          : `⏸️ Ingrediente "${ingrediente.nombre}" inactivado.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión al cambiar el estado del ingrediente.";
      setError(msg);
      mostrarAviso(msg, "error");
    } finally {
      setCambiandoEstado(false);
    }
  };

  const estaActivo = (ing) => ing.activo !== false && ing.activo !== 0;

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

      {ingredienteAInactivar && (
        <div
          className="kds-modal-backdrop"
          style={{ zIndex: 1100 }}
          onMouseDown={(e) => {
            if (!cambiandoEstado && e.target === e.currentTarget) {
              cerrarModalInactivar();
            }
          }}
        >
          <section
            className="kds-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ing-inactive-title"
            style={{ maxWidth: 460 }}
          >
            <header className="kds-modal-head">
              <h2 id="ing-inactive-title">⚠️ Borrar ingrediente</h2>
              <button
                type="button"
                className="kds-btn kds-modal-close"
                disabled={cambiandoEstado}
                onClick={cerrarModalInactivar}
              >
                Cerrar
              </button>
            </header>

            <div className="kds-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
              <p style={{ margin: 0, fontSize: 16 }}>
                Ingrediente: <strong>{ingredienteAInactivar.nombre}</strong> (stock actual:{" "}
                <strong>
                  {Number(ingredienteAInactivar.stock_actual)} {ingredienteAInactivar.unidad_medida}
                </strong>
                ).
              </p>

              {cargandoRecetas ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                  Verificando si el ingrediente está en uso en alguna receta...
                </p>
              ) : recetasEnUso.length > 0 ? (
                <>
                  <p className="admin-users__error" style={{ margin: 0 }}>
                    No se puede inactivar este ingrediente porque está siendo utilizado en las siguientes recetas. Elimínalo de ellas primero:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                    {recetasEnUso.map((receta) => (
                      <li key={receta.id}>
                        <strong>{receta.nombre}</strong>{" "}
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>
                          ({Number(receta.cantidad_necesaria)} {ingredienteAInactivar.unidad_medida}
                          {!receta.disponible ? " · producto inactivo" : ""})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="admin-users__actions" style={{ justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="admin-users__btn admin-users__btn--secondary"
                      onClick={cerrarModalInactivar}
                    >
                      Entendido
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                    Dejará de estar disponible para nuevas operacione.
                  </p>
                  <div className="admin-users__actions" style={{ justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="admin-users__btn admin-users__btn--secondary"
                      disabled={cambiandoEstado}
                      onClick={cerrarModalInactivar}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="admin-users__btn admin-users__btn--danger"
                      disabled={cambiandoEstado}
                      onClick={() => cambiarEstadoIngrediente(ingredienteAInactivar, false)}
                    >
                      {cambiandoEstado ? "Borrando..." : "Sí, Borrar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <main className="admin-users__layout">
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
                onChange={(e) => {
                  const val = e.target.value;
                  setStockActual(val);
                  validarRangoValor(val, "El stock inicial");
                }}
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
                    const activo = estaActivo(ing);
                    const stockNum = Number(ing.stock_actual);
                    const sinStock = stockNum <= 0;
                    const estaAjustando = ajustandoId === ing.id;
                    const estaGuardando = guardandoId === ing.id;

                    return (
                      <tr key={ing.id} className={activo ? "" : "is-blocked"}>
                        <td><strong>{ing.nombre}</strong></td>
                        <td>
                          <strong>{stockNum}</strong> {ing.unidad_medida}
                        </td>
                        <td>
                          <span
                            className={`admin-users__status ${
                              !activo ? "is-inactive" : sinStock ? "is-inactive" : "is-active"
                            }`}
                          >
                            {!activo ? "Inactivo" : sinStock ? "Sin stock" : "Disponible"}
                          </span>
                        </td>
                        <td>
                          {estaAjustando ? (
                            <div className="admin-users__restock">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                aria-label={`Nuevo stock real para ${ing.nombre}`}
                                value={stockAjuste}
                                disabled={estaGuardando || cambiandoEstado}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.includes(".") || val.includes(",")) {
                                    mostrarAviso(
                                      `⚠️ No se permiten decimales al ajustar el stock de ${ing.nombre}.`,
                                      "error"
                                    );
                                    return;
                                  }
                                  setStockAjuste(val);
                                  validarRangoValor(val, `El stock ajustado para ${ing.nombre}`);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "." || e.key === ",") {
                                    e.preventDefault();
                                    mostrarAviso(
                                      `⚠️ No se permiten decimales al ajustar el stock de ${ing.nombre}.`,
                                      "error"
                                    );
                                    return;
                                  }
                                  if (e.key === "Enter") handleGuardarAjuste(ing);
                                  if (e.key === "Escape") cancelarAjuste();
                                }}
                              />
                              <button
                                type="button"
                                className="admin-users__small-btn is-ok"
                                disabled={estaGuardando || cambiandoEstado}
                                onClick={() => handleGuardarAjuste(ing)}
                              >
                                {estaGuardando ? "Guardando..." : "Guardar"}
                              </button>
                              <button
                                type="button"
                                className="admin-users__small-btn"
                                disabled={estaGuardando || cambiandoEstado}
                                onClick={cancelarAjuste}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="admin-users__restock">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="+ Cant."
                                aria-label={`Cantidad a sumar para ${ing.nombre}`}
                                value={cantidadesSumar[ing.id] ?? ""}
                                disabled={estaGuardando || cambiandoEstado || !activo}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.includes(".") || val.includes(",")) {
                                    mostrarAviso(
                                      `⚠️ No se permiten decimales al sumar stock a ${ing.nombre}.`,
                                      "error"
                                    );
                                    return;
                                  }
                                  setCantidadesSumar((prev) => ({
                                    ...prev,
                                    [ing.id]: val,
                                  }));
                                  validarRangoValor(val, `La cantidad a sumar para ${ing.nombre}`);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "." || e.key === ",") {
                                    e.preventDefault();
                                    mostrarAviso(
                                      `⚠️ No se permiten decimales al sumar stock a ${ing.nombre}.`,
                                      "error"
                                    );
                                    return;
                                  }
                                  if (e.key === "Enter") handleAgregarStock(ing);
                                }}
                              />
                              <button
                                type="button"
                                className="admin-users__small-btn is-ok"
                                disabled={estaGuardando || cambiandoEstado || !activo}
                                onClick={() => handleAgregarStock(ing)}
                              >
                                {estaGuardando ? "Sumando..." : "Sumar"}
                              </button>
                              <button
                                type="button"
                                className="admin-users__small-btn"
                                disabled={estaGuardando || cambiandoEstado || !activo}
                                onClick={() => abrirAjuste(ing)}
                              >
                                Ajustar
                              </button>
                              {activo ? (
                                <button
                                  type="button"
                                  className="admin-users__small-btn is-warn"
                                  disabled={estaGuardando || cambiandoEstado}
                                  onClick={() => abrirModalInactivar(ing)}
                                >
                                  Borrar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-users__small-btn is-ok"
                                  disabled={estaGuardando || cambiandoEstado}
                                  onClick={() => cambiarEstadoIngrediente(ing, true)}
                                >
                                  {cambiandoEstado ? "Activando..." : "Activar"}
                                </button>
                              )}
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