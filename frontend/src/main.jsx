import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { UserProvider } from "./context/UserContext.jsx";

// Handlers globales (debug)
function mountGlobalErrorHandlers() {
  if (window.__GLOBAL_ERR_HOOKS__) return;
  window.__GLOBAL_ERR_HOOKS__ = true;
  window.addEventListener("error", (ev) => console.error("[window.onerror]", ev?.message, ev?.error));
  window.addEventListener("unhandledrejection", (ev) => console.error("[unhandledrejection]", ev?.reason));
  try {
    const base = import.meta?.env?.VITE_API_URL || "http://localhost:8000";
    console.log("[BOOT] VITE_API_URL =", base);
  } catch {}
}
mountGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <UserProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </UserProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
