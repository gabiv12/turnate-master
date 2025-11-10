// src/pages/Perfil.jsx
import React, { useEffect, useRef, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import { useUser } from "../context/UserContext.jsx";
import api, { getAuthToken, setUser as lsSetUser, setSession as lsSetSession } from "../services/api";
import { me as meSvc, updatePerfilSmart } from "../services/usuarios";

const LABEL = "block text-sm font-semibold text-slate-700 mb-1";
const BOX =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300";
const BTN =
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-2.5 text-white text-sm font-semibold shadow hover:brightness-110 disabled:opacity-60";
const CARD =
  "rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm";
const WRAP =
  "mx-auto max-w-6xl px-4 md:px-6 py-6";

/* ===== Overlay uniforme (mismo estilo que Reservar) ===== */
function StatusOverlay({ show, mode = "loading", title, caption, onClose }) {
  if (!show) return null;
  const isOK = mode === "success";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div
          className={[
            "mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full",
            isOK ? "bg-emerald-50" : "bg-slate-100",
          ].join(" ")}
        >
          {isOK ? (
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-600">
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
            className="mt-4 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow hover:brightness-110"
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}

const friendlyError = (err) => {
  const st = err?.response?.status;
  if (st === 401) return "Tu sesión se cerró. Iniciá sesión y volvé a intentar.";
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "Ocurrió un error.";
};

export default function Perfil() {
  // Context (si no existe, que no rompa)
  let ctx = { user: null };
  try { ctx = useUser() || ctx; } catch {}
  const { user } = ctx;

  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: "",
    nombre: "",
    apellido: "",
    dni: "",
  });

  // Avatar (degradable)
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarSupported, setAvatarSupported] = useState(true);
  const [avatarSaving, setAvatarSaving] = useState(false);

  // Seguridad (acordeón)
  const [secOpen, setSecOpen] = useState(false);
  const [secMsg, setSecMsg] = useState("");
  const [secSaving, setSecSaving] = useState(false);
  const [secForm, setSecForm] = useState({ actual: "", nueva: "", confirmar: "" });

  const overlayBusy = saving || avatarSaving || secSaving;

  // Cargar perfil
  useEffect(() => {
    (async () => {
      try {
        const data = await meSvc();
        setForm({
          email:    data?.email    ?? "",
          nombre:   data?.nombre   ?? "",
          apellido: data?.apellido ?? "",
          dni:      data?.dni      ?? "",
        });
        if (data?.avatar_url) setAvatarPreview(data.avatar_url);
      } catch (e) {
        setMsg(friendlyError(e));
      }
    })();
  }, []);

  const onChange = (e) => {
    let { name, value } = e.target;
    if (name === "dni") value = value.replace(/\D/g, "").slice(0, 8);
    setForm((p) => ({ ...p, [name]: value }));
  };

  // Guarda perfil usando updatePerfilSmart (devuelve objeto usuario)
  const savePerfil = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        email:    typeof form.email    === "string" ? form.email.trim()    : undefined,
        nombre:   typeof form.nombre   === "string" ? form.nombre.trim()   : undefined,
        apellido: typeof form.apellido === "string" ? form.apellido.trim() : undefined,
        dni:      typeof form.dni      === "string" ? form.dni.trim()      : undefined,
      };

      // updatePerfilSmart retorna el usuario actualizado (no res.data)
      const updatedUser = await updatePerfilSmart(payload);

      // Actualizar sesión en LS manteniendo el token actual
      const currentToken = getAuthToken();
      lsSetSession(currentToken, updatedUser);
      lsSetUser(updatedUser); // redundante pero inocuo: asegura LS consistente

      setForm((p) => ({
        ...p,
        email:    updatedUser?.email    ?? p.email,
        nombre:   updatedUser?.nombre   ?? p.nombre,
        apellido: updatedUser?.apellido ?? p.apellido,
        dni:      updatedUser?.dni      ?? p.dni,
      }));

      setMsg("Cambios guardados.");
    } catch (e2) {
      setMsg(friendlyError(e2));
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  // Avatar
  const onAvatarChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setAvatarFile(null); return; }
    setAvatarFile(f);
    const rd = new FileReader();
    rd.onload = () => setAvatarPreview(rd.result);
    rd.readAsDataURL(f);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setAvatarSaving(true);
    setAvatarMsg("");
    try {
      const fd = new FormData();
      // backend espera el campo "file"
      fd.append("file", avatarFile);
      const r = await api.post("/usuarios/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (r?.data?.avatar_url) setAvatarPreview(r.data.avatar_url);
      setAvatarMsg("Foto actualizada.");
      setTimeout(() => setAvatarMsg(""), 2500);
    } catch (e) {
      if (e?.response?.status === 404) {
        setAvatarSupported(false);
        setAvatarMsg("Tu backend no admite foto aún. Opción desactivada.");
      } else {
        setAvatarMsg(friendlyError(e));
      }
    } finally {
      setAvatarSaving(false);
    }
  };

  // Seguridad
  const savePassword = async (e) => {
    e.preventDefault();
    if (!secForm.actual || !secForm.nueva || !secForm.confirmar) {
      return setSecMsg("Completá todos los campos.");
    }
    if (secForm.nueva.length < 8) {
      return setSecMsg("La nueva contraseña debe tener al menos 8 caracteres.");
    }
    if (secForm.nueva !== secForm.confirmar) {
      return setSecMsg("La confirmación no coincide.");
    }

    setSecSaving(true);
    setSecMsg("");
    try {
      await api.put("/usuarios/me/password", {
        current_password: secForm.actual,
        new_password: secForm.nueva,
      });
      setSecMsg("Contraseña actualizada.");
      setSecForm({ actual: "", nueva: "", confirmar: "" });
    } catch (e2) {
      setSecMsg(friendlyError(e2));
    } finally {
      setSecSaving(false);
      setTimeout(() => setSecMsg(""), 3000);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50/50">
      <StatusOverlay
        show={overlayBusy}
        mode="loading"
        title="Procesando…"
        caption=""
        onClose={() => {}}
      />

      {/* ===== Bloque: Datos de perfil ===== */}
      <div className={WRAP}>
        <div className={CARD}>
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-semibold font-bold text-slate-900">Perfil</h2>
            <p className="text-sm text-slate-600">Completá los datos de tu cuenta.</p>
          </div>

          {msg && (
            <div
              className={`mb-4 rounded-xl px-4 py-2 text-sm ring-1 ${
                /error|cerró|incorrect|no se pudo|404|401|422|400/i.test(msg)
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {msg}
            </div>
          )}

          <form onSubmit={savePerfil} className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 items-start">
              {/* Columna izquierda: Avatar */}
              <div className="flex flex-col items-start gap-3">
                <div className="h-[92px] w-[92px] rounded-full overflow-hidden border border-slate-200 bg-slate-50 grid place-items-center text-slate-400">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs">Sin foto</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onAvatarChange}
                    disabled={!avatarSupported}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={!avatarSupported}
                    className={BTN}
                  >
                    Seleccionar foto
                  </button>
                  <button
                    type="button"
                    onClick={uploadAvatar}
                    disabled={!avatarSupported || !avatarFile}
                    className={BTN}
                  >
                    Guardar foto
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">La foto se guarda en el servidor si tu backend lo admite.</p>

                {!!avatarMsg && (
                  <p className="text-xs text-slate-700">{avatarMsg}</p>
                )}
              </div>

              {/* Columna derecha: Campos */}
              <div className="grid gap-4">
                <div>
                  <label className={LABEL}>Correo electrónico</label>
                  <Input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={onChange}
                    className={BOX}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Nombre</label>
                    <Input
                      name="nombre"
                      autoComplete="given-name"
                      value={form.nombre}
                      onChange={onChange}
                      className={BOX}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Apellido</label>
                    <Input
                      name="apellido"
                      autoComplete="family-name"
                      value={form.apellido}
                      onChange={onChange}
                      className={BOX}
                    />
                  </div>
                </div>

                <div>
                  <label className={LABEL}>DNI</label>
                  <Input
                    name="dni"
                    autoComplete="off"
                    value={form.dni}
                    onChange={onChange}
                    className={BOX}
                  />
                </div>
              </div>
            </div>

            <div>
              <Button type="submit" disabled={saving} className={BTN}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ===== Bloque: Seguridad (acordeón) ===== */}
      <div className={WRAP}>
        <div className={CARD}>
          <button
            type="button"
            onClick={() => setSecOpen(v => !v)}
            className="w-full flex items-center justify-between gap-3"
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900">Seguridad</h2>
              <p className="text-sm text-slate-600">Actualizá tu contraseña.</p>
            </div>
            <span className="text-slate-500 text-xl">{secOpen ? "–" : "+"}</span>
          </button>

          {secOpen && (
            <div className="mt-4">
              {secMsg && (
                <div
                  className={`mb-4 rounded-xl px-4 py-2 text-sm ring-1 ${
                    /coincide|cerró|error|no se pudo|404|401|422|400/i.test(secMsg)
                      ? "bg-red-50 text-red-700 ring-red-200"
                      : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  }`}
                >
                  {secMsg}
                </div>
              )}

              <form onSubmit={savePassword} className="grid gap-4">
                <div>
                  <label className={LABEL}>Contraseña actual</label>
                  <Input
                    type="password"
                    name="actual"
                    autoComplete="current-password"
                    value={secForm.actual}
                    onChange={e => setSecForm(p => ({ ...p, actual: e.target.value }))}
                    className={BOX}
                    required
                  />
                </div>
                <div>
                  <label className={LABEL}>Nueva contraseña</label>
                  <Input
                    type="password"
                    name="nueva"
                    autoComplete="new-password"
                    value={secForm.nueva}
                    onChange={e => setSecForm(p => ({ ...p, nueva: e.target.value }))}
                    className={BOX}
                    required
                  />
                </div>
                <div>
                  <label className={LABEL}>Confirmar contraseña</label>
                  <Input
                    type="password"
                    name="confirmar"
                    autoComplete="new-password"
                    value={secForm.confirmar}
                    onChange={e => setSecForm(p => ({ ...p, confirmar: e.target.value }))}
                    className={BOX}
                    required
                  />
                </div>

                <ul className="text-xs text-slate-600 space-y-1">
                  <li>• Al menos 8 caracteres.</li>
                  <li>• Recomendado combinar letras, números y símbolos.</li>
                </ul>

                <div>
                  <Button type="submit" disabled={secSaving} className={BTN}>
                    {secSaving ? "Guardando…" : "Actualizar contraseña"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
