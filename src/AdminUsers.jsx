import { useState, useEffect } from "react";
import "./AdminUsers.css";

const API_URL = "http://localhost:5000/api/usuarios";

export default function AdminUsers({ currentUser, setView, onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado del formulario (Crear / Editar)
  const [editingId, setEditingId] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rolId, setRolId] = useState("");

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
    setNombreUsuario(user.nombre_usuario);
    setNombreCompleto(user.nombre_completo);
    setRolId(String(user.rol_id));
    setContrasena(""); // Vacío para no sobreescribir a menos que escriba una nueva
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!nombreUsuario.trim() || !nombreCompleto.trim() || !rolId) {
      setError("Completa los campos obligatorios.");
      return;
    }

    if (!editingId && !contrasena.trim()) {
      setError("Debes asignar una contraseña al crear un usuario.");
      return;
    }

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_usuario: nombreUsuario,
          nombre_completo: nombreCompleto,
          contrasena,
          rol_id: Number(rolId),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ocurrió un error al guardar.");
        return;
      }

      resetForm();
      fetchUsuarios();
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor.");
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

      <main className="admin-users__layout">
        {/* Formulario Crear / Editar */}
        <section className="admin-users__card">
          <h2>{editingId ? "Editar Usuario" : "Nuevo Usuario"}</h2>

          <form className="admin-users__form" onSubmit={handleSubmit}>
            <div className="admin-users__field">
              <label htmlFor="adm-username">Nombre de usuario</label>
              <input
                id="adm-username"
                type="text"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                placeholder="Ej. cocinero2"
              />
            </div>

            <div className="admin-users__field">
              <label htmlFor="adm-fullname">Nombre completo</label>
              <input
                id="adm-fullname"
                type="text"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Carlos Pérez"
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
                {editingId ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}
              </label>
              <input
                id="adm-pass"
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
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
    </div>
  );
}