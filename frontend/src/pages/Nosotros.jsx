// src/pages/Nosotros.jsx
import React from "react";
import { Link } from "react-router-dom";

/* =============== Iconos (SVG inline — sin dependencias) =============== */
const Icon = {
  Pain: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <circle cx="12" cy="12" r="9" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <path d="M8.5 10.5c.8-.8 2.2-.8 3 0m4-2c-.8-.8-2.2-.8-3 0M8 16c2-1.2 6-1.2 8 0" className="stroke-current" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  Solution: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M12 2l2.5 4.7 5.3.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.3-.8L12 2z" className="fill-current"/>
    </svg>
  ),
  NoOverlap: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <circle cx="8.5" cy="12" r="5.5" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <circle cx="15.5" cy="12" r="5.5" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <path d="M3 3l18 18" className="stroke-current" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <path d="M8 3v3M16 3v3M3 9.5h18" className="stroke-current" strokeWidth="1.6"/>
      <rect x="6.5" y="12" width="3.4" height="3.4" rx="0.8" className="fill-current"/>
      <rect x="11.7" y="12" width="3.4" height="3.4" rx="0.8" className="fill-current"/>
      <rect x="6.5" y="16" width="3.4" height="3.4" rx="0.8" className="fill-current"/>
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <circle cx="12" cy="12" r="9" className="stroke-current" strokeWidth="1.8" fill="none"/>
      <path d="M12 7.5v5l3 2" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" className="stroke-current" strokeWidth="1.6" fill="none"/>
      <path d="M9 12l2 2 4-4" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  Link2: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M9 15l-2 2a4 4 0 0 1-6-6l2-2" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M15 9l2-2a4 4 0 1 1 6 6l-2 2" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M8 12h8" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
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
  Check: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path d="M5 13l4 4L19 7" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
};

/* Chip reutilizable */
const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 text-xs font-medium">
    {children}
  </span>
);

export default function Nosotros() {
  /* Sección PROBLEMA → SOLUCIÓN (copy que vende) */
  const pains = [
    { t: "Turnos solapados", d: "Dos clientes a la misma hora. Se cae la experiencia y perdés confianza.", icon: <Icon.NoOverlap className="h-5 w-5" /> },
    { t: "Mensajes interminables", d: "Coordinás por WhatsApp todo el día. Perdés tiempo y foco.", icon: <Icon.Clock className="h-5 w-5" /> },
    { t: "Confusión de horarios", d: "El cliente no sabe qué hay disponible. Vos tampoco.", icon: <Icon.Calendar className="h-5 w-5" /> },
  ];

  const solutions = [
    { t: "Sólo horarios libres", d: "Mostramos disponibilidad real por servicio. Lo ocupado no existe.", icon: <Icon.NoOverlap className="h-5 w-5" /> },
    { t: "Reserva en 3 pasos", d: "El cliente elige servicio, día y hora. Confirmado en segundos.", icon: <Icon.Solution className="h-5 w-5" /> },
    { t: "Reglas anti-abuso", d: "1 reserva activa por cliente/servicio. Sin sobrecupos.", icon: <Icon.Shield className="h-5 w-5" /> },
  ];

  const pasos = [
    { n: "1", t: "Compartí tu código", d: "Lo pegás en tu bio o lo enviás por WhatsApp. Sin apps raras." },
    { n: "2", t: "Eligen día y hora", d: "Mostramos sólo disponibilidad real. Sin choques." },
    { n: "3", t: "Listo, ¡reservado!", d: "Confirmación elegante para el cliente y agenda ordenada para vos." },
  ];

  const rubros = [
    "Peluquería/Barbería", "Estética", "Consultorios", "Clases y talleres",
    "Servicios a domicilio", "Fitness/Wellness",
  ];

  return (
    <main className="min-h-screen bg-slate-50 pt-24 md:pt-20">
      {/* HERO — define la necesidad y el resultado */}
      <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-blue-600 to-cyan-400" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-900/25 via-transparent to-slate-900/25" />

        <div className="mx-auto max-w-6xl px-4">
          <div className="min-h-[46dvh] sm:min-h-[52dvh] grid place-items-center py-10 sm:py-14">
            <div className="max-w-3xl rounded-2xl bg-slate-900/25 backdrop-blur-[1px] ring-1 ring-white/10 p-6 sm:p-7 md:p-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <Icon.Pain className="h-4 w-4" /> La necesidad
              </span>
              <h1 id="hero-title" className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-white">
                Evitar turnos solapados y mensajes eternos
              </h1>
              <p className="mt-3 text-white/95 text-lg">
                Tus clientes quieren reservar fácil y sin confusiones. Vos necesitás agenda clara, sin sobrecupos y con confirmaciones al instante.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Badge text="Cero solapados" />
                <Badge text="Horarios en tiempo real" />
                <Badge text="Reserva en 3 pasos" />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/reservar" className="btn-primary" aria-label="Probar como cliente">
                  Probar como cliente
                </Link>
                <Link to="/registro" className="btn-plain" aria-label="Crear mi cuenta">
                  Crear mi cuenta
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA → SOLUCIÓN (en dos tarjetas enfrentadas) */}
      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="ps-title">
        <h2 id="ps-title" className="text-2xl font-semibold text-slate-900">Problema → Solución</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-rose-200/70">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-rose-700">
              <Icon.Pain className="h-5 w-5" /> Lo que te frena
            </h3>
            <ul className="mt-3 space-y-2">
              {pains.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-rose-600 mt-0.5">{p.icon}</span>
                  <div>
                    <span className="font-semibold">{p.t}</span>
                    <div>{p.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-200/70">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-emerald-700">
              <Icon.Solution className="h-5 w-5" /> Cómo lo resolvemos
            </h3>
            <ul className="mt-3 space-y-2">
              {solutions.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-emerald-600 mt-0.5">{s.icon}</span>
                  <div>
                    <span className="font-semibold">{s.t}</span>
                    <div>{s.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* CÓMO FUNCIONA (paso a paso corto) */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="pasos-title">
        <h2 id="pasos-title" className="text-2xl font-semibold text-slate-900">¿Cómo funciona?</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pasos.map((p) => (
            <li key={p.n} className="relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="absolute -top-3 left-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold shadow">
                {p.n}
              </div>
              <div className="mt-3">
                <h3 className="text-sm font-semibold text-slate-900">{p.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* BENEFICIOS CLAVE (con iconos definidos) */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="beneficios-title">
        <h2 id="beneficios-title" className="text-2xl font-semibold text-slate-900">Lo importante de verdad</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Feature icon={<Icon.NoOverlap className="h-6 w-6" />} title="Cero solapados" text="Disponibilidad real por servicio. Si está ocupado, no existe." />
          <Feature icon={<Icon.Calendar className="h-6 w-6" />} title="Calendario intuitivo" text="Día, semana o mes. Editar, mover o cancelar es simple." />
          <Feature icon={<Icon.Shield className="h-6 w-6" />} title="Reglas claras" text="1 reserva activa por cliente/servicio. Sin sobrecupos." />
          <Feature icon={<Icon.Clock className="h-6 w-6" />} title="Duraciones y bloques" text="Definí por servicio y olvidate de los choques." />
          <Feature icon={<Icon.Link2 className="h-6 w-6" />} title="Link público" text="Compartí tu código y recibí reservas sin atender el chat." />
          <Feature icon={<Icon.Chart className="h-6 w-6" />} title="Decisiones con datos" text="Servicios más pedidos, horarios pico, evolución del mes." />
        </div>
      </section>

      {/* ¿PARA QUIÉN? */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="publico-title">
        <h2 id="publico-title" className="text-2xl font-semibold text-slate-900">Hecho para profesionales que dan turno</h2>
        <p className="mt-2 text-sm text-slate-600">
          Si necesitás reservar en orden y sin mensajes de ida y vuelta, Turnate es para vos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rubros.map((x) => <Chip key={x}>{x}</Chip>)}
        </div>
      </section>

      {/* MICROCOPY SOCIAL (escenario breve) */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="caso-title">
        <h2 id="caso-title" className="text-2xl font-semibold text-slate-900">Cuando el sistema te despeja el camino</h2>
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-700">
            “Antes coordinaba por WhatsApp y terminaba con superposiciones. Con Turnate, los clientes ven sólo lo disponible
            y confirman solos. <span className="font-semibold">Menos chat, más tiempo para trabajar</span>.”
          </p>
        </div>
      </section>

      {/* CTA SIMPLE */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="cta-simple-title">
        <h2 id="cta-simple-title" className="sr-only">Empezá hoy</h2>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-xl font-semibold text-slate-900">Probalo hoy</h3>
          <p className="mt-1 text-sm text-slate-600">
            Configurás tus servicios y horarios una sola vez. Después, tus clientes reservan cuando quieran.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/registro" className="btn-primary" aria-label="Crear mi cuenta">
              Crear mi cuenta
            </Link>
            <Link to="/reservar" className="btn-plain" aria-label="Probar como cliente">
              Probar como cliente
            </Link>
            <Link to="/estadisticas" className="btn-plain" aria-label="Ver estadísticas">
              Ver estadísticas
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="cta-final-title">
        <h2 id="cta-final-title" className="sr-only">Ordená tu agenda y ganá tiempo</h2>
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-8 text-white shadow-sm">
          <h3 className="text-2xl font-semibold">Agenda ordenada. Clientes contentos.</h3>
          <p className="mt-1 text-white/90">
            Sumate gratis. Habilitá tus horarios y empezá a recibir reservas hoy.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/registro"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
              aria-label="Crear mi cuenta"
            >
              Crear mi cuenta
            </Link>
            <Link
              to="/reservar"
              className="rounded-xl ring-1 ring-inset ring-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              aria-label="Probar como cliente"
            >
              Probar como cliente
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* =============== Subcomponentes =============== */
function Badge({ text }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/30">
      <Icon.Check className="h-3.5 w-3.5" /> {text}
    </span>
  );
}

function Feature({ icon, title, text }) {
  return (
    <article className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-sky-50 to-indigo-50 text-sky-700 ring-1 ring-slate-200 group-hover:scale-105 transition">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </article>
  );
}
