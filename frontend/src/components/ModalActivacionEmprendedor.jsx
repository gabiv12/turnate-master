// src/components/ModalActivacionEmprendedor.jsx
import React, { useEffect, useState } from "react";
import { activarEmprendedor, me } from "../services/usuarios.js";
import { miEmprendedor } from "../services/emprendedores.js";

export default function ModalActivacionEmprendedor({ open, onClose, userId, onActivated }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let t;
    if (msg || err) t = setTimeout(() => { setMsg(""); setErr(""); }, 2500);
    return () => clearTimeout(t);
  }, [msg, err]);

  if (!open) return null;

  async function tryActivateWithRetries(uid) {
    // 1) Intento normal
    try {
      console.info("[MODAL] activar -> intento 1");
      await activarEmprendedor(uid);
      return true;
    } catch (e1) {
      const s1 = e1?.response?.status ?? e1?._info?.status;
      console.warn("[MODAL] activar intento 1 fallo", s1);
      // 2) Si 401, refresco /me y reintento
      if (s1 === 401) {
        try {
          console.info("[MODAL] refresh /usuarios/me y reintento");
          await me(); // revalida sesión y actualiza user en LS
        } catch {}
        try {
          console.info("[MODAL] activar -> intento 2");
          await activarEmprendedor(uid);
          return true;
        } catch (e2) {
          const s2 = e2?.response?.status ?? e2?._info?.status;
          console.warn("[MODAL] activar intento 2 fallo", s2);
          throw e2;
        }
      }
      throw e1;
    }
  }

  const activar = async () => {
    if (!userId) { setErr("Tenés que iniciar sesión primero."); return; }
    setLoading(true); setMsg(""); setErr("");
    try {
      // Activa el plan con reintentos controlados (maneja 401 internamente)
      await tryActivateWithRetries(userId);

      // Trae el emprendedor resultante (GET /emprendedores/mi con fallback interno)
      let emp = null;
      try {
        emp = await miEmprendedor();
      } catch {}

      // Avisá al padre
      onActivated?.({ emprendedor: emp || null });

      setMsg("¡Listo! Ya podés cargar servicios y horarios.");
      // Opcional: cerrar al confirmar; como no tocamos UI, dejamos que el padre cierre si corresponde
      // onClose?.();
    } catch (e) {
      const st = e?.response?.status ?? e?._info?.status;
      setErr(st === 401
        ? "Sesión inválida o vencida. Iniciá sesión e intentá de nuevo."
        : st === 403
        ? "No autorizado."
        : "No se pudo activar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/55 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e)=>e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-blue-700 via-sky-600 to-emerald-500 px-6 py-8 text-white">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/images/TurnateLogo.png"
              alt="Turnate"
              className="h-10 w-auto drop-shadow"
              onError={(e)=> (e.currentTarget.style.display="none")}
            />
            <span className="text-2xl font-extrabold tracking-tight">Turnate</span>
          </div>
          <h2 className="mt-4 text-center text-2xl md:text-3xl font-extrabold">
            Activá tu plan Emprendedor
          </h2>
          <p className="mt-1 text-center text-white/90">
            Link público, servicios, horarios y agenda del día.
          </p>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">¿Qué incluye?</div>
            <ul className="mt-3 space-y-2 text-slate-700 text-sm">
              <li>• Link público para reservas.</li>
              <li>• Gestión de <strong>Servicios</strong> y <strong>Horarios</strong>.</li>
              <li>• Agenda del día sin solapados.</li>
              <li>• Podés regenerar tu código cuando quieras.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
            {(err || msg) && (
              <div
                className={`mb-4 rounded-xl px-4 py-2 text-sm ring-1 ${
                  err
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                {err || msg}
              </div>
            )}
            <button
              onClick={activar}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-400 py-3 font-bold text-white shadow ring-1 ring-blue-300/50 hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "Activando…" : "Activar ahora"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Se habilitan Turnos, Servicios, Horarios y el enlace público.
            </p>
          </div>
        </div>

        <div className="h-2 w-full bg-gradient-to-r from-blue-500/20 via-sky-400/20 to-emerald-300/20" />
      </div>
    </div>
  );
}
