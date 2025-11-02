// src/components/Button.jsx
import React from "react";

export default function Button({ children, onClick, type = "button", className = "", disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-xl px-4 py-2 font-semibold text-white shadow-sm",
        "bg-gradient-to-r from-sky-600 to-cyan-500",
        "hover:from-sky-700 hover:to-cyan-600 active:scale-[.99]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "transition-all duration-150 ease-in-out",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
