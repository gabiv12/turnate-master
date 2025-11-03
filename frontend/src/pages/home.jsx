import React from "react";
import Typewriter from "typewriter-effect";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main className="pt-20 md:pt-24 pb-10">
      <div className="mx-auto w-11/12 max-w-7xl space-y-10">
        {/* HERO (estilo del original) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left */}
          <div className="flex flex-col justify-center pl-4 lg:pl-0">
            <h1 className="text-3xl mb-8 font-semibold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent xl:text-4xl lg:text-2xl pb-2">
              Gestioná tus turnos{" "}
              <span className="block w-full lg:w-[520px]">
                <Typewriter
                  options={{
                    strings: ["de manera simple y eficiente", "desde cualquier lugar"],
                    autoStart: true,
                    loop: true,
                    cursor: "_",
                    delay: 70,
                    deleteSpeed: 50,
                  }}
                />
              </span>
            </h1>

            <p className="py-2 mt-2 text-lg text-gray-500 md:py-4 2xl:pr-5">
              Para quienes buscan atención profesional, y para emprendedores que quieren administrar sus agendas fácilmente.
              Nuestra plataforma conecta a clientes con expertos, facilitando la organización y el crecimiento de tu negocio.
              <br />
              Reservá tu turno o administrá tu calendario con la confianza de estar en manos de profesionales.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-block bg-gradient-to-r from-blue-600 to-cyan-400 shadow-lg text-white rounded-lg px-12 py-4 hover:scale-105 hover:from-cyan-400 hover:to-blue-600 transition duration-300 ease-in-out"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/registro"
                className="inline-block rounded-lg border border-slate-300 bg-white px-12 py-4 text-slate-800 font-semibold hover:bg-slate-50 transition"
              >
                Crear cuenta
              </Link>
            </div>
          </div>

          {/* Right (misma imagen del original) */}
          <div className="flex justify-end items-center pr-4 lg:pr-0">
            <img
              id="heroImg1"
              className="transition-all duration-300 ease-in-out rounded-lg hover:scale-105 object-contain h-full max-h-[480px] w-full"
              src="./images/IMGHome.png"
              alt="Ilustración de Turnate"
              draggable="false"
            />
          </div>
        </section>

        {/* Beneficios (contenido del otro home, pero con el look del original) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Calendario intuitivo" text="Vista por día, semana o mes. Arrastrá, editá y reordená." />
          <Card title="Servicios y horarios" text="Duraciones y bloques por día para evitar superposiciones." />
          <Card title="Reservas con código" text="Compartí tu código y recibí turnos sin atender el chat." />
        </section>

        {/* CTA secundaria (contenido del otro home, estética del original) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
                Empezá gratis y activá tu plan cuando quieras
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Probá Turnate hoy y pasá a Emprendedor cuando lo necesites.
              </p>
            </div>
           
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
      <h3 className="text-slate-900 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}
