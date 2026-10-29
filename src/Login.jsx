import { useState } from "react";
import "./Login.css"; 
function Login({ setView }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleClientClick(e) {
    e.preventDefault();
    setView("menu");
  }

  function handleLoginSubmit(e) {
    e.preventDefault();

    if (username.trim() !== "" && password.trim() !== "") {
      setView("kanban");
    } else {
      setError("Por favor, ingresa un usuario y contraseña válidos.");
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
          <p className="login-page__subtitle">Ingreso al Panel de Cocina</p>
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
              placeholder="Ej. cocinero1"
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
            />
          </div>

          {error && <p className="login-page__error">{error}</p>}

          <button className="login-page__primary-button" type="submit">
            Entrar
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