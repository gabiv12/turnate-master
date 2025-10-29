// src/pages/Registro.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Button from "../components/Button";
import Input from "../components/Input";

const sideImg = "/images/mujer-que-trabaja-oficina-casa.jpg";

// ===== Helpers =====
const sanitize = (s) => (s || "").normalize("NFC").replace(/\s+/g, " ").trim();
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isUsername = (v) => /^[a-zA-Z0-9._-]{3,30}$/.test(v);
const isStrongPassword = (v) => typeof v === "string" && v.length >= 8;

// Mensajes breves (tips)
const M = {
  email: "Usá un correo válido (ej: alguien@dominio.com).",
  username: "3–30 caracteres. Letras/números, y . _ - (sin espacios).",
  password: "Mínimo 8 caracteres.",
};

// ===== Overlay de estado (cargando / éxito) =====
function FullscreenStatus({ variant, title, caption, ctaLabel, onCta }) {
  // variant: "loading" | "success"
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-live="assertive"
    >
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

export default function Registro() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    rol: "cliente", // mantener por compatibilidad de backend
  });

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectIn, setRedirectIn] = useState(3);

  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const [topError, setTopError] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const errors = useMemo(() => {
    const e = {};
    const email = sanitize(formData.email).toLowerCase();
    const user = sanitize(formData.username);

    if (!isEmail(email)) e.email = M.email;
    if (!isUsername(user)) e.username = M.username;
    if (!isStrongPassword(formData.password)) e.password = M.password;
    return e;
  }, [formData]);

  const onChange = (e) => {
    const { name, value } = e.target;
    const clean = name === "email" ? sanitize(value.toLowerCase()) : sanitize(value);
    setFormData((p) => ({ ...p, [name]: clean }));
    setTopError("");
  };

  const focusFirstInvalid = () => {
    const el =
      document.querySelector("[data-invalid='true']") ||
      document.getElementById("email") ||
      document.getElementById("username") ||
      document.getElementById("password");
    el?.focus?.();
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;

    setShowErrors(true);
    if (Object.keys(errors).length) {
      setTopError(Object.values(errors)[0]);
      focusFirstInvalid();
      return;
    }

    setSending(true);
    setTopError("");

    // abort controller para cancelar si desmonta o re-envía
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = {
        email: sanitize(formData.email).toLowerCase(),
        username: sanitize(formData.username),
        password: formData.password,
        rol: "cliente",
      };

      // 1) /usuarios/registro (si existe)
      let done = false;
      try {
        await api.post("/usuarios/registro", payload, { signal: controller.signal });
        done = true;
      } catch (e1) {
        const status = e1?.response?.status;
        if (status === 409) throw e1; // usuario ya existe → no intentes fallback
        if (![404, 405].includes(status)) throw e1;
      }

      // 2) /usuarios (fallback compatible)
      if (!done) {
        await api.post("/usuarios", payload, { signal: controller.signal });
      }

      if (!mountedRef.current) return;

      // OK → overlay éxito + countdown
      setFormData({ email: "", username: "", password: "", rol: "cliente" });
      setSending(false);
      setSuccess(true);
      setRedirectIn(3);

      intervalRef.current = setInterval(() => {
        setRedirectIn((s) => (s > 1 ? s - 1 : s));
      }, 1000);

      timerRef.current = setTimeout(() => {
        navigate("/login?registered=1", { replace: true });
      }, 3000);
    } catch (err) {
      if (!mountedRef.current) return;
      setSending(false);

      if (err?.name === "CanceledError") return; // abortado

      const d = err?.response?.data;
      const backendMsg =
        (typeof d === "string" && d) ||
        d?.detail ||
        (typeof d === "object" ? (Object.values(d).flat?.()[0] || Object.values(d)[0]) : null);

      setTopError(
        backendMsg ||
          "No pudimos crear tu cuenta en este momento. Probá nuevamente en unos instantes."
      );
    } finally {
      abortRef.current = null;
    }
  };

  const showEmailError = showErrors && !!errors.email;
  const showUserError = showErrors && !!errors.username;
  const showPassError = showErrors && !!errors.password;

  return (
    <>
      {/* Overlay “creando…” */}
      {sending && (
        <FullscreenStatus
          variant="loading"
          title="Creando tu cuenta…"
          caption="Esto puede demorar unos segundos."
        />
      )}

      {/* Overlay de éxito */}
      {success && (
        <FullscreenStatus
          variant="success"
          title="¡Cuenta creada con éxito!"
          caption={`Redirigiendo a Iniciar sesión en ${redirectIn}…`}
          ctaLabel="Ir ahora"
          onCta={() => navigate("/login?registered=1", { replace: true })}
        />
      )}

      <section className="min-h-screen w-full bg-gradient-to-b from-blue-600 to-cyan-400 grid place-items-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <div className="rounded-3xl p-[1px] bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-400 shadow-2xl">
            <div className="rounded-3xl bg-white/90 backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Lado imagen */}
                <div className="relative min-h-[clamp(100px,70svh,220px)] md:min-h-[clamp(240px,60dvh,480px)] max-h-[92svh] overflow-y-auto">
                  <img
                    src={sideImg}
                    alt="Emprender con Turnate"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable="false"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-sky-700/60 via-sky-600/40 to-cyan-500/30 mix-blend-multiply" />
                  <div className="relative h-full flex items-end md:items-center">
                    <div className="p-6 md:p-10 text-white drop-shadow">
                      <h2 className="text-xl md:text-2xl font-semibold leading-tight">
                        Agregá tu emprendimiento
                        <br /> y tomá control de tus turnos
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Lado formulario */}
                <div className="p-6 md:p-10" id="registro-form">
                  <header className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-3 py-1 text-xs font-medium text-white">
                      Nuevo usuario
                    </div>
                    <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-slate-900">
                      Crear una cuenta
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      ¿Ya tenés cuenta?{" "}
                      <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                        Iniciar sesión
                      </Link>
                    </p>
                  </header>

                  {topError && (
                    <div
                      className="mb-4 rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-2 ring-1 ring-amber-200"
                      role="alert"
                    >
                      {topError}
                    </div>
                  )}

                  <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-busy={sending}>
                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        Correo electrónico
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={onChange}
                        placeholder="tu@email.com"
                        required
                        disabled={sending}
                        aria-invalid={showEmailError}
                        data-invalid={showEmailError ? "true" : undefined}
                        className={`w-full rounded-xl border ${
                          showEmailError ? "border-amber-300" : "border-slate-200"
                        } bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300`}
                      />
                      {showEmailError && <p className="mt-1 text-xs text-slate-500">{M.email}</p>}
                    </div>

                    {/* Usuario */}
                    <div>
                      <label
                        htmlFor="username"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Usuario
                      </label>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        value={formData.username}
                        onChange={onChange}
                        placeholder="ej: fer_emprende"
                        required
                        disabled={sending}
                        aria-invalid={showUserError}
                        data-invalid={showUserError ? "true" : undefined}
                        className={`w-full rounded-xl border ${
                          showUserError ? "border-amber-300" : "border-slate-200"
                        } bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300`}
                      />
                      {showUserError && <p className="mt-1 text-xs text-slate-500">{M.username}</p>}
                    </div>

                    {/* Contraseña */}
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Contraseña
                      </label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={onChange}
                        placeholder="••••••••"
                        required
                        disabled={sending}
                        aria-invalid={showPassError}
                        data-invalid={showPassError ? "true" : undefined}
                        className={`w-full rounded-xl border ${
                          showPassError ? "border-amber-300" : "border-slate-200"
                        } bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300`}
                      />
                      {showPassError && <p className="mt-1 text-xs text-slate-500">{M.password}</p>}
                    </div>

                    {/* rol oculto (compatibilidad backend) */}
                    <input type="hidden" name="rol" value={formData.rol} />

                    <Button
                      type="submit"
                      disabled={sending}
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-white font-semibold shadow hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {sending ? "Creando..." : "Crear cuenta"}
                    </Button>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Al registrarte aceptás nuestros{" "}
                      <Link to="/terminos" className="text-blue-600 hover:text-blue-700">
                        Términos y Condiciones
                      </Link>{" "}
                      y la{" "}
                      <Link to="/privacidad" className="text-blue-600 hover:text-blue-700">
                        Política de Privacidad
                      </Link>
                      .
                    </p>
                  </form>

                  {/* Tips opcionales */}
                  <div className="mt-4 text-xs text-slate-500">
                    <p className="mb-1 font-medium text-slate-600">Consejos:</p>
                    <ul className="list-disc ml-5 space-y-1">
                      <li>Usá un correo al que tengas acceso.</li>
                      <li>
                        El usuario no lleva espacios; podés usar <code>.</code>, <code>_</code> y{" "}
                        <code>-</code>.
                      </li>
                      <li>Elegí una contraseña fácil de recordar y difícil de adivinar.</li>
                    </ul>
                  </div>
                </div>
                {/* /form */}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
