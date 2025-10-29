// src/components/ModalActivacionEmprendedor.jsx
import React, { useState, useEffect } from "react";
import api from "../components/api";

/**
 * Activación Emprendedor con descubrimiento de rutas:
 * 1) Activa por usuario (PUT /usuarios/{id}/activar_emprendedor, /usuarios/activar_emprendedor).
 * 2) Descubre rutas en /openapi.json y busca POST de creación de "emprend*".
 * 3) Si no hay OpenAPI o falla, prueba fallbacks (singular/plural, /api, con/sin barra).
 * 4) Genera código si existe endpoint.
 */
export default function ModalActivacionEmprendedor({
  open,
  onClose,
  userId,
  onActivated, // (payload) => void
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let t;
    if (msg || err) t = setTimeout(() => { setMsg(""); setErr(""); }, 2600);
    return () => clearTimeout(t);
  }, [msg, err]);

  if (!open) return null;

  // ---- helpers ----
  const createPayloadMin = (uid) => ({
    usuario_id: uid,
    nombre: "Mi negocio",   // EmprendedorCreate suele requerir 'nombre' NOT NULL
    negocio: "Mi negocio",  // por compatibilidad con back viejo
    descripcion: null,
  });

  const tryGenerateCode = async (empId) => {
    if (!empId) return;
    const candidates = [
      (id) => api.post(`/emprendedores/${id}/generar-codigo`),
      (id) => api.post(`/api/emprendedores/${id}/generar-codigo`),
      (id) => api.post(`/emprendedor/${id}/generar-codigo`),
      (id) => api.post(`/api/emprendedor/${id}/generar-codigo`),
    ];
    for (const fn of candidates) {
      try { await fn(empId); return; } catch (_) {}
    }
  };

  const discoverCreatePath = async () => {
    try {
      const { data } = await api.get("/openapi.json"); // FastAPI default
      const paths = data?.paths || {};
      // Buscar primera ruta con "emprend" que acepte POST
      const candidates = Object.entries(paths)
        .filter(([p, def]) => /emprend/i.test(p) && def?.post)
        .map(([p]) => p);

      // Si existe también con prefijo /api, priorizar esa
      const prioritized = [
        ...candidates.filter((p) => p.startsWith("/api/")),
        ...candidates.filter((p) => !p.startsWith("/api/")),
      ];

      return prioritized[0] || null;
    } catch {
      return null;
    }
  };

  const tryCreateEmprendedor = async (uid) => {
    // 1) Intentar con OpenAPI
    const discovered = await discoverCreatePath();
    if (discovered) {
      try {
        const r = await api.post(discovered, createPayloadMin(uid));
        return r?.data || null;
      } catch (e) {
        // seguimos con fallbacks
        // console.warn("OpenAPI path failed:", discovered, e?.response?.status);
      }
    }

    // 2) Fallbacks (plural/singular, con/sin barra, con /api)
    const fallbacks = [
      (p) => api.post(p, createPayloadMin(uid)),
      // plural
      "/emprendedores/",
      "/emprendedores",
      "/api/emprendedores/",
      "/api/emprendedores",
      // singular
      "/emprendedor/",
      "/emprendedor",
      "/api/emprendedor/",
      "/api/emprendedor",
      // otros habituales
      "/emprendimientos/",
      "/emprendimientos",
      "/api/emprendimientos/",
      "/api/emprendimientos",
    ];

    for (const path of fallbacks) {
      if (typeof path === "function") continue;
      try {
        const r = await api.post(path, createPayloadMin(uid));
        return r?.data || null;
      } catch (e) {
        // probar siguiente
        // console.log("POST fail", path, e?.response?.status);
      }
    }
    return null;
  };

  const activar = async () => {
    if (!userId) return setErr("No hay usuario en sesión.");
    setLoading(true);
    setMsg("");
    setErr("");

    try {
      let data = null;

      // 1) Activación por usuario (si el back la tiene)
      const activateCalls = [
        () => api.put(`/usuarios/${userId}/activar_emprendedor`),
        () => api.put(`/usuarios/activar_emprendedor`),
        () => api.put(`/api/usuarios/${userId}/activar_emprendedor`),
        () => api.put(`/api/usuarios/activar_emprendedor`),
      ];
      for (const call of activateCalls) {
        try {
          const r = await call();
          if (r?.data) { data = r.data; break; }
        } catch (_) {}
      }

      // 2) Crear Emprendedor mínimo si no hubo activación
      if (!data) {
        const emp = await tryCreateEmprendedor(userId);
        if (!emp) throw new Error("No existe un endpoint válido para crear el emprendimiento.");
        await tryGenerateCode(emp.id);
        data = { user: null, emprendedor: emp };
      }

      // 3) Persistir token si vino
      if (data?.token) localStorage.setItem("token", data.token);

      onActivated?.(data);
      setMsg("¡Listo! Activamos tu plan. Ahora configurá tu emprendimiento.");
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.detail || "No se pudo activar el plan. Revisá la ruta del backend o probá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header visual */}
        <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-500 p-6 text-white">
          <h2 className="text-2xl md:text-3xl font-extrabold">Activá el plan de Emprendedor</h2>
          <p className="text-white/90 mt-1 text-sm md:text-base">
            Recibí reservas con tu link público y administrá tus horarios.
          </p>
        </div>

        {/* Body */}
        <div className="bg-white p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Plan */}
            <div className="rounded-2xl border shadow-sm p-5">
              <div className="text-sm font-semibold text-slate-600 mb-2">Plan Emprendedor</div>
              <div className="text-4xl font-extrabold tracking-tight">
                AR$ 29.900 <span className="text-base font-medium text-slate-500">/mes</span>
              </div>
              <ul className="mt-4 space-y-2 text-slate-700 text-sm">
                <li>• Link público para que te reserven fácil</li>
                <li>• Configurás tus días y horarios disponibles</li>
                <li>• Evitás reservas duplicadas del mismo cliente</li>
                <li>• Vista simple con tus turnos del día</li>
              </ul>
              <div className="mt-5 text-[11px] text-slate-500">
                Precio final con impuestos y comisiones incluidos. Sin cargos ocultos.
              </div>
            </div>

            {/* Acciones */}
            <div className="rounded-2xl border shadow-sm p-5">
              <div className="text-sm font-semibold text-slate-600 mb-3">¿Qué obtengo al activar?</div>
              <ul className="space-y-2 text-slate-700 text-sm mb-4">
                <li>• Tu emprendimiento queda listo para usar.</li>
                <li>• Generamos (o conservamos) tu código público.</li>
                <li>• Acceso a Emprendimiento, Servicios y Horarios.</li>
              </ul>

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

              <div className="flex gap-3">
                <button
                  onClick={activar}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-400 text-white font-bold py-3 shadow ring-1 ring-blue-300/50 hover:scale-[1.01] transition disabled:opacity-60"
                >
                  {loading ? "Activando…" : "Activar ahora"}
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-xl border px-4 py-3 text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>

              <div className="mt-4 text-[11px] text-slate-500">
                Al activar, renovamos tu sesión con un token actualizado.
              </div>
            </div>
          </div>
        </div>

        {/* Footer decorativo */}
        <div className="h-2 w-full bg-gradient-to-r from-blue-500/20 via-cyan-400/20 to-emerald-300/20" />
      </div>
    </div>
  );
}
