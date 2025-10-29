// src/pages/Perfil.jsx
import React, { useState, useContext, useEffect, useRef } from "react";
import { UserContext } from "../context/UserContext";
import { apiAuth } from "../services/api";
import Button from "../components/Button";
import Input from "../components/Input";

const BTN =
  "rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-2.5 text-white text-sm font-semibold shadow hover:brightness-110 disabled:opacity-60";
const BOX =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300";
const LABEL = "block text-xs font-semibold text-sky-700 mb-1";

const friendlyError = (err) => {
  const st = err?.response?.status;
  if (st === 401) return "Tu sesión se cerró. Iniciá sesión y volvé a intentar.";
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "Ocurrió un error.";
};

export default function Perfil() {
  const { user, setUser } = useContext(UserContext) || {};
  const fileRef = useRef(null);

  const [activeTab, setActiveTab] = useState("perfil"); // "perfil" | "seguridad"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    nombre: "",
    apellido: "",
    dni: "",
  });

  // Avatar (solo previsualiza; subida degradable)
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarSupported, setAvatarSupported] = useState(true);
  const [avatarMsg, setAvatarMsg] = useState("");

  // Seguridad
  const [secSaving, setSecSaving] = useState(false);
  const [secMsg, setSecMsg] = useState("");
  const [secForm, setSecForm] = useState({ actual: "", nueva: "", confirmar: "" });

  // ---- CARGAR PERFIL (siempre /usuarios/me)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiAuth.get("/usuarios/me");
        setForm({
          username: data?.username ?? "",
          email: data?.email ?? "",
          nombre: data?.nombre ?? "",
          apellido: data?.apellido ?? "",
          dni: data?.dni ?? "",
        });
        if (data?.avatar_url) setAvatarPreview(data.avatar_url);
      } catch (e) {
        setMsg(friendlyError(e));
      }
    })();
  }, []);

  // ---- HANDLERS PERFIL
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const validatePerfil = () => {
    if (!form.username?.trim()) return "Ingresá tu usuario.";
    if (!form.email?.trim()) return "Ingresá tu correo electrónico.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      return "Ingresá un correo electrónico válido.";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validatePerfil();
    if (v) return setMsg(v);

    setLoading(true);
    setMsg("");
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        nombre: form.nombre?.trim() || null,
        apellido: form.apellido?.trim() || null,
        dni: form.dni?.trim() || null,
      };
      const { data } = await apiAuth.put("/usuarios/me", payload);

      setUser?.({
        ...(user || {}),
        username: data?.username ?? payload.username,
        email: data?.email ?? payload.email,
        nombre: data?.nombre ?? payload.nombre,
        apellido: data?.apellido ?? payload.apellido,
        dni: data?.dni ?? payload.dni,
      });
      setMsg("Cambios guardados.");
    } catch (e2) {
      setMsg(friendlyError(e2));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  // ---- AVATAR (opcional, degradable: si 404 se desactiva)
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
    setAvatarMsg("");
    const fd = new FormData();
    fd.append("avatar", avatarFile);
    try {
      // único intento: /usuarios/me/avatar (tu back actual no lo tiene)
      const r = await apiAuth.post("/usuarios/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (r?.data?.avatar_url) setAvatarPreview(r.data.avatar_url);
      setAvatarMsg("Foto actualizada.");
      setTimeout(() => setAvatarMsg(""), 2000);
    } catch (e) {
      if (e?.response?.status === 404) {
        setAvatarSupported(false);
        setAvatarMsg("Tu backend aún no permite subir foto. Se desactivó esta opción.");
      } else {
        setAvatarMsg(friendlyError(e));
      }
    }
  };

  // ---- SEGURIDAD
  const onChangeSec = (e) => {
    const { name, value } = e.target;
    setSecForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmitSecurity = async (e) => {
    e.preventDefault();
    if (!secForm.actual || !secForm.nueva || !secForm.confirmar)
      return setSecMsg("Completá todos los campos.");
    if (secForm.nueva.length < 8)
      return setSecMsg("La nueva contraseña debe tener al menos 8 caracteres.");
    if (secForm.nueva !== secForm.confirmar)
      return setSecMsg("La confirmación no coincide.");

    setSecSaving(true);
    setSecMsg("");
    try {
      // route de cambio de clave soportada por tu back:
      await apiAuth.put("/usuarios/me/password", {
        old_password: secForm.actual,
        new_password: secForm.nueva,
      });
      setSecMsg("Contraseña actualizada.");
      setSecForm({ actual: "", nueva: "", confirmar: "" });
    } catch (e2) {
      setSecMsg(friendlyError(e2));
    } finally {
      setSecSaving(false);
      setTimeout(() => setSecMsg(""), 2500);
    }
  };

  return (
    <div className="min-h-[100dvh] flex justify-center px-4 py-8">
      <div className="w-full max-w-4xl">
        {/* Encabezado (letras blancas + borde) */}
        <div className="rounded-2xl p-[1px] bg-gradient-to-r from-blue-600 to-cyan-400 mb-4">
          <div className="rounded-2xl bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-bold">Perfil</h1>
              <p className="text-xs md:text-sm text-white/80">
                Actualizá tu información y tu contraseña.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Tabs con tu botón azul */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("perfil")}
              className={`${BTN} !px-4 !py-2 ${activeTab === "perfil" ? "" : "opacity-70"}`}
            >
              Perfil
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("seguridad")}
              className={`${BTN} !px-4 !py-2 ${activeTab === "seguridad" ? "" : "opacity-70"}`}
            >
              Seguridad
            </button>
          </div>

          {/* Mensajes */}
          {activeTab === "perfil" && !!msg && (
            <div
              className={`mb-4 rounded-xl px-4 py-2 text-sm ${
                /cerró|error|no se pudo|incorrecta|en uso|422|400|401/i.test(msg)
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {msg}{" "}
              {msg.includes("sesión se cerró") && (
                <button
                  className={`${BTN} ml-2 !px-4 !py-1.5`}
                  onClick={() => (window.location.href = "/login")}
                  type="button"
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          )}
          {activeTab === "seguridad" && !!secMsg && (
            <div
              className={`mb-4 rounded-xl px-4 py-2 text-sm ${
                /coincide|cerró|error|no se pudo|422|400|401/i.test(secMsg)
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {secMsg}
            </div>
          )}

          {/* PERFIL */}
          {activeTab === "perfil" && (
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 items-start">
                {/* Avatar (degradable) */}
                <div className="flex flex-col items-center gap-3">
                  <div className="h-28 w-28 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-gray-400 text-xs">Sin foto</div>
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
                      className={BTN}
                      onClick={() => fileRef.current?.click()}
                      disabled={!avatarSupported}
                    >
                      Seleccionar foto
                    </button>
                    <button
                      type="button"
                      className={BTN}
                      onClick={uploadAvatar}
                      disabled={!avatarSupported || !avatarFile}
                    >
                      Subir
                    </button>
                  </div>
                  {!!avatarMsg && (
                    <p className="text-xs text-slate-600 text-center">{avatarMsg}</p>
                  )}
                </div>

                {/* Campos */}
                <div className="grid gap-4">
                  <div>
                    <label className={LABEL}>Usuario</label>
                    <Input
                      name="username"
                      value={form.username}
                      onChange={onChange}
                      className={BOX}
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Correo electrónico</label>
                    <Input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={onChange}
                      className={BOX}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Nombre</label>
                      <Input name="nombre" value={form.nombre} onChange={onChange} className={BOX} />
                    </div>
                    <div>
                      <label className={LABEL}>Apellido</label>
                      <Input name="apellido" value={form.apellido} onChange={onChange} className={BOX} />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>DNI</label>
                    <Input name="dni" value={form.dni} onChange={onChange} className={BOX} />
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <Button type="submit" disabled={loading} className={BTN}>
                  {loading ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          )}

          {/* SEGURIDAD */}
          {activeTab === "seguridad" && (
            <form onSubmit={onSubmitSecurity} className="grid gap-4">
              <div>
                <label className={LABEL}>Contraseña actual</label>
                <Input
                  type="password"
                  name="actual"
                  value={secForm.actual}
                  onChange={onChangeSec}
                  className={BOX}
                  required
                />
              </div>
              <div>
                <label className={LABEL}>Nueva contraseña</label>
                <Input
                  type="password"
                  name="nueva"
                  value={secForm.nueva}
                  onChange={onChangeSec}
                  className={BOX}
                  required
                />
              </div>
              <div>
                <label className={LABEL}>Confirmar contraseña</label>
                <Input
                  type="password"
                  name="confirmar"
                  value={secForm.confirmar}
                  onChange={onChangeSec}
                  className={BOX}
                  required
                />
              </div>

              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Al menos 8 caracteres.</li>
                <li>• Recomendado combinar letras, números y símbolos.</li>
              </ul>

              <div className="pt-1">
                <Button type="submit" disabled={secSaving} className={BTN}>
                  {secSaving ? "Guardando…" : "Actualizar contraseña"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
