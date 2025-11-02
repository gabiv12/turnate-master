// src/components/ModalActivacionEmprendedor.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";

// Ruta oficial del backend que ya tenés implementada:
// PUT /usuarios/{id}/activar_emprendedor
async function activarBackOficial(userId) {
  return api.put(`/usuarios/${userId}/activar_emprendedor`);
}

async function postEmprendedorFallback() {
  // Por compatibilidad si tu front intenta crear directo
  return api.post(`/emprendedores`, { nombre: "Mi negocio", descripcion: "" });
}

async function generarCodigo(id) {
  return api.post(`/emprendedores/${id}/generar-codigo`);
}

export default function ModalActivacionEmprendedor({ open, onClose, userId, onActivated }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let t;
    if (msg || err) t = setTimeout(() => { setMsg(""); setErr(""); }, 2800);
    return () => clearTimeout(t);
  }, [msg, err]);

  if (!open) return null;

  const activar = async () => {
    if (!userId) {
      setErr("Tenés que iniciar sesión primero.");
      return;
    }
    setLoading(true);
    setMsg("");
    setErr("");

    try {
      // 1) Intento ruta oficial
      let data = null;
      try {
        const r = await activarBackOficial(userId);
        data = r?.data || null;
      } catch {
        // 2) Fallback: crear Emprendedor y generar código
        const r1 = await postEmprendedorFallback();
        const emp = r1?.data;
        if (!emp?.id) throw new Error("No se pudo crear el emprendimiento.");
        try { await generarCodigo(emp.id); } catch {}
        data = { user: null, emprendedor: emp };
      }

      onActivated?.(data);
      setMsg("¡Listo! Ya podés cargar datos y compartir tu link.");
    } catch {
      setErr("No se pudo activar. Probá de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/55 p-4" onClick={onClose}>
      <div
        className="mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header brand */}
        <div className="relative bg-gradient-to-r from-blue-700 via-sky-600 to-emerald-500 px-6 py-8 text-white">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/images/TurnateLogo.png"
              alt="Turnate"
              className="h-10 w-auto drop-shadow"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <span className="text-2xl font-extrabold tracking-tight">Turnate</span>
          </div>
          <h2 className="mt-4 text-center text-2xl md:text-3xl font-extrabold">
            Activá tu plan Emprendedor
          </h2>
          <p className="mt-1 text-center text-white/90">
            Recibí reservas con un link público, configurá tus horarios y ordená tu agenda.
          </p>
        </div>

        {/* Body */}
        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Benefits */}
          <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">¿Qué incluye?</div>
            <ul className="mt-3 space-y-2 text-slate-700 text-sm">
              <li>• Link público para que tus clientes reserven.</li>
              <li>• Gestión de <strong>Servicios</strong> y <strong>Horarios</strong>.</li>
              <li>• Agenda simple del día y control de solapados.</li>
              <li>• Podés regenerar tu código cuando quieras.</li>
            </ul>
            <div className="mt-4 text-xs text-slate-500">
              El plan se activa ahora y ya podés cargar tus datos.
            </div>
          </div>

          {/* Actions */}
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
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-400 py-3 font-bold text-white shadow ring-1 ring-blue-300/50 transition hover:scale-[1.01] disabled:opacity-60"
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
              Al activar, se habilitan los módulos de Turnos, Servicios, Horarios y Estadísticas.
            </p>
          </div>
        </div>

        <div className="h-2 w-full bg-gradient-to-r from-blue-500/20 via-sky-400/20 to-emerald-300/20" />
      </div>
    </div>
  );
}
