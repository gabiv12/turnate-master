// src/pages/Registro.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../services/usuarios.js"; // servicio de registro
import Button from "../components/Button";
import Input from "../components/Input";
import Loader from "../components/Loader";

const sideImg = "/images/mujer-que-trabaja-oficina-casa.jpg";

export default function Registro() {
  const navigate = useNavigate();

  // Campos del formulario
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setMsg("");
    setSuccessMsg("");

    const payload = {
      email: String(form.email || "").trim(),
      password: String(form.password || ""),
      nombre: form.nombre?.trim() || undefined,
      apellido: form.apellido?.trim() || undefined,
    };

    try {
      await register(payload); // 201 si ok

      // Mostrar mensaje de éxito antes de redirigir
      setSuccessMsg("✅ Cuenta creada. Serás redirigido al inicio de sesión...");
      
      // Esperar 2 segundos antes de navegar
      setTimeout(() => {
        navigate("/login?nuevo=1", { replace: true });
      }, 2000);

    } catch (err) {
      const status = err?._info?.status ?? err?.response?.status;
      const data = err?._info?.data ?? err?.response?.data;

      console.warn("[REGISTRO] error status:", status, "data:", data);

      let m = "No se pudo crear la cuenta.";
      if (status === 409) m = "El email ya está registrado.";
      if (status === 400 || status === 422) {
        m =
          typeof data?.detail === "string"
            ? data.detail
            : "Datos inválidos.";
      }
      if (status === undefined) {
        m =
          "No hay conexión con el servidor. Verificá VITE_API_URL y que el backend esté corriendo.";
      }
      setMsg(`⚠️ ${m}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm grid place-items-center z-50">
          <Loader />
        </div>
      )}

      <section className="min-h-screen w-full bg-gradient-to-b from-blue-600 to-cyan-400 grid place-items-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <div className="rounded-3xl p-[1px] bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-400 shadow-2xl">
            <div className="rounded-2xl bg-white/90 backdrop-blur-md mt-16">
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
                    <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-slate-900">
                      Crear una cuenta
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      ¿Ya tenés cuenta?{" "}
                      <Link
                        to="/login"
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        Iniciar sesión
                      </Link>
                    </p>
                  </header>

                  {msg && (
                    <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-2 ring-1 ring-red-200">
                      {msg}
                    </div>
                  )}

                  {successMsg && (
                    <div className="mb-4 rounded-xl bg-green-50 text-green-700 text-sm px-4 py-2 ring-1 ring-green-200">
                      {successMsg}
                    </div>
                  )}

                  <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="nombre"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Nombre
                        </label>
                        <Input
                          id="nombre"
                          name="nombre"
                          type="text"
                          value={form.nombre}
                          onChange={onChange}
                          placeholder="Nombre"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="apellido"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          Apellido
                        </label>
                        <Input
                          id="apellido"
                          name="apellido"
                          type="text"
                          value={form.apellido}
                          onChange={onChange}
                          placeholder="Apellido"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Correo electrónico
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={onChange}
                        placeholder="tu@email.com"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Contraseña
                      </label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={onChange}
                        placeholder="••••••••"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-white font-semibold shadow hover:scale-[1.01] active:scale-[0.99] transition disabled:opacity-60"
                    >
                      Crear cuenta
                    </Button>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Al registrarte aceptás nuestros{" "}
                      <Link
                        to="/terminos"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Términos y Condiciones
                      </Link>{" "}
                      y la{" "}
                      <Link
                        to="/privacidad"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Política de Privacidad
                      </Link>
                      .
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
