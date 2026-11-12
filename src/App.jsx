import { useState } from "react";
import OrdersPage from "./pages/orders";
import KanbanBoard from "./KanbanBoard";
import Login from "./Login";
import AdminUsers from "./AdminUsers";
import { KitchenProvider } from "./useKitchen";
import "./App.css";

function App() {
  const [view, setView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogout = () => {
    setCurrentUser(null);
    setView("login");
  };

  return (
    <KitchenProvider>
      <>
        <div hidden={view !== "menu"}>
          <OrdersPage setView={setView} />
        </div>
        <div hidden={view !== "kanban"}>
          <KanbanBoard
            setView={setView}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </div>
        <div hidden={view !== "admin"}>
          <AdminUsers
            currentUser={currentUser}
            setView={setView}
            onLogout={handleLogout}
          />
        </div>
        <div hidden={view !== "login"}>
          <Login setView={setView} setCurrentUser={setCurrentUser} />
        </div>
      </>
    </KitchenProvider>
  );
}

export default App;