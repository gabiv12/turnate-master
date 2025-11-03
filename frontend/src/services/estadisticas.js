import React, { useState, useRef } from "react";
import Typewriter from "typewriter-effect";

export default function Home() {
  // Imagen principal (la “otra” con texto). Fallbacks si no existe.
  const [heroSrc, setHeroSrc] = useState("/images/Turnate (1).png");
  const handleHeroError = () => {
    if (heroSrc === "/images/Turnate (1).png") return setHeroSrc("/images/ImagenHome.png");
    // Último fallback: ocultar
    const el = document.getElementById("home-hero-img");
    if (el) el.style.display = "none";
  };

  // Imagen original (pixelada) EN CHICO como badge decorativo
  const [badgeSrc, setBadgeSrc] = useState("./images/IMGHome.png");
  const handleBadgeError = () => {
    // Si la original no existe, ocultar el badge
    const el = document.getElementById("home-badge-img");
    if (el) el.style.display = "none";
  };

  return (
    <main className="pt-20 md:pt-24 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-11/12 mx-auto min-h-[calc(100vh-7rem)] items-center md:py-6 lg:py-10 xl:py-8 lg:mt-0">
        {/* Left Section */}
        <div className="flex flex-col justify-center pl-1 lg:pl-0">
          <h1 className="text-3xl xl:text-4xl lg:text-3xl mb-6 font-semibold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent">
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

          <p className="mt-2 text-base md:text-lg text-gray-500 md:leading-relaxed">
            Para quienes buscan atención profesional, y para emprendedores que quieren administrar sus agendas fácilmente.
            Nuestra plataforma conecta a clientes con expertos, facilitando la organización y el crecimiento de tu negocio.
            <br />
            Reservá tu turno o administrá tu calendario con la confianza de estar en manos de profesionales.
          </p>

          <div className="mt-6">
            {/* Exige login en vez de buscar por código */}
            <a
              href="/login"
              className="inline-block bg-gradient-to-r from-blue-600 to-cyan-400 shadow-lg text-white rounded-lg px-10 py-3 hover:scale-[1.03] hover:from-cyan-400 hover:to-blue-600 transition duration-200 ease-in-out"
            >
              Reservar Turnos
            </a>
          </div>
        </div>

        {/* Right Section: Hero + Badge (la original en chico) */}
        <div className="relative flex justify-end items-center pr-1 lg:pr-0">
          {/* Imagen principal (limpia) */}
          <img
            id="home-hero-img"
            className="transition-all duration-300 ease-in-out rounded-2xl hover:scale-[1.02] object-cover h-[280px] sm:h-[340px] md:h-[380px] lg:h-[420px] w-full"
            src={heroSrc}
            alt="Ilustración principal de Turnate"
            onError={handleHeroError}
            draggable="false"
          />

          {/* Badge: imagen original pixelada, más chica y decorativa */}
          <img
            id="home-badge-img"
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 rounded-xl border border-slate-200 shadow-md object-contain bg-white/70
                       w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 p-2 backdrop-blur"
            src={badgeSrc}
            alt="Imagen original"
            onError={handleBadgeError}
            draggable="false"
            aria-hidden="true"
          />
        </div>
      </div>
    </main>
  );
}
