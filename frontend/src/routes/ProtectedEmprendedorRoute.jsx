// src/routes/ProtectedRoute.jsx
import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { getAuthToken } from "../services/api";

function FullscreenStatus({ title, caption }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div className="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-full bg-slate-100">
          <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-20" />
            <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" className="opacity-80" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {caption && <p className="mt-1 text-sm text-slate-600">{caption}</p>}
      </div>
    </div>
  );
}

export default function ProtectedRoute({ requireRole }) {
  const loc = useLocation();
  const { user, isAuthenticated, refreshMe, booting } = useUser() || {};
  const token = getAuthToken();
  const authed = isAuthenticated || !!token;

  const [checking, setChecking] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (authed && !user && !asked.current) {
      asked.current = true;
      setChecking(true);
      Promise.resolve(refreshMe?.()).finally(() => setChecking(false));
    }
  }, [authed, user, refreshMe]);

  // sin sesión -> login (guarda retorno)
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  }

  // cargando sesión -> loader
  if (booting || checking || (authed && !user)) {
    return <FullscreenStatus title="Verificando acceso…" caption="Cargando tu sesión." />;
  }

  // rol requerido
  if (requireRole) {
    const roles = (user?.roles || []).map((r) =>
      typeof r === "string" ? r.toLowerCase() : String(r?.nombre || "").toLowerCase()
    );
    if (!roles.includes(requireRole.toLowerCase())) {
      return <Navigate to="/perfil" replace state={{ msg: "Acceso denegado" }} />;
    }
  }

  return <Outlet />;
}
