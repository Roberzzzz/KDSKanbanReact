import { useState, useEffect, useRef } from "react";
import AdminInventory from "./AdminInventory";
import AdminProducts from "./AdminProducts";
import "./AdminUsers.css";
import "./KanbanDishes.css";

const API_URL = "http://localhost:5000/api/usuarios";
const MAX_CARACTERES = 20;

// Solo letras (incluyendo acentos/ñ/ü), números y espacios; sin caracteres especiales
const TEXTO_SIN_ESPECIALES_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/;

function limpiarSinEspeciales(valor) {
  return valor.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+/g, "").slice(0, MAX_CARACTERES);
}

export default function AdminUsers({ currentUser, setView, onLogout }) {
  const [activeTab, setActiveTab] = useState("usuarios");

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Popup flotante al crear o actualizar usuario
  const [aviso, setAviso] = useState({ visible: false, mensaje: "", tipo: "ok" });
  const avisoTimerRef = useRef(null);

  // Estado del formulario (Crear / Editar)
  const [editingId, setEditingId] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rolId, setRolId] = useState("");

  const mostrarAviso = (mensaje, tipo = "ok") => {
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    setAviso({ visible: true, mensaje, tipo });
    avisoTimerRef.current = setTimeout(() => {
      setAviso((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    };
  }, []);

  // Seguridad: si no es admin, bloquear acceso
  useEffect(() => {
    if (!currentUser || currentUser.rol !== "admin") {
      setView(currentUser ? "kanban" : "login");
    }
  }, [currentUser, setView]);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios);
        setRoles(data.roles);
        if (data.roles.length > 0 && !rolId) {
          setRolId(String(data.roles[0].id));
        }
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.rol === "admin") {
      fetchUsuarios();
    }
  }, [currentUser]);

  const resetForm = () => {
    setEditingId(null);
    setNombreUsuario("");
    setNombreCompleto("");
    setContrasena("");
    if (roles.length > 0) setRolId(String(roles[0].id));
    setError("");
  };

  const handleEditClick = (user) => {
    setEditingId(user.id);
    setNombreUsuario(limpiarSinEspeciales(user.nombre_usuario || ""));
    setNombreCompleto(limpiarSinEspeciales(user.nombre_completo || ""));
    setRolId(String(user.rol_id));
    setContrasena(""); // Vacío para no sobreescribir a menos que escriba una nueva
    setError("");
  };

  const handleUsernameChange = (e) => {
    setNombreUsuario(limpiarSinEspeciales(e.target.value));
    if (error) setError("");
  };

  const handleFullnameChange = (e) => {
    setNombreCompleto(limpiarSinEspeciales(e.target.value));
    if (error) setError("");
  };

  const handlePasswordChange = (e) => {
    setContrasena(e.target.value.slice(0, MAX_CARACTERES));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const usuarioLimpio = nombreUsuario.trim().replace(/\s+/g, " ");
    const nombreLimpio = nombreCompleto.trim().replace(/\s+/g, " ");

    if (!usuarioLimpio || !nombreLimpio || !rolId) {
      setError("Completa los campos obligatorios.");
      return;
    }

    if (usuarioLimpio.length > MAX_CARACTERES || nombreLimpio.length > MAX_CARACTERES) {
      setError(`El nombre de usuario y el nombre completo no pueden superar los ${MAX_CARACTERES} caracteres.`);
      return;
    }

    if (
      !TEXTO_SIN_ESPECIALES_REGEX.test(usuarioLimpio) ||
      !TEXTO_SIN_ESPECIALES_REGEX.test(nombreLimpio)
    ) {
      setError(
        "El nombre de usuario y el nombre completo solo pueden contener letras, números y espacios (sin caracteres especiales)."
      );
      return;
    }

    if (!editingId && !contrasena.trim()) {
      setError("Debes asignar una contraseña al crear un usuario.");
      return;
    }

    if (contrasena.length > MAX_CARACTERES) {
      setError(`La contraseña no puede superar los ${MAX_CARACTERES} caracteres.`);
      return;
    }

    const eraEdicion = Boolean(editingId);

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_usuario: usuarioLimpio,
          nombre_completo: nombreLimpio,
          contrasena,
          rol_id: Number(rolId),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Ocurrió un error al guardar.";
        setError(msg);
        mostrarAviso(msg, "error");
        return;
      }

      resetForm();
      fetchUsuarios();
      mostrarAviso(
        eraEdicion
          ? `✅ Usuario "${usuarioLimpio}" actualizado correctamente.`
          : `✅ Usuario "${usuarioLimpio}" añadido correctamente.`,
        "ok"
      );
    } catch (err) {
      console.error(err);
      const msg = "Error de conexión con el servidor.";
      setError(msg);
      mostrarAviso(msg, "error");
    }
  };

  const handleToggleBlock = async (user) => {
    if (user.id === currentUser.id) {
      alert("No puedes bloquear tu propio usuario administrador.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/${user.id}/bloquear`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !user.activo }),
      });

      if (res.ok) {
        fetchUsuarios();
      }
    } catch (err) {
      console.error("Error al bloquear/desbloquear:", err);
    }
  };

  if (!currentUser || currentUser.rol !== "admin") return null;

  return (
    <div className="admin-users">
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

      <header className="admin-users__top">
        <div className="admin-users__brand">
          <span className="admin-users__logo" aria-hidden="true">S</span>
          <div>
            <h1>BigDip Flavor's — Administración</h1>
            <p>Sesión activa: <strong>{currentUser.nombre_completo}</strong> (Admin)</p>
          </div>
        </div>

        <div className="admin-users__nav">
          <button
            type="button"
            className={`admin-users__btn ${
              activeTab === "usuarios"
                ? "admin-users__btn--primary"
                : "admin-users__btn--secondary"
            }`}
            onClick={() => setActiveTab("usuarios")}
          >
            Usuarios
          </button>
          <button
            type="button"
            className={`admin-users__btn ${
              activeTab === "inventario"
                ? "admin-users__btn--primary"
                : "admin-users__btn--secondary"
            }`}
            onClick={() => setActiveTab("inventario")}
          >
            Inventario
          </button>
          <button
            type="button"
            className={`admin-users__btn ${
              activeTab === "productos"
                ? "admin-users__btn--primary"
                : "admin-users__btn--secondary"
            }`}
            onClick={() => setActiveTab("productos")}
          >
            Productos
          </button>
          <button
            type="button"
            className="admin-users__btn admin-users__btn--secondary"
            onClick={() => setView("kanban")}
          >
            Ir a Cocina (Kanban)
          </button>
          <button
            type="button"
            className="admin-users__btn admin-users__btn--danger"
            onClick={onLogout}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {activeTab === "inventario" ? (
        <AdminInventory />
      ) : activeTab === "productos" ? (
        <AdminProducts />
      ) : (
        <main className="admin-users__layout">
          {/* Formulario Crear / Editar */}
          <section className="admin-users__card">
            <h2>{editingId ? "Editar Usuario" : "Nuevo Usuario"}</h2>

            <form className="admin-users__form" onSubmit={handleSubmit}>
              <div className="admin-users__field">
                <label htmlFor="adm-username">
                  Nombre de usuario (máx. {MAX_CARACTERES})
                </label>
                <input
                  id="adm-username"
                  type="text"
                  maxLength={MAX_CARACTERES}
                  value={nombreUsuario}
                  onChange={handleUsernameChange}
                  placeholder="Ej. cocinero2"
                />
              </div>

              <div className="admin-users__field">
                <label htmlFor="adm-fullname">
                  Nombre completo (máx. {MAX_CARACTERES})
                </label>
                <input
                  id="adm-fullname"
                  type="text"
                  maxLength={MAX_CARACTERES}
                  value={nombreCompleto}
                  onChange={handleFullnameChange}
                  placeholder="Ej. Carlos Perez"
                />
              </div>

              <div className="admin-users__field">
                <label htmlFor="adm-role">Rol</label>
                <select
                  id="adm-role"
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-users__field">
                <label htmlFor="adm-pass">
                  {editingId
                    ? `Nueva contraseña (máx. ${MAX_CARACTERES}, opcional)`
                    : `Contraseña (máx. ${MAX_CARACTERES})`}
                </label>
                <input
                  id="adm-pass"
                  type="password"
                  maxLength={MAX_CARACTERES}
                  value={contrasena}
                  onChange={handlePasswordChange}
                  placeholder={editingId ? "••••••••" : "Ingresa contraseña"}
                />
              </div>

              {error && <p className="admin-users__error">{error}</p>}

              <div className="admin-users__actions">
                <button type="submit" className="admin-users__btn admin-users__btn--primary">
                  {editingId ? "Guardar Cambios" : "Crear Usuario"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="admin-users__btn admin-users__btn--secondary"
                    onClick={resetForm}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Tabla de Usuarios */}
          <section className="admin-users__card">
            <h2>Usuarios Registrados ({usuarios.length})</h2>

            {loading ? (
              <p>Cargando usuarios...</p>
            ) : (
              <div className="admin-users__table-wrap">
                <table className="admin-users__table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id} className={!u.activo ? "is-blocked" : ""}>
                        <td><strong>{u.nombre_usuario}</strong></td>
                        <td>{u.nombre_completo}</td>
                        <td>
                          <span className={`admin-users__badge is-${u.rol}`}>
                            {u.rol}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-users__status ${u.activo ? "is-active" : "is-inactive"}`}>
                            {u.activo ? "Activo" : "Bloqueado"}
                          </span>
                        </td>
                        <td className="admin-users__row-actions">
                          <button
                            type="button"
                            className="admin-users__small-btn"
                            onClick={() => handleEditClick(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`admin-users__small-btn ${u.activo ? "is-warn" : "is-ok"}`}
                            onClick={() => handleToggleBlock(u)}
                            disabled={u.id === currentUser.id}
                          >
                            {u.activo ? "Bloquear" : "Desbloquear"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}