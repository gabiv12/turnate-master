// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";

/** ===== Iconos (SVG inline — sin dependencias) ===== */
const Icon = {
  Bolt: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" className="fill-current" />
    </svg>
  ),
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <path d="M8 3v3M16 3v3M3 9.5h18" className="stroke-current" strokeWidth="1.6" />
      <rect x="6.8" y="12" width="3.2" height="3.2" rx="0.8" className="fill-current" />
      <rect x="11.8" y="12" width="3.2" height="3.2" rx="0.8" className="fill-current" />
      <rect x="6.8" y="16" width="3.2" height="3.2" rx="0.8" className="fill-current" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <circle cx="12" cy="12" r="9" className="stroke-current" strokeWidth="1.8" fill="none"/>
      <path d="M12 7.5v5l3 2" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M5 13l4 4L19 7" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  Link2: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M9 15l-2 2a4 4 0 0 1-6-6l2-2" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M15 9l2-2a4 4 0 1 1 6 6l-2 2" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M8 12h8" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <path d="M9 12l2 2 4-4" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  Chart: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M4 19h16" className="stroke-current" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <rect x="6" y="11" width="3.2" height="6" rx="1" className="fill-current"/>
      <rect x="11" y="8" width="3.2" height="9" rx="1" className="fill-current"/>
      <rect x="16" y="5" width="3.2" height="12" rx="1" className="fill-current"/>
    </svg>
  ),
  Star: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17.9 6.2 20.7l1.1-6.4L2.6 9.8l6.5-.9L12 3z" className="fill-current" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M12 2l1.6 3.4L17 7l-3.4 1.6L12 12l-1.6-3.4L7 7l3.4-1.6L12 2zM5 14l.9 1.9L8 17l-2.1 1.1L5 20l-.9-1.9L2 17l2.1-1.1L5 14zm12 0l.9 1.9L20 17l-2.1 1.1L17 20l-.9-1.9L14 17l2.1-1.1L17 14z" className="fill-current"/>
    </svg>
  ),
};

export default function Home() {
  return (
    <main className="pt-20 md:pt-24 pb-10">
      <div className="mx-auto w-11/12 max-w-7xl space-y-12">
        {/* HERO — Cliente primero, promesa clara */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Texto */}
          <div className="order-2 lg:order-1 lg:pr-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 text-sky-700 px-3 py-1 text-xs font-semibold ring-1 ring-sky-200">
              <Icon.Sparkle className="h-4 w-4" /> reservas de forma sencilla y segura
            </div>
            <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Sacá tu turno en <span className="bg-gradient-to-r from-sky-700 to-indigo-600 bg-clip-text text-transparent">segundos</span>.
            </h1>
            <p className="mt-4 text-lg md:text-xl text-slate-700">
              Elegís servicio, día y horario disponible. <span className="font-semibold">Confirmación inmediata</span> para el cliente,
              <span className="font-semibold"> agenda ordenada</span> para el emprendedor.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/registro"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-700 to-indigo-600 px-6 py-3 text-white font-semibold shadow-lg ring-1 ring-blue-300/40 hover:scale-[1.02] transition"
              >
                Crear cuenta gratis
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-slate-800 font-semibold shadow hover:bg-slate-50"
              >
                Iniciar sesión
              </Link>
            </div>

            {/* Bullets clave (cliente) */}
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
              <Bullet icon={<Icon.Check className="h-4 w-4" />} text="Proceso simple, sin pasos confusos" />
              <Bullet icon={<Icon.Check className="h-4 w-4" />} text="Horarios disponibles en tiempo real" />
              <Bullet icon={<Icon.Check className="h-4 w-4" />} text="Confirmación elegante y al instante" />
              <Bullet icon={<Icon.Check className="h-4 w-4" />} text="Sin turnos solapados por servicio" />
            </ul>
          </div>

          {/* Imagen — más chica, sin borde, con glow sutil */}
          <div className="order-1 lg:order-2">
            <div className="relative max-w-[560px] mx-auto">
              <img
                id="heroImg1"
                className="rounded-2xl object-contain w-full h-auto max-h-[420px] shadow-xl"
                src="./images/IMGHome.png"
                alt="Turnos claros para clientes y agenda ordenada para emprendedores"
                draggable="false"
              />
              <div className="pointer-events-none absolute -inset-4 rounded-[28px] bg-sky-500/10 blur-2xl" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Franja de confianza (para video/landing) */}
        <TrustBar />

        {/* Beneficios (6) — mezcla cliente/emprendedor, iconos sólidos */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Icon.Bolt className="h-7 w-7" />}
            title="Rápido y claro"
            text="El cliente entiende el paso a paso en segundos."
          />
          <FeatureCard
            icon={<Icon.Calendar className="h-7 w-7" />}
            title="Calendario intuitivo"
            text="Día, semana o mes. Todo sin choques de horario."
          />
          <FeatureCard
            icon={<Icon.Clock className="h-7 w-7" />}
            title="Servicios con duración"
            text="Bloques y duración por servicio para evitar solapados."
          />
          <FeatureCard
            icon={<Icon.Link2 className="h-7 w-7" />}
            title="Link público"
            text="Compartí tu código y recibí reservas sin atender el chat."
          />
          <FeatureCard
            icon={<Icon.Shield className="h-7 w-7" />}
            title="Política de uso responsable"
            text="Solo se permite una reserva activa por cliente y servicio para garantizar un funcionamiento ordenado y justo."
          />
          <FeatureCard
            icon={<Icon.Chart className="h-7 w-7" />}
            title="Control del negocio"
            text="Agenda del día y métricas para decidir con datos."
          />
        </section>

        {/* Cómo funciona — breve, para cualquiera */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Step n="1" title="Elegí tu servicio" text="Cartas claras, duración y precio visibles." />
            <Step n="2" title="Seleccioná día y horario" text="Solo turnos disponibles. Sin confusiones." />
            <Step n="3" title="Confirmación al instante" text="Mensaje premium y email de confirmación." />
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/registro"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-700 to-indigo-600 px-6 py-3 text-white font-semibold shadow-lg ring-1 ring-blue-300/40 hover:scale-[1.02] transition"
            >
              Probar gratis
            </Link>
          </div>
        </section>

        {/* CTA final — valor para el emprendedor */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                Empezá hoy. Que tus clientes reserven sin fricción.
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Cuando la experiencia es clara, tu agenda se llena sola.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-800 font-semibold shadow hover:bg-slate-50"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/registro"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-700 to-indigo-600 px-5 py-3 text-white font-semibold shadow-lg ring-1 ring-blue-300/40 hover:scale-[1.02] transition"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/** ===== Subcomponentes ===== */
function TrustBar() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Icon.Star className="h-4 w-4" />
          </span>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Clientes felices</span>: experiencia de reserva clara y rápida.
          </p>
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <Icon.Shield className="h-4 w-4" />
          </span>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Negocios ordenados</span>: menos chat, sin solapados, agenda al día.
          </p>
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <Icon.Chart className="h-4 w-4" />
          </span>
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Decisiones con datos</span>: servicios más usados y horarios pico.
          </p>
        </div>
      </div>
    </section>
  );
}

function Bullet({ icon, text }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span className="text-emerald-600">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-sky-50 to-indigo-50 text-sky-700 ring-1 ring-slate-200 group-hover:scale-105 transition">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-slate-600">{text}</p>
    </div>
  );
}

function Step({ n, title, text }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute -top-3 left-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-sky-700 to-indigo-600 text-white text-sm font-bold shadow">
        {n}
      </div>
      <div className="mt-3">
        <h4 className="text-base font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
}
