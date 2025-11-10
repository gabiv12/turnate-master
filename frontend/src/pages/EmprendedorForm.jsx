// src/pages/EmprendedorForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as EmpSvc from "../services/emprendedores.js"; // <- import robusto (evita HMR/treeshaking)
import { useUser } from "../context/UserContext.jsx";
import Input from "../components/Input";
import Button from "../components/Button";
import ModalActivacionEmprendedor from "../components/ModalActivacionEmprendedor.jsx";

const LABEL = "block text-sm font-semibold text-slate-700 mb-1";
const BOX =
  "w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const LOGO_SRC_FALLBACK = "";

/* =========== Helpers de validación y formato (ARG) =========== */
const onlyDigits = (s = "") => (s || "").replace(/\D+/g, "");

/** DNI argentino: 7 u 8 dígitos. Se formatea como 12.345.678 */
function formatDNI(v) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
}
function isValidDNI(v) {
  const d = onlyDigits(v);
  return d.length >= 7 && d.length <= 8;
}

/**
 * Teléfono AR simplificado:
 * - Obligatorio prefijo país +54
 * - Área 3 o 4 dígitos (ej.: 11, 351, 362, 3644)
 * - Local: 6 a 7 dígitos (render con separador 3-3/4)
 * Render: +54 <area>-<xxx> <xxx/xxxx>
 * Ej.: "+54 3644-123 123" o "+54 351-456 7890"
 */
function normalizeARPhoneInput(v) {
  const d = onlyDigits(v);
  let rest = d;
  if (rest.startsWith("54")) rest = rest.slice(2);
  let area = rest.slice(0, 4);
  if (area.length === 4) {
    rest = rest.slice(4);
  } else {
    area = rest.slice(0, 3);
    rest = rest.slice(3);
  }
  const local = rest.slice(0, 7);
  const first = local.slice(0, 3);
  const second = local.slice(3);
  const areaClean = area.replace(/^0+/, "") || area;
  const pieces = [];
  if (first && second) pieces.push(`${first} ${second}`);
  else if (first) pieces.push(first);
  const base = `+54 ${areaClean || ""}${areaClean ? "-" : ""}${pieces.join("")}`;
  return base.trim();
}
function isValidARPhone(v) {
  return /^\+54\s\d{3,4}-\d{3}\s\d{3,4}$/.test((v || "").trim());
}

/** Email (simple) */
function isValidEmail(v) {
  if (!v) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** URL http(s) opcional */
function isValidHttpUrl(v) {
  if (!v) return true;
  return /^https?:\/\/.+/i.test(v.trim());
}

/** CUIT AR: formato visual XX-XXXXXXXX-X con DV */
const CUIT_WEIGHTS = [5,4,3,2,7,6,5,4,3,2];
function formatCUIT(v) {
  const d = onlyDigits(v).slice(0, 11); // 11 dígitos
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`;
}
function isValidCUIT(v) {
  const d = onlyDigits(v);
  if (d.length !== 11) return false;
  const nums = d.split("").map(n => parseInt(n, 10));
  const sum = CUIT_WEIGHTS.reduce((acc, w, i) => acc + w * nums[i], 0);
  const mod = sum % 11;
  const dv = mod === 0 ? 0 : (mod === 1 ? 9 : 11 - mod);
  return dv === nums[10];
}
/* ============================================================ */

/* ================== Badges ================== */
function RoleBadge({ rol }) {
  const map = {
    admin: { label: "Admin", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    emprendedor: { label: "Emprendedor", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    cliente: { label: "Cliente", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
    user: { label: "Usuario", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  };
  const m = map[rol] || map.cliente;
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium ring-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}
function StatusBadge({ hasEmp }) {
  return hasEmp ? (
    <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium ring-1 bg-sky-50 text-sky-700 ring-sky-200">
      Emprendimiento activo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium ring-1 bg-rose-50 text-rose-700 ring-rose-200">
      Sin emprendimiento
    </span>
  );
}
/* ============================================ */

export default function EmprendedorForm() {
  const { user, refreshUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [emp, setEmp] = useState(null);      // datos del backend
  const [extras, setExtras] = useState(null); // locales (tel, dni, etc.)
  const [showActivate, setShowActivate] = useState(false);

  const [logoPreview, setLogoPreview] = useState(LOGO_SRC_FALLBACK);
  const fileRef = useRef(null);

  const [errors, setErrors] = useState({});

  const publicUrl = useMemo(() => {
    const code = emp?.codigo_cliente || "";
    if (!code) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/reservar/${code}`;
  }, [emp]);

  const extrasKey = useMemo(() => (emp?.id ? `emp_extras_${emp.id}` : null), [emp?.id]);

  useEffect(() => {
    let t;
    if (msg) t = setTimeout(() => setMsg(""), 2200);
    return () => clearTimeout(t);
  }, [msg]);

  // Carga inicial
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refreshUser?.();
        const data = await EmpSvc.miEmprendedor().catch(() => null); // 404 => no emprendedor
        if (!data || !data.id) {
          setEmp(null);
          setExtras(null);
          setShowActivate(true);
        } else {
          setEmp(data);
          try {
            const raw = localStorage.getItem(`emp_extras_${data.id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              setExtras({
                cuit: parsed.cuit || "",
                telefono: parsed.telefono || "",
                dni: parsed.dni || "",
                direccion: parsed.direccion || "",
                rubro: parsed.rubro || "",
                redes: parsed.redes || "",
                web: parsed.web || "",
                email_contacto: parsed.email_contacto || "",
              });
              if (parsed.logoDataURL) setLogoPreview(parsed.logoDataURL);
            } else {
              setExtras({
                cuit: "", telefono: "", dni: "",
                direccion: "", rubro: "",
                redes: "", web: "", email_contacto: "",
              });
            }
          } catch {
            setExtras({
              cuit: "", telefono: "", dni: "",
              direccion: "", rubro: "",
              redes: "", web: "", email_contacto: "",
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setEmp((prev) => ({ ...prev, [name]: value }));
    if (name === "nombre") {
      setErrors((p) => ({ ...p, nombre: value?.trim() ? "" : "El nombre del negocio es obligatorio." }));
    }
  };

  const validateExtrasField = (name, v) => {
    if (name === "cuit") return isValidCUIT(v) ? "" : "CUIT inválido. Ej.: 20-12345678-3";
    if (name === "dni") return isValidDNI(v) ? "" : "Ingresá un DNI válido (7 u 8 dígitos). Ej.: 33.456.123";
    if (name === "telefono") return isValidARPhone(v) ? "" : "Formato esperado: +54 3644-123 123";
    if (name === "email_contacto") return isValidEmail(v) ? "" : "Ingresá un email válido. Ej.: contacto@mail.com";
    if (name === "web") return isValidHttpUrl(v) ? "" : "Ingresá una URL válida (http:// o https://)";
    return "";
  };

  const onChangeExtras = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "dni") v = formatDNI(v);
    if (name === "telefono") v = normalizeARPhoneInput(v);
    if (name === "cuit") v = formatCUIT(v);
    setExtras((prev) => ({ ...(prev || {}), [name]: v }));
    setErrors((prev) => ({ ...prev, [name]: validateExtrasField(name, v) }));
  };

  const onBlurExtras = (e) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: validateExtrasField(name, value) }));
  };

  const copy = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt);
      setMsg("Copiado al portapapeles.");
    } catch {
      setMsg("No se pudo copiar.");
    }
  };

  const onLogoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const persistExtrasLocal = () => {
    if (!extrasKey) return;
    try {
      const payload = { ...(extras || {}) };
      if (logoPreview && logoPreview.startsWith("data:")) {
        payload.logoDataURL = logoPreview;
      }
      localStorage.setItem(extrasKey, JSON.stringify(payload));
      setMsg("Logo y datos extra guardados localmente.");
    } catch {
      setMsg("No se pudo guardar localmente.");
    }
  };

  function validateForm() {
    const errs = {};
    // Obligatorio
    if (!emp?.nombre?.trim()) errs.nombre = "El nombre del negocio es obligatorio.";
    // Opcionales (si están cargados, deben ser válidos)
    if (extras?.cuit && !isValidCUIT(extras.cuit)) errs.cuit = "CUIT inválido. Ej.: 20-12345678-3";
    if (extras?.dni && !isValidDNI(extras.dni)) errs.dni = "Ingresá un DNI válido (7 u 8 dígitos). Ej.: 33.456.123";
    if (extras?.telefono && !isValidARPhone(extras.telefono)) errs.telefono = "Formato esperado: +54 3644-123 123";
    if (extras?.email_contacto && !isValidEmail(extras.email_contacto)) errs.email_contacto = "Ingresá un email válido. Ej.: contacto@mail.com";
    if (extras?.web && !isValidHttpUrl(extras.web)) errs.web = "Ingresá una URL válida (http:// o https://)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!emp?.id) return;

    if (!validateForm()) {
      setMsg("Revisá los campos marcados.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const payload = {
        nombre: emp?.nombre || emp?.negocio || "",
        descripcion: emp?.descripcion || "",
      };
      const updated = await EmpSvc.actualizarEmprendedor(emp.id, payload);
      setEmp(updated);
      persistExtrasLocal();
      setMsg("Datos guardados.");
    } catch {
      setMsg("No se pudo guardar. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const afterActivate = async () => {
    setShowActivate(false);
    try {
      await refreshUser?.();
      const data = await EmpSvc.miEmprendedor().catch(() => null);
      setEmp(data || null);
      if (data?.id) {
        const raw = localStorage.getItem(`emp_extras_${data.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          setExtras({
            cuit: parsed.cuit || "",
            telefono: parsed.telefono || "",
            dni: parsed.dni || "",
            direccion: parsed.direccion || "",
            rubro: parsed.rubro || "",
            redes: parsed.redes || "",
            web: parsed.web || "",
            email_contacto: parsed.email_contacto || "",
          });
          if (parsed.logoDataURL) setLogoPreview(parsed.logoDataURL);
        } else {
          setExtras({
            cuit: "", telefono: "", dni: "",
            direccion: "", rubro: "",
            redes: "", web: "", email_contacto: "",
          });
        }
      }
      setMsg("Modo Emprendedor activo.");
    } catch {
      setMsg("No se pudo cargar el emprendimiento.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-slate-600">Cargando…</div>
      </div>
    );
  }

  const errCls = "text-[12px] text-rose-600 mt-1";
  const hintCls = "text-[11px] text-slate-500 mt-1";

  return (
    <div className="rounded-2xl bg-white/95 shadow-lg ring-1 ring-slate-200 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Emprendimiento</h1>
            <p className="text-sm text-slate-600">Completá los datos de tu negocio.</p>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge rol={user?.rol} />
            <StatusBadge hasEmp={!!emp?.id} />
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            /No se pudo|error|incorrect|fall/i.test(msg)
              ? "bg-red-50 text-red-700 ring-1 ring-red-200"
              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          }`}
        >
          {msg}
        </div>
      )}

      {!emp && showActivate && (
        <ModalActivacionEmprendedor
          open={showActivate}
          onClose={() => setShowActivate(false)}
          userId={user?.id}
          onActivated={afterActivate}
        />
      )}

      {emp && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 items-start">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-28 w-28 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-gray-400 text-xs">
                    Sin logo
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onLogoChange}
                />
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => fileRef.current?.click()}
                >
                  Seleccionar logo
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm font-semibold shadow hover:brightness-110"
                  onClick={persistExtrasLocal}
                >
                  Guardar logo
                </button>
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                El logo y los datos extra se guardan localmente por ahora.
              </p>
            </div>

            {/* Campos principales */}
            <div className="grid gap-4">
              <div>
                <label className={LABEL}>Nombre del negocio</label>
                <Input
                  name="nombre"
                  value={emp?.nombre || ""}
                  onChange={onChange}
                  className={BOX}
                  required
                  placeholder="Ej.: Papelería Centro"
                />
                {errors.nombre && <div className={errCls}>{errors.nombre}</div>}
              </div>

              <div>
                <label className={LABEL}>Descripción</label>
                <textarea
                  name="descripcion"
                  value={emp?.descripcion || ""}
                  onChange={onChange}
                  rows={3}
                  className={BOX}
                  placeholder="Ej.: Útiles escolares y de oficina. Impresiones y fotocopias."
                />
              </div>

              {/* Código público */}
              <div className="grid gap-2">
                <label className={LABEL}>Código público</label>
                <div className="flex gap-2">
                  <Input readOnly value={emp?.codigo_cliente || ""} className={BOX + " font-mono"} />
                  <button
                    type="button"
                    onClick={() => copy(emp?.codigo_cliente || "")}
                    className="rounded-xl border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Copiar
                  </button>
                </div>
                {publicUrl && (
                  <div className="text-xs text-slate-600">
                    Link para compartir:{" "}
                    <button type="button" onClick={() => copy(publicUrl)} className="text-blue-600 underline">
                      {publicUrl}
                    </button>
                  </div>
                )}
              </div>

              {/* Extras (locales) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>CUIT</label>
                  <Input
                    name="cuit"
                    value={extras?.cuit || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={`${BOX} ${errors.cuit ? "ring-2 ring-rose-400" : ""}`}
                    placeholder="Ej.: 20-12345678-3"
                    inputMode="numeric"
                    maxLength={13} // 11 dígitos + 2 guiones
                  />
                  {!errors.cuit && <div className={hintCls}>Ingresá 11 dígitos. Se formatea como XX-XXXXXXXX-X.</div>}
                  {errors.cuit && <div className={errCls}>{errors.cuit}</div>}
                </div>
                <div>
                  <label className={LABEL}>DNI</label>
                  <Input
                    name="dni"
                    value={extras?.dni || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={`${BOX} ${errors.dni ? "ring-2 ring-rose-400" : ""}`}
                    placeholder="Ej.: 33.456.123"
                    inputMode="numeric"
                  />
                  {!errors.dni && <div className={hintCls}>Formato sugerido: 33.456.123</div>}
                  {errors.dni && <div className={errCls}>{errors.dni}</div>}
                </div>
                <div>
                  <label className={LABEL}>Teléfono (Argentina)</label>
                  <Input
                    name="telefono"
                    value={extras?.telefono || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={`${BOX} ${errors.telefono ? "ring-2 ring-rose-400" : ""}`}
                    placeholder="Ej.: +54 3644-123 123"
                    inputMode="tel"
                  />
                  {!errors.telefono && <div className={hintCls}>Ej.: +54 3644-123 123</div>}
                  {errors.telefono && <div className={errCls}>{errors.telefono}</div>}
                </div>
                <div className="md:col-span-2">
                  <label className={LABEL}>Dirección</label>
                  <Input
                    name="direccion"
                    value={extras?.direccion || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={BOX}
                    placeholder="Ej.: Av. Rivadavia 1234, Resistencia"
                  />
                </div>
                <div>
                  <label className={LABEL}>Rubro</label>
                  <Input
                    name="rubro"
                    value={extras?.rubro || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={BOX}
                    placeholder="Ej.: Papelería / Librería"
                  />
                </div>
                <div>
                  <label className={LABEL}>Redes</label>
                  <Input
                    name="redes"
                    value={extras?.redes || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={BOX}
                    placeholder="Ej.: @mi_negocio / fb.com/mi_negocio"
                  />
                </div>
                <div>
                  <label className={LABEL}>Web</label>
                  <Input
                    name="web"
                    value={extras?.web || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={`${BOX} ${errors.web ? "ring-2 ring-rose-400" : ""}`}
                    placeholder="Ej.: https://mi-negocio.com"
                  />
                  {errors.web && <div className={errCls}>{errors.web}</div>}
                </div>
                <div>
                  <label className={LABEL}>Email de contacto</label>
                  <Input
                    type="email"
                    name="email_contacto"
                    value={extras?.email_contacto || ""}
                    onChange={onChangeExtras}
                    onBlur={onBlurExtras}
                    className={`${BOX} ${errors.email_contacto ? "ring-2 ring-rose-400" : ""}`}
                    placeholder="Ej.: contacto@mi-negocio.com"
                  />
                  {errors.email_contacto && <div className={errCls}>{errors.email_contacto}</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <Button type="submit" disabled={saving} className="rounded-xl">
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
