// src/pages/Registro.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as registerSvc } from "../services/usuarios";

const sideImg = "/images/mujer-que-trabaja-oficina-casa.jpg";
const cx = (...c) => c.filter(Boolean).join(" ");

function StatusOverlay({ show, mode = "loading", title, caption, onClose }) {
  if (!show) return null;
  const isOK = mode === "success";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div
          className={cx(
            "mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full",
            isOK ? "bg-blue-50" : "bg-slate-100"
          )}
        >
          {isOK ? (
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-blue-600">
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
            className="mt-4 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:brightness-110"
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}

export default function Registro() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "" });
  const [msg, setMsg] = useState("");

  const [overlay, setOverlay] = useState({ show: false, mode: "loading", title: "", caption: "" });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    const payload = {
      email: String(form.email || "").trim(),
      password: String(form.password || ""),
      nombre: form.nombre?.trim() || undefined,
      apellido: form.apellido?.trim() || undefined,
    };

    try {
      setOverlay({ show: true, mode: "loading", title: "Creando cuenta…", caption: "Guardando tus datos" });

      await registerSvc(payload); // POST /usuarios/registro

      setOverlay({
        show: true,
        mode: "success",
        title: "¡Cuenta creada!",
        caption: "Te llevamos al inicio de sesión…",
      });

      setTimeout(() => navigate("/login?nuevo=1", { replace: true }), 900);
    } catch (err) {
      const status = err?._info?.status;
      let m = err?.message || "No se pudo crear la cuenta.";
      if (status === 409) m = "El email ya está registrado.";
      if (status === 400 || status === 422) m = "Datos inválidos.";
      if (status === undefined) m = "No hay conexión con el servidor.";
      setMsg(`⚠️ ${m}`);
      setOverlay({ show: false, mode: "loading", title: "", caption: "" });
    }
  };

  return (
    <>
      <StatusOverlay
        show={overlay.show}
        mode={overlay.mode}
        title={overlay.title}
        caption={overlay.caption}
        onClose={() => setOverlay({ show: false, mode: "loading", title: "", caption: "" })}
      />

      <section className="min-h-screen w-full bg-gradient-to-b from-blue-600 to-cyan-400 grid place-items-center px-4 py-8">
        <div className="w-3/4 max-w-4xl">
          <div className="rounded-3xl p-[1px] bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-400 shadow-2xl">
            <div className="rounded-3xl bg-white/90 backdrop-blur-md mt-16">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Imagen lateral */}
                <div className="relative min-h-[260px] md:min-h-[560px]">
                  <img
                    src={sideImg}
                    alt="Emprender con Turnate"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable="false"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-sky-700/60 via-sky-600/40 to-cyan-500/30 mix-blend-multiply" />
                  <div className="relative h-full flex items-end md:items-center">
                    <div className="p-6 md:p-10 text-white drop-shadow">
                      <h2 className="text-xl md:text-2xl font-semibold leading-tight">
                        Sumate y administrá tus turnos
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Formulario */}
                <div className="p-6 md:p-10">
                  <header className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-3 py-1 text-xs font-medium text-white">
                      Nuevo usuario
                    </div>
                    <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-slate-900">Crear una cuenta</h1>
                    <p className="mt-1 text-sm text-slate-600">
                      ¿Ya tenés cuenta?{" "}
                      <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                        Iniciar sesión
                      </Link>
                    </p>
                  </header>

                  {msg && (
                    <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-2 ring-1 ring-red-200">
                      {msg}
                    </div>
                  )}

                  <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1">
                          Nombre
                        </label>
                        <input
                          id="nombre" name="nombre" type="text" value={form.nombre} onChange={onChange}
                          placeholder="Nombre"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <div>
                        <label htmlFor="apellido" className="block text-sm font-medium text-slate-700 mb-1">
                          Apellido
                        </label>
                        <input
                          id="apellido" name="apellido" type="text" value={form.apellido} onChange={onChange}
                          placeholder="Apellido"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        Correo electrónico
                      </label>
                      <input
                        id="email" name="email" type="email" value={form.email} onChange={onChange}
                        placeholder="tu@email.com" required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                        Contraseña
                      </label>
                      <input
                        id="password" name="password" type="password" autoComplete="new-password"
                        value={form.password} onChange={onChange} placeholder="••••••••" required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>

                    <button
                      type="submit"
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-white font-semibold shadow hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                      Crear cuenta
                    </button>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Al registrarte aceptás nuestros{" "}
                      <Link to="/terminos" className="text-blue-600 hover:text-blue-700">Términos y Condiciones</Link> y la{" "}
                      <Link to="/privacidad" className="text-blue-600 hover:text-blue-700">Política de Privacidad</Link>.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
