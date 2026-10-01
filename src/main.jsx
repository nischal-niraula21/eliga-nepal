import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles.css";
import { initPwa } from "./pwa";
import { backend } from "./api/client";

initPwa();
// Begin waking the API on arrival, before the player opens the lobby.
backend.ensureReady().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
