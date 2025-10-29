// src/pages/Nosotros.jsx
import React from "react";
import { Link } from "react-router-dom";

/** Chips reutilizables (beneficios y “para quién”) */
const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 text-xs font-medium">
    {children}
  </span>
);

export default function Nosotros() {
  const beneficios = [
    {
      t: "Reservas en segundos",
      d: "Compartís tu código y listo: tus clientes eligen día y horario disponibles y confirman. Sin llamadas, sin anotaciones a mano.",
    },
    {
      t: "Calendario que se entiende",
      d: "Todo en un mismo lugar: agregar, mover o cancelar turnos es rápido y claro. Además tenés tu agenda del día siempre a mano.",
    },
    {
      t: "Datos que ayudan",
      d: "Ves qué servicio se pide más, cuánto estás generando y cómo va el mes. Así tomás decisiones simples para mejorar.",
    },
  ];

  const pasos = [
    {
      n: "1",
      t: "Compartí tu código",
      d: "Te damos un código público. Lo pasás por WhatsApp/Instagram o lo ponés en tu bio.",
    },
    {
      n: "2",
      t: "Eligen día y hora",
      d: "Ven tus horarios habilitados. Lo ocupado no aparece, lo libre sí.",
    },
    {
      n: "3",
      t: "Listo, ¡reservado!",
      d: "El turno queda en tu calendario. Podés editarlo, moverlo o cancelarlo cuando quieras.",
    },
  ];

  const rubros = [
    "Peluquería/Barbería",
    "Estética",
    "Clases",
    "Salud",
    "Servicios a domicilio",
    "Talleres",
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HERO (más contraste) */}
      <section
        className="relative isolate overflow-hidden"
        aria-labelledby="hero-title"
      >
        {/* Fondo */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-blue-600 to-cyan-400" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-900/25 via-transparent to-slate-900/25" />

        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          {/* Tarjeta translucida */}
          <div className="max-w-3xl rounded-2xl bg-slate-900/25 backdrop-blur-[1px] ring-1 ring-white/10 p-6">
            <h1
              id="hero-title"
              className="text-4xl sm:text-5xl font-bold tracking-tight text-white"
            >
              Organizá tus turnos sin enredos
            </h1>
            <p className="mt-4 text-white/95 text-lg">
              Turnate es una turnera simple: tus clientes ven los horarios
              libres y reservan; vos administrás todo desde un calendario fácil,
              sin mensajes de ida y vuelta.
            </p>

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
      </section>

      {/* BENEFICIOS */}
      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="beneficios-title">
        <h2 id="beneficios-title" className="sr-only">
          Beneficios
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {beneficios.map((b, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <h3 className="text-base font-semibold text-slate-900">{b.t}</h3>
              <p className="mt-2 text-sm text-slate-600">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="pasos-title">
        <h2 id="pasos-title" className="text-2xl font-semibold text-slate-900">
          ¿Cómo funciona?
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pasos.map((p) => (
            <li
              key={p.n}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white text-sm font-semibold">
                  {p.n}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">{p.t}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ¿PARA QUIÉN SIRVE? */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="publico-title">
        <h2 id="publico-title" className="text-2xl font-semibold text-slate-900">
          Pensado para cualquier profesional
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Ideal para quienes atienden con turno: peluquería/barbería, uñas y
          pestañas, masajes, estética, clases, consultorios, talleres y más.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rubros.map((x) => (
            <Chip key={x}>{x}</Chip>
          ))}
        </div>
      </section>

      {/* MÉTRICAS (ficticias) */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="metricas-title">
        <h2 id="metricas-title" className="sr-only">
          Métricas
        </h2>
        <div className="grid grid-cols-1 gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-3xl font-semibold text-slate-900">+1.2k</p>
            <p className="text-sm text-slate-500">Turnos coordinados</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-slate-900">+120</p>
            <p className="text-sm text-slate-500">Emprendimientos</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-semibold text-slate-900">98%</p>
            <p className="text-sm text-slate-500">Satisfacción</p>
          </div>
        </div>
      </section>

      {/* LO QUE TE LLEVA A LA ACCIÓN */}
      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="cta-simple-title">
        <h2 id="cta-simple-title" className="sr-only">
          Empezá hoy
        </h2>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-xl font-semibold text-slate-900">Empezá hoy</h3>
          <p className="mt-1 text-sm text-slate-600">
            Configurás tus servicios y horarios una sola vez. Después, tus
            clientes reservan cuando quieran y vos te dedicás a trabajar.
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

      {/* PREGUNTAS FRECUENTES */}
      <section className="mx-auto max-w-6xl px-4 py-8" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-2xl font-semibold text-slate-900">
          Preguntas frecuentes
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <details className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <summary className="cursor-pointer select-none font-medium text-slate-900">
              ¿Mis clientes tienen que descargar algo?
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              No. Solo entran al link, pegan tu código público y reservan. Listo.
            </p>
          </details>

          <details className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <summary className="cursor-pointer select-none font-medium text-slate-900">
              ¿Puedo mover o cancelar un turno?
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              Sí. Desde tu calendario podés editar, reprogramar o cancelar en segundos.
            </p>
          </details>

          <details className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <summary className="cursor-pointer select-none font-medium text-slate-900">
              ¿Y si no me llevo bien con la tecnología?
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              No te preocupes: todo está explicado paso a paso. En minutos lo tenés funcionando.
            </p>
          </details>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="cta-final-title">
        <h2 id="cta-final-title" className="sr-only">
          Ordená tu agenda y ganá tiempo
        </h2>
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-8 text-white shadow-sm">
          <h3 className="text-2xl font-semibold">Ordená tu agenda y ganá tiempo</h3>
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
