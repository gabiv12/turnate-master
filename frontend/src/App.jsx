// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PublicShell from "./layouts/PublicShell.jsx";
import PanelShell from "./layouts/PanelShell.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

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
import Turnos from "./pages/Turnos.jsx";
import Estadisticas from "./pages/Estadisticas.jsx";
// import Suscripcion from "./pages/Suscripcion.jsx"; // eliminado si ya no se usa
import EmprendedorForm from "./pages/EmprendedorForm.jsx";
import Servicios from "./pages/Servicios.jsx";
import Horarios from "./pages/Horarios.jsx";
import AdminReportes from "./pages/AdminReportes.jsx";

export default function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/" element={<PublicShell />}>
        <Route index element={<Home />} />
        <Route path="nosotros" element={<Nosotros />} />
        <Route path="privacidad" element={<Privacidad />} />
        <Route path="terminos" element={<Terminos />} />
        <Route path="login" element={<Login />} />
        <Route path="registro" element={<Registro />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Panel (protegido) */}
      <Route element={<PanelShell />}>
        {/* Cualquier usuario logueado */}
        <Route element={<ProtectedRoute />}>
          <Route path="/reservar" element={<IngresarCodigo />} />
          <Route path="/reservar/:codigo" element={<Reservar />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/update-user" element={<Navigate to="/perfil" replace />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          {/* <Route path="/suscripcion" element={<Suscripcion />} /> */}
          {/* Emprendimiento accesible para que el usuario active su plan con el modal */}
          <Route path="/emprendimiento" element={<EmprendedorForm />} />
        </Route>

        {/* Solo emprendedor */}
        <Route element={<ProtectedRoute requireRole="emprendedor" />}>
          <Route path="/servicios" element={<Servicios />} />
          <Route path="/horarios" element={<Horarios />} />
          <Route path="/turnos" element={<Turnos />} /> {/* <- MOVIDO AQUÍ */}
        </Route>

        {/* Solo admin */}
        <Route element={<ProtectedRoute requireRole="admin" />}>
          <Route path="/admin" element={<AdminReportes />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* fallback final */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
