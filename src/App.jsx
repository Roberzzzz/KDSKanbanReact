import { useState } from "react";
import OrdersPage from "./pages/orders";
import KanbanBoard from "./KanbanBoard";
import Login from "./Login";
import { KitchenProvider } from "./useKitchen"; 
import "./App.css";

function App() {
  const [view, setView] = useState("login");

  return (
    <KitchenProvider> 
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
    </KitchenProvider>
  );
}

export default App;