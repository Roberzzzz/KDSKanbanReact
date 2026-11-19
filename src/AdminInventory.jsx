import { useState, useEffect } from "react";

const API_ING_URL = "http://localhost:5000/api/ingredientes";

export default function AdminInventory() {
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [nombre, setNombre] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("unidad");
  const [stockActual, setStockActual] = useState("");
  const [cantidadesSumar, setCantidadesSumar] = useState({});

  const fetchIngredientes = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_ING_URL);
      if (res.ok) {
        const data = await res.json();
        setIngredientes(data);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el inventario de ingredientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredientes();
  }, []);

  const mostrarExito = (msg) => {
    setExito(msg);
    setTimeout(() => setExito(""), 3500);
  };

  const handleCrearIngrediente = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");

    if (!nombre.trim()) {
      setError("El nombre del ingrediente es obligatorio.");
      return;
    }

    try {
      const res = await fetch(API_ING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          unidad_medida: unidadMedida,
          stock_actual: Number(stockActual) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar el ingrediente.");
        return;
      }

      setNombre("");
      setUnidadMedida("unidad");
      setStockActual("");
      mostrarExito(`Ingrediente "${data.nombre}" añadido al inventario.`);
      fetchIngredientes();
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor.");
    }
  };

  const handleAgregarStock = async (ingrediente) => {
    setError("");
    const cantidad = Number(cantidadesSumar[ingrediente.id]);

    if (!cantidad || cantidad <= 0) {
      setError(`Ingresa una cantidad válida para sumar a "${ingrediente.nombre}".`);
      return;
    }

    try {
      const res = await fetch(`${API_ING_URL}/${ingrediente.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el stock.");
        return;
      }

      setCantidadesSumar((prev) => ({ ...prev, [ingrediente.id]: "" }));
      mostrarExito(`+${cantidad} ${ingrediente.unidad_medida} añadidos a ${ingrediente.nombre}.`);
      fetchIngredientes();
    } catch (err) {
      console.error(err);
      setError("Error de conexión al reabastecer stock.");
    }
  };

  return (
    <main className="admin-users__layout">
      {/**/}


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
                  <th>Reabastecer</th>
                </tr>
              </thead>
              <tbody>
                {ingredientes.map((ing) => {
                  const stockNum = Number(ing.stock_actual);
                  const sinStock = stockNum <= 0;

                  return (
                    <tr key={ing.id}>
                      <td><strong>{ing.nombre}</strong></td>
                      <td>
                        {stockNum} {ing.unidad_medida}
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
                        <div className="admin-users__restock">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="+ Cant."
                            value={cantidadesSumar[ing.id] ?? ""}
                            onChange={(e) =>
                              setCantidadesSumar((prev) => ({
                                ...prev,
                                [ing.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="admin-users__small-btn is-ok"
                            onClick={() => handleAgregarStock(ing)}
                          >
                            Sumar
                          </button>
                        </div>
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
  );
}