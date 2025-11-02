// src/routes/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";

// Tolerante a backends: chequea rol por string o array
function userHasRole(user, name) {
  if (!user) return false;
  const target = String(name || "").toLowerCase();
  const single = String(user.rol || "").toLowerCase();
  if (single === target) return true;
  const roles = user.roles || [];
  for (const r of roles) {
    const v = (r && (r.nombre || r)) ? String(r.nombre || r).toLowerCase() : "";
    if (v === target) return true;
  }
  if ((user.es_emprendedor || user.is_emprendedor) && target === "emprendedor") return true;
  return false;
}

export default function ProtectedRoute({ requireRole }) {
  const { loading, isAuthenticated, user } = useUser();
  const location = useLocation();

  // ⛔ Mientras carga el contexto → mantené un estado visible mínimo (evita loops)
  if (loading) {
    return (
      <div className="py-24 grid place-items-center">
        <div className="w-full max-w-sm rounded-2xl bg-white/80 shadow p-6 text-center">
          <div className="animate-pulse text-slate-600 font-semibold">Cargando…</div>
        </div>
      </div>
    );
  }

  // No autenticado → a login (y guardo a dónde quería ir)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Con rol requerido y no cumple → lo mando al perfil
  if (requireRole && !userHasRole(user, requireRole)) {
    return <Navigate to="/perfil" replace />;
  }

  // OK
  return <Outlet />;
}
