// src/pages/EmprendedorForm.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiAuth } from "../services/api";

const BTN =
  "rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-2.5 text-white text-sm font-semibold shadow hover:brightness-110 disabled:opacity-60";
const BOX =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300";
const LABEL = "block text-xs font-semibold text-sky-700 mb-1";

function safeParseJSON(x) {
  if (!x) return {};
  if (typeof x === "object") return x;
  try { return JSON.parse(x); } catch { return {}; }
}

function niceMsg(err) {
  const st = err?.response?.status;
  if (st === 401) return "Tu sesión se cerró. Iniciá sesión y volvé a intentar.";
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "Ocurrió un error.";
}

function redesObjectToList(obj = {}) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out.push({ tipo: k, valor: v.trim() });
  }
  return out;
}
function redesListToObject(list = []) {
  const out = {};
  for (const it of list) {
    const k = String(it?.tipo || "").trim();
    const v = String(it?.valor || "").trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export default function EmprendedorForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msgOk, setMsgOk] = useState("");
  const [msgErr, setMsgErr] = useState("");

  const [codigo, setCodigo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    nombre: "",
    telefono_contacto: "",
    direccion: "",
    rubro: "",
    descripcion: "",
  });

  const [redes, setRedes] = useState([]); // [{tipo, valor}]
  const [redNew, setRedNew] = useState({ tipo: "instagram", valor: "" });

  async function load() {
    setLoading(true);
    setMsgErr("");
    try {
      const { data } = await apiAuth.get("/emprendedores/mi");
      setCodigo(data?.codigo_cliente || "");
      setLogoUrl(data?.logo_url || "");

      setForm({
        nombre: data?.nombre || "",
        telefono_contacto: data?.telefono_contacto || "",
        direccion: data?.direccion || "",
        rubro: data?.rubro || "",          // si tu back no lo tiene, luego lo omitimos en el retry
        descripcion: data?.descripcion || "",
      });

      const redesObj = safeParseJSON(data?.redes);
      setRedes(redesObjectToList(redesObj));
    } catch (e) {
      setMsgErr(niceMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const errNombre = useMemo(() => !form.nombre?.trim() ? "Ingresá el nombre comercial." : "", [form.nombre]);
  const errTel = useMemo(() => {
    const t = (form.telefono_contacto || "").trim();
    if (!t) return ""; // opcional
    return /^[\d+\-\s()]{6,}$/.test(t) ? "" : "Ingresá un teléfono válido.";
  }, [form.telefono_contacto]);
  const errWebs = useMemo(() => {
    const w = redes.filter(r => r.tipo === "web").map(r => r.valor);
    for (const v of w) {
      if (v && !/^https?:\/\//i.test(v)) return "Las URLs deben empezar con http:// o https://";
    }
    return "";
  }, [redes]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const addRed = () => {
    const tipo = String(redNew.tipo || "").trim();
    const valor = String(redNew.valor || "").trim();
    if (!tipo || !valor) return;
    setRedes((prev) => [...prev, { tipo, valor }]);
    setRedNew({ tipo: redNew.tipo, valor: "" });
  };
  const removeRed = (idx) => setRedes((prev) => prev.filter((_, i) => i !== idx));

  const putEmprendedor = async (payload) => {
    // Primer intento: payload completo (redes como objeto)
    try {
      const { data } = await apiAuth.put("/emprendedores/mi", payload);
      return data;
    } catch (e) {
      // Si el back devuelve 422, probamos:
      if (e?.response?.status === 422) {
        // 1) Serializar redes como string JSON
        const p2 = {
          ...payload,
          redes: JSON.stringify(payload.redes ?? {}),
        };
        try {
          const { data } = await apiAuth.put("/emprendedores/mi", p2);
          return data;
        } catch (e2) {
          // 2) Si aún falla, probamos también omitir 'rubro' por si el schema lo prohíbe
          if (e2?.response?.status === 422) {
            const { rubro, ...p3 } = p2;
            const { data } = await apiAuth.put("/emprendedores/mi", p3);
            return data;
          }
          throw e2;
        }
      }
      throw e;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (errNombre || errTel || errWebs) {
      setMsgErr(errNombre || errTel || errWebs);
      return;
    }

    setSaving(true);
    setMsgErr("");
    setMsgOk("");

    const payload = {
      nombre: form.nombre?.trim(),
      telefono_contacto: form.telefono_contacto?.trim() || null,
      direccion: form.direccion?.trim() || null,
      rubro: form.rubro?.trim() || null,
      descripcion: form.descripcion?.trim() || null,
      redes: redesListToObject(redes),
    };

    try {
      const data = await putEmprendedor(payload);
      setMsgOk("Datos guardados correctamente.");
      setCodigo(data?.codigo_cliente || codigo);
      setLogoUrl(data?.logo_url || logoUrl);
      setTimeout(() => setMsgOk(""), 2000);
    } catch (e2) {
      setMsgErr(niceMsg(e2));
    } finally {
      setSaving(false);
    }
  };

  const onUploadLogo = async (e) => {
    e.preventDefault();
    if (!fileRef.current?.files?.[0]) return;
    setMsgErr("");
    setMsgOk("");

    const fd = new FormData();
    fd.append("file", fileRef.current.files[0]);

    // Probar /emprendedores/mi/logo y fallback a /emprendedores/logo
    const tries = [
      () => apiAuth.post("/emprendedores/mi/logo", fd, { headers: { "Content-Type": "multipart/form-data" } }),
      () => apiAuth.post("/emprendedores/logo", fd, { headers: { "Content-Type": "multipart/form-data" } }),
    ];
    try {
      let resp;
      for (const t of tries) {
        try { resp = await t(); break; } catch (err) { if (err?.response?.status === 404) continue; else throw err; }
      }
      const url = resp?.data?.url || resp?.data?.logo_url;
      if (url) setLogoUrl(url);
      setMsgOk("Logo actualizado.");
      fileRef.current.value = "";
      setTimeout(() => setMsgOk(""), 2000);
    } catch (e2) {
      setMsgErr(niceMsg(e2));
    }
  };

  return (
    <div className="grid gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">Sin logo</div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Mi Emprendimiento</h1>
            <p className="text-sm text-slate-500">Editá tus datos públicos y redes sociales.</p>
          </div>
        </div>

        {codigo ? (
          <div className="text-sm text-slate-600">
            Código público: <b className="select-all text-slate-800">{codigo}</b>
          </div>
        ) : null}
      </header>

      {msgOk && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-2 ring-1 ring-emerald-200">
          {msgOk}
        </div>
      )}
      {msgErr && (
        <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-2 ring-1 ring-rose-200">
          {msgErr}{" "}
          {msgErr.includes("sesión se cerró") && (
            <button className={`${BTN} ml-3`} onClick={() => (window.location.href = "/login")} type="button">
              Iniciar sesión
            </button>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3 items-end">
          <div>
            <label className={LABEL}>Nombre comercial</label>
            <input className={BOX} name="nombre" value={form.nombre} onChange={onChange} disabled={loading || saving} />
            {errNombre && <p className="mt-1 text-xs text-rose-600">{errNombre}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="text-xs" disabled={loading} />
            <button className={BTN} onClick={onUploadLogo} disabled={loading} type="button">
              Subir logo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Teléfono de contacto (opcional)</label>
            <input
              className={BOX}
              name="telefono_contacto"
              value={form.telefono_contacto}
              onChange={onChange}
              disabled={loading || saving}
              placeholder="+54 9 11 5555-5555"
            />
            {errTel && <p className="mt-1 text-xs text-rose-600">{errTel}</p>}
          </div>
          <div>
            <label className={LABEL}>Rubro (opcional)</label>
            <input className={BOX} name="rubro" value={form.rubro} onChange={onChange} disabled={loading || saving} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Dirección (opcional)</label>
            <input className={BOX} name="direccion" value={form.direccion} onChange={onChange} disabled={loading || saving} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL}>Descripción (opcional)</label>
            <textarea rows={3} className={BOX} name="descripcion" value={form.descripcion} onChange={onChange} disabled={loading || saving} />
          </div>
        </div>

        <div className="grid gap-2">
          <label className={LABEL}>Redes sociales (opcionales)</label>

          <div className="grid grid-cols-1 sm:grid-cols-[160px,1fr,auto] gap-2">
            <select className={BOX} value={redNew.tipo} onChange={(e) => setRedNew((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="web">Sitio web</option>
              <option value="otro">Otro</option>
            </select>
            <input
              className={BOX}
              placeholder={redNew.tipo === "web" ? "https://tu-dominio.com" : "@tu_usuario / número / enlace"}
              value={redNew.valor}
              onChange={(e) => setRedNew((p) => ({ ...p, valor: e.target.value }))}
            />
            <button type="button" className={BTN} onClick={addRed} disabled={!redNew.valor.trim()}>
              Agregar
            </button>
          </div>

          {errWebs && <p className="mt-1 text-xs text-rose-600">{errWebs}</p>}

          {redes.length === 0 ? (
            <p className="text-sm text-slate-500">No agregaste redes.</p>
          ) : (
            <ul className="grid gap-2">
              {redes.map((r, idx) => (
                <li key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div className="text-sm text-slate-800">
                    <b className="capitalize">{r.tipo}:</b> <span className="break-all">{r.valor}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                    onClick={() => removeRed(idx)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <button type="submit" className={BTN} disabled={loading || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
