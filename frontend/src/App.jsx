// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PublicShell from "./layouts/PublicShell.jsx";
import PanelShell from "./layouts/PanelShell.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import ProtectedEmprendedorRoute from "./routes/ProtectedEmprendedorRoute.jsx";

import Home from "./pages/home.jsx";
import Nosotros from "./pages/Nosotros.jsx";
import Privacidad from "./pages/Privacidad.jsx";
import Terminos from "./pages/Terminos.jsx";
import NotFound from "./pages/NotFound.jsx";

import Login from "./pages/Login.jsx";
import Registro from "./pages/Registro.jsx";
import IngresarCodigo from "./pages/IngresarCodigo.jsx";
import Reservar from "./pages/Reservar.jsx";

import Perfil from "./pages/Perfil.jsx";
// ❌ import UpdateUserForm from "./pages/UpdateUserForm.jsx";  // eliminado

import Turnos from "./pages/Turnos.jsx";
import Estadisticas from "./pages/Estadisticas.jsx";
import Suscripcion from "./pages/Suscripcion.jsx";

import Emprendimiento from "./pages/Emprendimiento.jsx";
import Servicios from "./pages/Servicios.jsx";
import Horarios from "./pages/Horarios.jsx";

import AdminReportes from "./pages/AdminReportes.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";

export default function App() {
  return (
    <Routes>
      {/* Páginas públicas (sin PanelShell) */}
      <Route element={<PublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/nosotros" element={<Nosotros />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Con PanelShell (tiene header + footer) */}
      <Route element={<PanelShell />}>
        <Route path="/reservar" element={<IngresarCodigo />} />
        <Route path="/reservar/:codigo" element={<Reservar />} />

        {/* Autenticadas */}
        <Route element={<ProtectedRoute />}>
          <Route path="/perfil" element={<Perfil />} />
          {/* compatibilidad: si alguien navega al viejo path, redirige a /perfil */}
          <Route path="/update-user" element={<Navigate to="/perfil" replace />} />

          <Route path="/turnos" element={<Turnos />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          <Route path="/suscripcion" element={<Suscripcion />} />

          {/* SOLO ADMIN */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminReportes />
              </RequireAdmin>
            }
          />
        </Route>

        {/* Solo emprendedor */}
        <Route element={<ProtectedEmprendedorRoute />}>
          <Route path="/emprendimiento" element={<Emprendimiento />} />
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/horarios" element={<Horarios />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
