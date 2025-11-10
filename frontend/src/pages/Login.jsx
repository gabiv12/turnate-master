// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { login as loginSvc, me as meSvc } from "../services/usuarios";

const LOGO_SRC = "/images/TurnateLogo.png";
const cx = (...c) => c.filter(Boolean).join(" ");

function StatusOverlay({ show, mode = "loading", title, caption, onClose }) {
  if (!show) return null;
  const isOK = mode === "success";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div
          className={cx(
            "mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full",
            isOK ? "bg-blue-50" : "bg-slate-100"
          )}
        >
          {isOK ? (
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-blue-600">
              <path
                fill="currentColor"
                d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm4.7-12.7a1 1 0 0 0-1.4-1.4L11 12.2l-2.3-2.3a1 1 0 1 0-1.4 1.4l3 3a1 1 0 0 0 1.4 0l5-5Z"
              />
            </svg>
          ) : (
            <svg className="h-7 w-7 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" className="opacity-80" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {caption && <p className="mt-1 text-sm text-slate-600">{caption}</p>}
        {isOK && (
          <button
            onClick={onClose}
            className="mt-4 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:brightness-110"
          >
            Entendido
          </button>
        )}
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
  const [msg, setMsg] = useState("");

  // overlay
  const [overlay, setOverlay] = useState({ show: false, mode: "loading", title: "", caption: "" });

  useEffect(() => {
    if (isAuthenticated) navigate("/reservar", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (searchParams.get("registered") === "1" || searchParams.get("nuevo") === "1") {
      setMsg(" Cuenta creada. Iniciá sesión para continuar.");
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    const identity = emailOrUser.trim();
    const pass = password.trim();
    if (!identity || !pass) {
      setMsg("⚠️ Completá email y contraseña.");
      return;
    }
    try {
      setOverlay({ show: true, mode: "loading", title: "Ingresando…", caption: "Verificando tus credenciales" });

      const { token, user } = await loginSvc({ email: identity, password: pass });
      if (loginFromResponse && token) loginFromResponse(token, user || null);

      // sincronizar /me si hiciera falta
      try { await refreshUser(); } catch {}

      setOverlay({
        show: true,
        mode: "success",
        title: "¡Bienvenido!",
        caption: "Redirigiendo a tu panel…",
      });

      setTimeout(() => navigate("/reservar", { replace: true }), 900);
    } catch (err) {
      setMsg(`⚠️ ${err.message || "Error al iniciar sesión."}`);
      setOverlay({ show: false, mode: "loading", title: "", caption: "" });
    }
  };

  return (
    <div className="relative pt-24">
      <StatusOverlay
        show={overlay.show}
        mode={overlay.mode}
        title={overlay.title}
        caption={overlay.caption}
        onClose={() => setOverlay({ show: false, mode: "loading", title: "", caption: "" })}
      />

      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-blue-700 via-sky-500 to-cyan-400" />
      <div className="min-h-[calc(100vh-240px)] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl mb-20 border border-white/20 bg-white/90 shadow-2xl backdrop-blur">
          <div className="px-6 pt-6 text-center">
            <div className="inline-flex items-center gap-2 select-none">
              <img src={LOGO_SRC} alt="Turnate" className="h-12 w-auto" draggable="false" />
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

            <form onSubmit={handleLogin} className="grid gap-3">
              <input
                type="email"
                placeholder="Email"
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                required
                className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3"
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3"
              />

              <button
                type="submit"
                className="mt-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 text-white font-bold py-2.5 px-4 shadow-lg ring-1 ring-blue-300/40"
              >
                Ingresar
              </button>

              <button
                type="button"
                onClick={() => (window.location.href = "/registro")}
                className="text-sm text-blue-700 underline mt-1 justify-self-center"
              >
                ¿No tenés cuenta? Registrate
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
