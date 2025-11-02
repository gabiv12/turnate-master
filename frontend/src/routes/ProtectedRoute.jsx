// src/routes/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { getAuthToken } from "../services/api";

export default function ProtectedRoute({ requireRole }) {
  const { isAuthenticated, isEmprendedor, user } = useUser() || {};
  const loc = useLocation();
  const hasToken = !!getAuthToken();

  if (!hasToken || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  if (requireRole) {
    const roles = new Set();
    if (Array.isArray(user?.roles)) user.roles.forEach(r => roles.add(String(r).toLowerCase()));
    if (user?.rol) roles.add(String(user.rol).toLowerCase());

    const isAdmin = roles.has("admin") || (user && Number(user.id) === 1);
    const ok =
      (requireRole === "admin" && isAdmin) ||
      (requireRole === "emprendedor" && (isEmprendedor || roles.has("emprendedor")));

    if (!ok) return <Navigate to="/reservar" replace />;
  }

  return <Outlet />;
}
