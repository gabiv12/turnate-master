import React from "react";

export default function Button({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        // forma y espaciado
        "inline-flex items-center justify-center rounded-full px-6 py-2.5 font-medium",
        // colores base (pastilla blanca con texto azul)
        "bg-white text-blue-700 shadow-sm",
        // borde y fondo sutil
        "border border-blue-200",
        // efectos de interacción
        "hover:bg-blue-50 hover:shadow transition-all duration-150 ease-in-out",
        "active:scale-[.98] active:shadow-inner",
        // estado deshabilitado
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
