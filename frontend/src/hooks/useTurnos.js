// src/hooks/useTurnos.js
import { useEffect, useState } from "react";
import api from "../services/api";

/* Helpers */
const toISO = (v) => {
  try {
    const d = new Date(v);
    if (isNaN(d)) return v;
    return new Date(d.getTime() - d.getMilliseconds()).toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return v;
  }
};
const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));

function useTurnos() {
  const [servicios, setServicios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Cargar servicios del emprendedor al montar
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get("/servicios/mis");
        setServicios(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error cargando mis servicios:", e);
        setErr(e?.response?.data?.detail || e?.message || "No se pudieron cargar los servicios.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Cargar turnos (del usuario / dueño)
  const cargarTurnos = async (filtro = {}) => {
    const { data } = await api.get("/turnos/mis", { params: filtro });
    setTurnos(Array.isArray(data) ? data : []);
  };

  const cargarTurnosEntre = async (desde, hasta) => cargarTurnos({ desde: toISO(desde), hasta: toISO(hasta) });

  const getServicio = (id) => servicios.find((s) => Number(s.id) === Number(id)) || null;

  const crearTurno = async ({
    servicio_id,
    inicio,
    datetime,
    fin,
    cliente_nombre,
    cliente_telefono,
    notas,
    onOkReload,
  }) => {
    const srv = getServicio(servicio_id);
    const base = inicio || datetime;
    if (!servicio_id || !base) throw new Error("Falta servicio_id o fecha/hora de inicio.");

    const iISO = toISO(base);
    const durMin = Number(srv?.duracion_min || 0) || 60;
    const fISO = fin ? toISO(fin) : new Date(new Date(iISO).getTime() + durMin * 60000).toISOString();

    const bodyVariants = [
      clean({ servicio_id: Number(servicio_id), inicio: iISO, fin: fISO, cliente_nombre, cliente_telefono, notas }),
      clean({ servicio_id: Number(servicio_id), inicio: iISO, cliente_nombre }),
      clean({ servicioId: Number(servicio_id), start: iISO, end: fISO, nombreCliente: cliente_nombre, telefonoCliente: cliente_telefono, comentario: notas }),
      clean({ servicioId: Number(servicio_id), start: iISO, nombre: cliente_nombre }),
      clean({ servicio_id: Number(servicio_id), inicio: iISO, fin: fISO, cliente: clean({ nombre: cliente_nombre, telefono: cliente_telefono }), notas }),
    ];

    const routes = [
      { method: "post", url: "/turnos" },
      { method: "post", url: "/turnos/create" },
      { method: "post", url: "/api/turnos" },
      { method: "post", url: "/api/turnos/create" },
    ];

    let lastErr;
    for (const r of routes) {
      for (const body of bodyVariants) {
        try {
          const resp = await api[r.method](r.url, body);
          const out = resp?.data ?? resp;
          if (onOkReload?.desde && onOkReload?.hasta) await cargarTurnosEntre(onOkReload.desde, onOkReload.hasta);
          return out;
        } catch (e) {
          lastErr = e;
          const s = e?.response?.status;
          if (s === 409 || s === 401) throw e;
          continue;
        }
      }
    }
    throw lastErr || new Error("No se pudo crear el turno (formato no admitido).");
  };

  const reprogramarTurno = async ({ turno_id, inicio, fin }) => {
    if (!turno_id || !inicio) throw new Error("Falta turno_id o nueva fecha/hora de inicio.");
    const iISO = toISO(inicio);
    const fISO = fin ? toISO(fin) : undefined;

    const bodyVariants = [
      clean({ inicio: iISO, fin: fISO }),
      clean({ start: iISO, end: fISO }),
      clean({ nuevo_inicio: iISO, nuevo_fin: fISO }),
    ];

    const routes = [
      { method: "put", url: `/turnos/${turno_id}` },
      { method: "patch", url: `/turnos/${turno_id}` },
      { method: "post", url: `/turnos/${turno_id}/reprogramar` },
      { method: "post", url: `/api/turnos/${turno_id}/reprogramar` },
    ];

    let lastErr;
    for (const r of routes) {
      for (const body of bodyVariants) {
        try {
          const resp = await api[r.method](r.url, body);
          return resp?.data ?? resp;
        } catch (e) {
          lastErr = e;
          if (e?.response?.status === 401) throw e;
          continue;
        }
      }
    }
    throw lastErr || new Error("No se pudo reprogramar el turno.");
  };

  const cancelarTurno = async ({ turno_id, motivo }) => {
    if (!turno_id) throw new Error("Falta turno_id.");
    try {
      const r = await api.delete(`/turnos/${turno_id}`);
      return r?.data ?? r;
    } catch (e) {
      try {
        const r = await api.post(`/turnos/${turno_id}/cancelar`, clean({ motivo }));
        return r?.data ?? r;
      } catch (e2) {
        try {
          const r = await api.patch(`/turnos/${turno_id}`, clean({ estado: "cancelado", motivo }));
          return r?.data ?? r;
        } catch (e3) {
          throw e3 || e2 || e;
        }
      }
    }
  };

  return {
    servicios,
    turnos,
    loading,
    error: err,
    cargarTurnos,
    cargarTurnosEntre,
    crearTurno,
    reprogramarTurno,
    cancelarTurno,
  };
}

export default useTurnos;
export { useTurnos };
