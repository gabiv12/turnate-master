// src/pages/Login.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api, { setAuthToken } from "../services/api.js";
import Button from "../components/Button";
import Input from "../components/Input";

const LOGO_SRC = "/images/TurnateLogo.png";

// Detectar si el usuario es emprendedor con varias formas de back
function isEmprendedor(u) {
  if (!u) return false;
  if (String(u.rol || "").toLowerCase() === "emprendedor") return true;
  const roles = u.roles || [];
  if (Array.isArray(roles)) {
    if (roles.some((r) => String(r).toLowerCase() === "emprendedor")) return true;
    if (roles.some((r) => String(r?.nombre || "").toLowerCase() === "emprendedor")) return true;
  }
  if (u.es_emprendedor === true || u.is_emprendedor === true) return true;
  return false;
}

// Modal simple (sin librerías externas)
function SimpleModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-800 font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // UI state
  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Forgot password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  // Evitar doble submit con Enter en inputs
  const formRef = useRef(null);

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setMsg("✅ Cuenta creada. Iniciá sesión para continuar.");
    }
  }, [searchParams]);

  // Login llamando directamente al backend
  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMsg("");
    try {
      const hasAt = emailOrUser.includes("@");
      const payload = hasAt
        ? { email: emailOrUser.trim(), password }
        : { username: emailOrUser.trim(), password };

      const { data } = await api.post("/usuarios/login", payload);

      // Soportar { user, token } o variantes
      const token = data?.token || data?.access_token || data?.jwt;
      const user = data?.user || data?.usuario || data;

      if (!token || !user) {
        throw new Error("Respuesta de login incompleta.");
      }

      // Guardar token y usuario
      setAuthToken(token);
      localStorage.setItem("user", JSON.stringify(user));

      // Redirección según rol
      const dest = isEmprendedor(user) ? "/turnos" : "/reservar";
      setMsg("✅ Sesión iniciada");
      setTimeout(() => navigate(dest, { replace: true }), 250);
    } catch (err) {
      const d = err?.response?.data;
      const m =
        d?.detail ||
        d?.message ||
        (typeof d === "object" ? Object.values(d)[0] : null) ||
        err?.message ||
        "Error al iniciar sesión.";
      setMsg(`⚠️ ${m}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSending(true);
    setMsg("");
    try {
      // Intentamos endpoints comunes; si no existen, mostramos aviso
      const endpoints = [
        "/usuarios/recuperar",
        "/auth/forgot",
        "/usuarios/forgot",
        "/auth/password/forgot",
      ];
      let ok = false;
      let serverMsg = null;
      for (const p of endpoints) {
        try {
          const r = await api.post(p, { email: forgotEmail });
          ok = true;
          serverMsg = r?.data?.detail || r?.data?.message || null;
          break;
        } catch (_) {}
      }
      if (!ok) throw new Error("No se pudo iniciar el proceso. Probá más tarde.");
      setMsg(serverMsg || "📬 Si el email existe, te enviamos instrucciones.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err) {
      setMsg(`⚠️ ${err.message || "No se pudo enviar el email"}`);
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="relative pt-24">
      {/* Fondo azul degradado */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-blue-700 via-sky-500 to-cyan-400" />

      <div className="min-h-[calc(100vh-240px)] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur">
          {/* Cabecera con logo */}
          <div className="px-6 pt-6 text-center">
            <div className="inline-flex items-center gap-3 select-none">
              <img
                src={LOGO_SRC}
                alt="Turnate"
                className="h-12 w-auto"
                onError={(e) => (e.currentTarget.style.display = "none")}
                draggable="false"
              />
              <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-emerald-200 bg-clip-text text-transparent drop-shadow">
                Turnate
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold text-slate-800">Iniciar sesión</h1>
            <p className="text-sm text-slate-500">Accedé a tu cuenta para gestionar tus turnos.</p>
          </div>

          <div className="p-6">
            {msg && (
              <div
                className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                  /⚠️|Error|No se pudo|incorrect/i.test(msg)
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                }`}
              >
                {msg}
              </div>
            )}

            <form ref={formRef} onSubmit={handleLogin} className="grid gap-3">
              <Input
                type="text"
                placeholder="Email o usuario"
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                required
                className="rounded-xl bg-white/90"
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl bg-white/90"
              />

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-blue-700 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 text-white font-bold py-2 px-4 shadow-lg ring-1 ring-blue-300/40 disabled:opacity-60"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </Button>
            </form>

            <div className="mt-4 text-sm text-gray-700 text-center">
              ¿No tenés cuenta?{" "}
              <Link to="/registro" className="text-blue-700 underline">
                Registrate
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Olvidé mi contraseña */}
      <SimpleModal
        open={forgotOpen}
        title="Recuperar contraseña"
        onClose={() => setForgotOpen(false)}
      >
        <form onSubmit={handleForgot} className="grid gap-3">
          <Input
            type="email"
            placeholder="Tu email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            required
            className="rounded-xl bg-white/80"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={forgotSending}
              className="rounded-xl bg-blue-600 text-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              {forgotSending ? "Enviando…" : "Enviar"}
            </Button>
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="rounded-xl border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Probamos los endpoints más comunes. Si tu backend no los tiene, no se hace ningún cambio.
          </p>
        </form>
      </SimpleModal>
    </div>
  );
}
