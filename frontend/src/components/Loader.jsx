import React from "react";

export default function Loader({ text = "Cargando..." }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="relative w-12 h-12 mb-3">
        <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-blue-500 animate-spin"></div>
      </div>
      <p className="text-slate-700 font-medium">{text}</p>
    </div>
  );
}
