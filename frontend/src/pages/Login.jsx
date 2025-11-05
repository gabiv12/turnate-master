// src/pages/Login.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { login as loginSvc, me as meSvc } from "../services/usuarios";
import Input from "../components/Input";

const LOGO_SRC = "/images/TurnateLogo.png";

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
  const { loginFromResponse, refreshUser, isAuthenticated } = useUser();

  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const formRef = useRef(null);

  // Si ya hay sesión, mandamos al panel
  useEffect(() => {
    if (isAuthenticated) navigate("/reservar", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setMsg("✅ Cuenta creada. Iniciá sesión para continuar.");
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMsg("");
    try {
      const identity = emailOrUser.trim();
      const pass = password.trim();
      if (!identity || !pass) {
        throw new Error("Completá email y contraseña.");
      }

      // 1) Login al backend
      const { token, user } = await loginSvc({ email: identity, password: pass });
      if (!token) throw new Error("El servidor no devolvió token.");

      // 2) Guardar sesión en el contexto (token + user si vino)
      loginFromResponse(token, user || null);

      // 3) Si no vino user, pedimos /usuarios/me para sincronizar
      if (!user) {
        try { await refreshUser(); } catch {}
      }

      // 4) Ir al panel
      navigate("/reservar", { replace: true });
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
      const base = (import.meta?.env?.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
      const candidates = [
        "/usuarios/recuperar",
        "/auth/forgot",
        "/usuarios/forgot",
        "/auth/password/forgot",
      ];
      let ok = false;
      let serverMsg = null;
      for (const p of candidates) {
        try {
          const r = await fetch(`${base}${p}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: forgotEmail }),
          });
          if (r.ok) {
            const j = await r.json().catch(() => ({}));
            ok = true;
            serverMsg = j?.detail || j?.message || null;
            break;
          }
        } catch {}
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
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-blue-700 via-sky-500 to-cyan-400" />

      <div className="min-h-[calc(100vh-240px)] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur">
          <div className="px-6 pt-6 text-center">
            <div className="inline-flex items-center gap-1 select-none">
              <img
                src={LOGO_SRC}
                alt="Turnate"
                className="h-12 w-auto"
                onError={(e) => (e.currentTarget.style.display = "none")}
                draggable="false"
              />
              <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
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
                placeholder="Email"
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

              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 text-white font-bold py-2 px-4 shadow-lg ring-1 ring-blue-300/40 disabled:opacity-60"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </button>

              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm text-blue-700 underline mt-1 justify-self-center"
              >
                ¿Olvidaste tu contraseña?
              </button>
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
        </form>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleForgot}
            disabled={forgotSending}
            className="rounded-xl bg-blue-600 text-white font-semibold px-4 py-2 disabled:opacity-60"
          >
            {forgotSending ? "Enviando…" : "Enviar"}
          </button>
          <button
            type="button"
            onClick={() => setForgotOpen(false)}
            className="rounded-xl border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Probamos endpoints comunes; si tu backend no los tiene, no se hace ningún cambio.
        </p>
      </SimpleModal>
    </div>
  );
}
