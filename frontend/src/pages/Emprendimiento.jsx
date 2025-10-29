// src/pages/Emprendimiento.jsx
import { useEffect, useState } from "react";
import EmprendedorForm from "./EmprendedorForm";
import api from "../components/api";

export default function Emprendimiento() {
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [codeMsg, setCodeMsg] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get("/emprendedores/mi");
        if (mounted) setEmp(r?.data || null);
      } catch {
        if (mounted) setEmp(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const publicUrl = emp?.codigo_cliente
    ? `${window.location.origin}/reservar/${encodeURIComponent(emp.codigo_cliente)}`
    : "";

  const shareOrCopy = async () => {
    if (!publicUrl) return;
    try {
      setSharing(true);
      if (navigator.share) {
        await navigator.share({ title: "Agenda Turnate", text: "Reservá tu turno acá:", url: publicUrl });
        setCodeMsg("Enlace compartido.");
      } else {
        await navigator.clipboard.writeText(publicUrl);
        setCodeMsg("Enlace copiado al portapapeles.");
      }
    } catch {
      // cancelado por el usuario, no mostramos error
    } finally {
      setSharing(false);
      setTimeout(() => setCodeMsg(""), 1600);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full w-full flex items-center justify-center px-4 py-8">
        <div className="rounded-2xl bg-white/90 px-6 py-4 ring-1 ring-slate-200">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Encabezado estilo Perfil: azul + letras blancas + borde blanco */}
        <div className="rounded-3xl ring-1 ring-white/70 bg-gradient-to-r from-blue-600 to-cyan-400 p-6 text-white">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Emprendimiento</h1>
          <p className="mt-2 text-white/95">
            Configurá tu negocio y compartí tu link público para que tus clientes reserven turnos.
          </p>
        </div>

        {/* Estado + Código público (una sola acción) */}
        <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-[1px] p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Estado</div>
              <div className={`text-base font-semibold ${emp ? "text-emerald-600" : "text-slate-800"}`}>
                {emp ? "Activo" : "Inactivo"}
              </div>
              {!emp && (
                <p className="text-xs text-slate-500 mt-1">
                  Activá tu plan desde <a href="/perfil" className="underline font-semibold text-sky-700">Perfil</a> para habilitar servicios y turnos.
                </p>
              )}
            </div>

            <div className="w-full md:w-auto">
              <div className="text-xs text-slate-500 mb-1">Código público</div>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 tracking-widest text-slate-800 text-sm">
                  {emp?.codigo_cliente || "—"}
                </code>

                <button
                  type="button"
                  onClick={shareOrCopy}
                  disabled={!publicUrl || sharing}
                  className="rounded-full bg-sky-600 text-white text-xs font-semibold px-4 py-2 shadow hover:bg-sky-700 disabled:opacity-50"
                  title="Compartir o copiar enlace público"
                >
                  {sharing ? "Procesando…" : "Compartir / Copiar"}
                </button>
              </div>

              {emp?.codigo_cliente && (
                <p className="text-[11px] text-slate-500 mt-2">
                  Tus clientes reservan en: <b>/reservar/<span className="tracking-widest">{emp.codigo_cliente}</span></b>
                </p>
              )}

              {codeMsg && (
                <div className="mt-2 inline-block rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-1 text-xs">
                  {codeMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulario del emprendedor (misma estética que Perfil) */}
        <div className="rounded-3xl p-[1px] bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-400 shadow-2xl">
          <div className="rounded-3xl bg-white/90 backdrop-blur-md">
            <div className="p-5 md:p-8">
              <EmprendedorForm onSaved={(nuevo) => setEmp(nuevo || emp)} />
            </div>
          </div>
        </div>

        {/* Sugerencias útiles */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900">
          <ul className="text-sm space-y-1">
            <li>• El <b>código público</b> se crea al activar tu plan en <b>Perfil</b> y se mantiene estable.</li>
            <li>• Completá <b>teléfono</b> y <b>redes</b> para que te contacten rápido.</li>
            <li>• Describí brevemente tus <b>servicios</b> para orientar al cliente.</li>
            <li>• Después de guardar, configurá <b>Servicios</b> y <b>Horarios</b> en <b>Turnos</b>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
