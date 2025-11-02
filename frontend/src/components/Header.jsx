// src/components/Header.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { getAuthToken, clearAuthToken } from "../services/api";
import { logout as authLogout } from "../services/auth";

const LOGO_SRC = "/images/TurnateLogo.png";

const linkBase = "px-5 py-2.5 rounded-full text-base font-medium transition-colors duration-150";
const navClass = ({ isActive }) =>
  isActive
    ? `${linkBase} bg-white text-blue-700 shadow`
    : `${linkBase} text-white/90 hover:text-white bg-white/0 hover:bg-white/10`;

function Icon({ name, className = "w-4 h-4" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "reservar":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M4 7h16v4a2 2 0 0 1 0 2v4H4v-4a2 2 0 0 1 0-2V7z" />
          <path d="M8 7v10M16 7v10" />
        </svg>
      );
    case "turnos":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "perfil":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M20 21a8 8 0 1 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "emprendimiento":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

// ---- Helpers de lógica (no cambian el diseño) ----
function normalizeRoles(rolesAny, rolCompat) {
  const out = new Set();
  if (Array.isArray(rolesAny)) {
    for (const r of rolesAny) {
      if (typeof r === "string" && r) out.add(r.toLowerCase());
      else if (r && typeof r === "object" && r.nombre) out.add(String(r.nombre).toLowerCase());
    }
  }
  if (rolCompat) out.add(String(rolCompat).toLowerCase());
  return Array.from(out);
}

export default function Header() {
  // Del contexto tomamos solo lo que realmente existe
  const { user, setUser, isAuthenticated, isEmprendedor, refreshMe } = useUser() || {};
  const [openAvatarMenu, setOpenAvatarMenu] = useState(false);

  const avatarBtnRef = useRef(null);
  const avatarMenuRef = useRef(null);
  const navigate = useNavigate();

  // Si hay token persistido pero aún no hay user en memoria, hidratamos /me
  useEffect(() => {
    const t = getAuthToken();
    if (t && !user) {
      // no bloquea la UI; cuando resuelva, Header re-renderiza
      refreshMe?.();
    }
  }, [user, refreshMe]);

  // isAuth verdadero si el contexto dice autenticado o si al menos hay token guardado
  const isAuth = !!isAuthenticated || !!getAuthToken();

  // Roles (compatibilidad con estructuras antiguas)
  const roles = normalizeRoles(user?.roles, user?.rol);
  const isAdmin = roles.includes("admin") || (!!user && Number(user.id) === 1);
  // isEmprendedor ya viene del contexto; mantenemos compat por si user trae flags antiguos:
  const isEmp = isEmprendedor || !!(user?.es_emprendedor || user?.is_emprendedor);

  useEffect(() => {
    const onDoc = (e) => {
      if (
        openAvatarMenu &&
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(e.target) &&
        avatarBtnRef.current &&
        !avatarBtnRef.current.contains(e.target)
      ) {
        setOpenAvatarMenu(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpenAvatarMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openAvatarMenu]);

  const handleLogout = () => {
    try { authLogout(); } catch {}
    try {
      clearAuthToken();
      // limpieza de llaves viejas por compat
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
    } catch {}
    setUser?.(null);
    setOpenAvatarMenu(false);
    navigate("/login", { replace: true });
  };

  const displayName = user?.nombre || user?.username || user?.email || "Usuario";
  const initial = (displayName?.[0] || "U").toUpperCase();

  return (
    <header className="bg-gradient-to-r from-blue-600 to-cyan-400 shadow-lg fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-4 md:py-5 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src={LOGO_SRC}
            alt="Turnate"
            className="h-11 w-auto select-none"
            draggable="false"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <span className="font-extrabold text-2xl text-white tracking-tight">Turnate</span>
        </Link>

        {/* Navegación principal (mismo markup/clases) */}
        <nav className="flex items-center gap-3">
          <NavLink to="/" end className={navClass}>Inicio</NavLink>
          <NavLink to="/nosotros" end className={navClass}>Nosotros</NavLink>

          {/* Reportes solo Admin */}
          {isAuth && isAdmin && (
            <NavLink to="/admin" end className={navClass}>Reportes</NavLink>
          )}

          {!isAuth ? (
            <>
              <NavLink to="/login" end className={navClass}>Iniciar sesión</NavLink>
              <NavLink to="/registro" end className={navClass}>Registrarse</NavLink>
            </>
          ) : (
            <div className="relative ml-2">
              <button
                ref={avatarBtnRef}
                onClick={() => setOpenAvatarMenu((s) => !s)}
                className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                aria-haspopup="menu"
                aria-expanded={openAvatarMenu}
                title="Menú de usuario"
              >
                <div className="w-10 h-10 grid place-items-center rounded-full text-white font-semibold border border-white/50 bg-white/10 backdrop-blur-sm">
                  {initial}
                </div>
              </button>

              {openAvatarMenu && (
                <div
                  ref={avatarMenuRef}
                  className="absolute right-0 mt-3 w-72 rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden origin-top-right animate-[menuIn_120ms_ease-out]"
                  role="menu"
                  style={{ transformOrigin: "top right" }}
                >
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Sesión iniciada</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                            Administrador
                          </span>
                        ) : isEmp ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                            Emprendedor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-[2px] rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                            Cliente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ul className="py-1 text-sm">
                    <li>
                      <NavLink to="/reservar" end className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50" onClick={() => setOpenAvatarMenu(false)}>
                        <Icon name="reservar" />
                        <span>Reservar</span>
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/turnos" end className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50" onClick={() => setOpenAvatarMenu(false)}>
                        <Icon name="turnos" />
                        <span>Turnos</span>
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/perfil" end className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50" onClick={() => setOpenAvatarMenu(false)}>
                        <Icon name="perfil" />
                        <span>Perfil</span>
                      </NavLink>
                    </li>
                    {isEmp && (
                      <li>
                        <NavLink to="/emprendimiento" end className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50" onClick={() => setOpenAvatarMenu(false)}>
                          <Icon name="emprendimiento" />
                          <span>Emprendimiento</span>
                        </NavLink>
                      </li>
                    )}
                    <li className="my-1 border-t" />
                    <li>
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-left text-rose-600" onClick={handleLogout}>
                        <Icon name="logout" />
                        <span>Cerrar sesión</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      <style>{`
        @keyframes menuIn {
          0% { opacity: 0; transform: translateY(-4px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
}
