// src/routes/ProtectedEmprendedorRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken, getUser } from "../services/api";

function isEmprendedor(user) {
  const rol = String(user?.rol || "").toLowerCase();
  if (rol === "emprendedor") return true;
  if (user?.es_emprendedor === true || user?.is_emprendedor === true) return true;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (roles.some(r => String(r?.nombre || r).toLowerCase() === "emprendedor")) return true;
  if (roles.some(r => String(r).toLowerCase() === "emprendedor")) return true;
  return false;
}

export default function ProtectedEmprendedorRoute({ children }) {
  const loc = useLocation();
  const token = getAuthToken();
  const user  = getUser();

  if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!isEmprendedor(user)) return <Navigate to="/reservar" replace />;

  return children;
}
