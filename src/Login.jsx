import { useState } from "react";
import "./Login.css";

function Login({ setView, setCurrentUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleClientClick(e) {
    e.preventDefault();
    setCurrentUser(null);
    setView("menu");
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setError("");

    if (username.trim() === "" || password.trim() === "") {
      setError("Por favor, ingresa un usuario y contraseña válidos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_usuario: username.trim(),
          contrasena: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Credenciales inválidas.");
        setLoading(false);
        return;
      }

      setCurrentUser(data.user);
      setUsername("");
      setPassword("");

      // Redirección según el rol
      if (data.user.rol === "admin") {
        setView("admin");
      } else {
        setView("kanban");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-page__card">
        <header className="login-page__header">
          <div className="login-page__logo" aria-hidden="true">
            S
          </div>
          <h1 className="login-page__title">BigDip Flavor's</h1>
          <p className="login-page__subtitle">Ingreso al Sistema</p>
        </header>

        <form className="login-page__form" onSubmit={handleLoginSubmit}>
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="username">
              Usuario
            </label>
            <input
              className="login-page__input"
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin o cocinero1"
              disabled={loading}
            />
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="password">
              Contraseña
            </label>
            <input
              className="login-page__input"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <p className="login-page__error">{error}</p>}

          <button
            className="login-page__primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </form>

        <footer className="login-page__footer">
          <a
            className="login-page__link"
            href="#"
            onClick={handleClientClick}
          >
            Soy Cliente
          </a>
        </footer>
      </main>
    </div>
  );
}

export default Login;