// src/components/Footer.jsx
import { Link } from "react-router-dom";
import { useUser } from "../context/UserContext";
const LOGO_SRC = "/images/TurnateLogo.png";
export default function Footer() {
  const { token, user } = useUser() || {};
  const year = new Date().getFullYear();
  const isAdmin = String(user?.rol || "").toLowerCase() === "admin";

  return (
    <footer className="bg-slate-950 text-slate-300">
      {/* franja superior con gradiente */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
          {/* Marca */}
          <div>
            <Link to="/" className="flex items-center gap-3">
                      <img
                        src={LOGO_SRC}
                        alt="Turnate"
                        className="h-11 w-auto select-none"
                        
                      />
                      <span className="font-extrabold text-2xl text-white tracking-tight">Turnate</span>
                    </Link>

            <p className="mt-2 text-sm text-slate-400">
              Agenda online sencilla para emprendedores y clientes.
            </p>
          </div>

          {/* Navegación */}
          <nav aria-label="Navegación" className="sm:ml-4">
            <h3 className="text-white font-semibold">Navegación</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li><Link to="/" className="hover:text-white">Inicio</Link></li>
              <li><Link to="/nosotros" className="hover:text-white">Nosotros</Link></li>
              
              {token && (
                <>
                  <li><Link to="/perfil" className="hover:text-white">Panel</Link></li>
                  <li><Link to="/turnos" className="hover:text-white">Turnos</Link></li>
                  {isAdmin && (
                    <li><Link to="/admin" className="hover:text-white">Reportes</Link></li>
                  )}
                </>
              )}
            </ul>
          </nav>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold">Legal</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li><Link to="/terminos" className="hover:text-white">Términos y Condiciones</Link></li>
              <li><Link to="/privacidad" className="hover:text-white">Política de Privacidad</Link></li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-white font-semibold">Contacto</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li>
                <a
                  href="mailto:contactoturnate@gmail.com"
                  className="hover:text-white"
                >
                  contactoturnate@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/543644609497"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  WhatsApp: +54 3644 609497
                </a>
                <span className="ml-1 text-slate-500">Turnate</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copy */}
        <div className="mt-8 border-t border-slate-800/70 pt-4 text-center text-xs text-slate-500">
          © {year} Turnate. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
