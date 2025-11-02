// src/pages/EmprendedorForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";
import Input from "../components/Input";
import Button from "../components/Button";
import ModalActivacionEmprendedor from "../components/ModalActivacionEmprendedor.jsx";

const LABEL = "block text-sm font-semibold text-slate-700 mb-1";
const BOX = "w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const LOGO_SRC_FALLBACK = ""; // si querés mostrar algo por defecto

export default function EmprendedorForm() {
  const { user, refreshUser, isEmprendedor } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [emp, setEmp] = useState(null);      // datos “oficiales” del backend
  const [extras, setExtras] = useState(null); // datos locales (cuit/telefono/etc.)
  const [showActivate, setShowActivate] = useState(false);

  // Logo (local, sin backend)
  const [logoPreview, setLogoPreview] = useState(LOGO_SRC_FALLBACK);
  const [logoFile, setLogoFile] = useState(null);
  const fileRef = useRef(null);

  // URL pública (si hay código)
  const publicUrl = useMemo(() => {
    const code = emp?.codigo_cliente || "";
    if (!code) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/reservar/${code}`;
  }, [emp]);

  // Clave para extras
  const extrasKey = useMemo(() => (emp?.id ? `emp_extras_${emp.id}` : null), [emp?.id]);

  useEffect(() => {
    let t;
    if (msg) t = setTimeout(() => setMsg(""), 2200);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Asegurá sesión actualizada
        await refreshUser?.();
        // Trae “mi emprendedor”
        const r = await api.get("/usuarios/me/emprendedor");
        const data = r?.data || null;
        setEmp(data);

        // Cargar extras locales si existieran
        if (data?.id) {
          try {
            const raw = localStorage.getItem(`emp_extras_${data.id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              setExtras(parsed);
              if (parsed.logoDataURL) setLogoPreview(parsed.logoDataURL);
            } else {
              setExtras({
                cuit: "",
                telefono: "",
                direccion: "",
                rubro: "",
                redes: "",
                web: "",
                email_contacto: "",
              });
            }
          } catch {
            setExtras({
              cuit: "",
              telefono: "",
              direccion: "",
              rubro: "",
              redes: "",
              web: "",
              email_contacto: "",
            });
          }
        }
      } catch (e) {
        // 404 => no es emprendedor todavía
        setEmp(null);
        setExtras(null);
        setShowActivate(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setEmp((prev) => ({ ...prev, [name]: value }));
  };

  const onChangeExtras = (e) => {
    const { name, value } = e.target;
    setExtras((prev) => ({ ...(prev || {}), [name]: value }));
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
    setLogoFile(f);
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
    } catch {}
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!emp?.id) return;

    setSaving(true); setMsg("");
    try {
      // El back actual guarda seguro estos dos (y el código ya existe)
      const payload = {
        nombre: emp?.nombre || emp?.negocio || "",
        descripcion: emp?.descripcion || "",
        // No intentamos cambiar codigo_cliente si el back no lo permite
      };

      await api.put(`/emprendedores/${emp.id}`, payload);

      // Persistimos extras localmente
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
    // refresca user + emprendedor
    try {
      await refreshUser?.();
      const r = await api.get("/usuarios/me/emprendedor");
      setEmp(r?.data || null);
      if (r?.data?.id) {
        const raw = localStorage.getItem(`emp_extras_${r.data.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          setExtras(parsed);
          if (parsed.logoDataURL) setLogoPreview(parsed.logoDataURL);
        } else {
          setExtras({
            cuit: "",
            telefono: "",
            direccion: "",
            rubro: "",
            redes: "",
            web: "",
            email_contacto: "",
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

  return (
    <div className="rounded-2xl bg-white/95 shadow-lg ring-1 ring-slate-200 p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Emprendimiento</h1>
        <p className="text-sm text-slate-600">Completá los datos de tu negocio.</p>
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
                  <div className="grid h-full w-full place-items-center text-gray-400 text-xs">Sin logo</div>
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
                El logo se guarda localmente por ahora.
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
                />
              </div>

              <div>
                <label className={LABEL}>Descripción</label>
                <textarea
                  name="descripcion"
                  value={emp?.descripcion || ""}
                  onChange={onChange}
                  rows={3}
                  className={BOX}
                />
              </div>

              {/* Código público (solo lectura + copiar) */}
              <div className="grid gap-2">
                <label className={LABEL}>Código público</label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={emp?.codigo_cliente || ""}
                    className={BOX + " font-mono"}
                  />
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
                    <button
                      type="button"
                      onClick={() => copy(publicUrl)}
                      className="text-blue-600 underline"
                    >
                      {publicUrl}
                    </button>
                  </div>
                )}
              </div>

              {/* Extras (locales) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>CUIT</label>
                  <Input name="cuit" value={extras?.cuit || ""} onChange={onChangeExtras} className={BOX} />
                </div>
                <div>
                  <label className={LABEL}>Teléfono</label>
                  <Input name="telefono" value={extras?.telefono || ""} onChange={onChangeExtras} className={BOX} />
                </div>
                <div className="md:col-span-2">
                  <label className={LABEL}>Dirección</label>
                  <Input name="direccion" value={extras?.direccion || ""} onChange={onChangeExtras} className={BOX} />
                </div>
                <div>
                  <label className={LABEL}>Rubro</label>
                  <Input name="rubro" value={extras?.rubro || ""} onChange={onChangeExtras} className={BOX} />
                </div>
                <div>
                  <label className={LABEL}>Redes</label>
                  <Input name="redes" value={extras?.redes || ""} onChange={onChangeExtras} className={BOX} placeholder="@mi_negocio / fb.com/mi_negocio" />
                </div>
                <div>
                  <label className={LABEL}>Web</label>
                  <Input name="web" value={extras?.web || ""} onChange={onChangeExtras} className={BOX} placeholder="https://…" />
                </div>
                <div>
                  <label className={LABEL}>Email de contacto</label>
                  <Input type="email" name="email_contacto" value={extras?.email_contacto || ""} onChange={onChangeExtras} className={BOX} />
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
