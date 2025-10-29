// src/pages/Login.jsx
import React, { useState, useRef, useEffect, useContext } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import api, { loginAuth } from "../services/api"; // << usa services/api (no components/api)
import { UserContext } from "../context/UserContext.jsx";

const LOGO_SRC = "/images/TurnateLogo.png";

/* Overlay de estado (loading / success) */
function FullscreenStatus({ variant, title, caption, ctaLabel, onCta }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div className="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-full bg-slate-100">
          {variant === "loading" ? (
            <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" className="opacity-80" />
            </svg>
          ) : (
            <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {caption && <p className="mt-1 text-sm text-slate-600">{caption}</p>}
        {ctaLabel && (
          <button
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow hover:scale-[1.01] active:scale-95"
            onClick={onCta}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function extractBackendMessage(err) {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) {
    if (typeof d.detail === "string") return d.detail;
    if (Array.isArray(d.detail)) {
      const msgs = d.detail.map(it => it?.msg || it?.message).filter(Boolean);
      if (msgs.length) return msgs.join(" • ");
      return "Hubo un problema con los datos enviados.";
    }
  }
  return d?.message || d?.error || err?.message || "No se pudo iniciar sesión.";
}

export default function Login() {
  const { setUser } = useContext(UserContext) || {};
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectIn, setRedirectIn] = useState(2);
  const [msg, setMsg] = useState("");

  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    if (loading) return;

    const u = username.trim();
    if (!u || !password.trim()) {
      setMsg("⚠️ Completá tu usuario y contraseña.");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1) /auth/login (form-urlencoded) -> guarda token (services/api)
      await loginAuth(u, password);

      // 2) Obtenemos datos del emprendedor (ya con token via interceptor)
      const me = await api.get("/emprendedores/mi", { signal: controller.signal });
      const emp = me?.data;
      if (!emp) throw new Error("No pudimos obtener tus datos.");

      // 3) Construimos el usuario de la app con rol emprendedor para el navbar
      const appUser = {
        ...emp,                // id, user_id, codigo_cliente, etc.
        rol: "emprendedor",    // <- clave para que el navbar te muestre como dueño
        isOwner: true,
      };
      setUser?.(appUser);
      localStorage.setItem("user", JSON.stringify(appUser));

      // 4) Éxito + redirección
      setSuccess(true);
      setRedirectIn(2);
      intervalRef.current = setInterval(() => {
        setRedirectIn((s) => (s > 1 ? s - 1 : s));
      }, 1000);
      timerRef.current = setTimeout(() => {
        window.location.assign("/turnos");
      }, 2000);
    } catch (err) {
      const m = extractBackendMessage(err);
      setMsg(/401|not authenticated|credentials|invalid/i.test(m)
        ? "No pudimos validar tu sesión. Revisá usuario/contraseña."
        : `⚠️ ${m}`);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="pt-24">
      {loading && <FullscreenStatus variant="loading" title="Ingresando…" caption="Estamos validando tus datos." />}
      {success && (
        <FullscreenStatus
          variant="success"
          title="¡Bienvenido/a!"
          caption={`Vas a ser redirigido en ${redirectIn}…`}
          ctaLabel="Ir ahora"
          onCta={() => window.location.assign("/turnos")}
        />
      )}

      <div className="min-h-[calc(100vh-240px)] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur">
          <div className="px-6 pt-6 text-center">
            <div className="inline-flex items-center gap-3 select-none">
              <img
                src={LOGO_SRC}
                alt="Turnate"
                className="h-12 w-auto"
                onError={(e) => (e.currentTarget.style.display = "none")}
                draggable="false"
              />
              <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-400 bg-clip-text text-transparent">
                Turnate
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold text-slate-800">Iniciar sesión</h1>
            <p className="text-sm text-slate-500">Usá tu <strong>usuario</strong> y contraseña.</p>
          </div>

          <div className="p-6">
            {msg && (
              <div
                className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                  /⚠️|No pudimos|No se pudo|Revisá/i.test(msg)
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                }`}
                role="status"
                aria-live="polite"
              >
                {msg}
              </div>
            )}

            <form onSubmit={handleLogin} className="grid gap-3" noValidate aria-busy={loading}>
              <Input
                type="text"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
                className="rounded-xl bg-white/80"
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="rounded-xl bg-white/80"
              />

              <Button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-500 to-emerald-400 text-white font-bold py-2 px-4 shadow-lg ring-1 ring-blue-300/40 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Ingresando…" : "Ingresar"}
              </Button>

              <div className="mt-3 text-sm text-gray-600 text-center">
                ¿No tenés cuenta?{" "}
                <a href="/registro" className="text-blue-600 underline">
                  Registrate
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
