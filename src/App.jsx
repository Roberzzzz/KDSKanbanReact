import { useState } from "react";
import OrdersPage from "./pages/orders";
import KanbanBoard from "./KanbanBoard";
import Login from "./Login";
import "./App.css";

function App() {
  const [view, setView] = useState("login");

  return (
    <>
      <div hidden={view !== "menu"}>
        <OrdersPage setView={setView} />
      </div>
      <div hidden={view !== "kanban"}>
        <KanbanBoard setView={setView} />
      </div>
      <div hidden={view !== "login"}>
        <Login setView={setView} />
      </div> 
    </>
  );
}

export default App;