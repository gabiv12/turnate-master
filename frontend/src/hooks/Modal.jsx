// src/components/Modal.jsx
import React from "react";

export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="w-[min(680px,92vw)] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full bg-white/15 px-3 py-1 text-sm hover:bg-white/25"
              aria-label="Cerrar"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="p-5">{children}</div>

        {footer && <div className="px-5 pb-5">{footer}</div>}
      </div>
    </div>
  );
}
