// src/layouts/PanelShell.jsx
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import { isEmprendedor as empCheck, isAdmin as adminCheck } from "../utils/roles";

const ItemLink = ({ to, children }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      [
        "block w-full text-left rounded-xl px-4 py-3 text-sm font-semibold transition shadow-sm",
        isActive ? "bg-white text-sky-700" : "bg-white/10 text-white hover:bg-white",
      ].join(" ")
    }
  >
    {children}
  </NavLink>
);

export default function PanelShell() {
  const ctx = useUser() || {};
  const user = ctx.user || null;
  const refreshUser = ctx.refreshUser || (() => {});
  const logout = ctx.logout || (() => {});
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [isEmp, setIsEmp] = useState(empCheck(user));
  const [isAdm, setIsAdm] = useState(adminCheck(user));

  useEffect(() => {
    setIsEmp(empCheck(user));
    setIsAdm(adminCheck(user));
  }, [user]);

  // 🚫 Evita doble fetch si algo re-monta el layout
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // <div className="min-h-screen bg-gradient-to-b from-blue-600 to-cyan-400">
    <div className="min-h-screen bg-slate-100 ">

      <Header />

      <div className="pt-24">
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
            <aside className="lg:sticky lg:top-[88px] self-start">
              <div className="lg:hidden mb-3">
                <button 
                  onClick={() => setOpen((s) => !s)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {open ? "Ocultar panel" : "Mostrar panel"}
                </button>
              </div>

              <div
                className={[
                  // "rounded-3xl rounded-tr-none p-[10px] overflow-hidden",
                  // "bg-gradient-to-b from-blue-700 to-cyan-500",
                  "bg-blue-600 h-screen",

                  open ? "block" : "hidden lg:block",
                ].join(" ")}
              >
                <div className="rounded-2xl bg-transparent p-4">
                  <div className="mb-3">
                    <div className="text-white/90 text-sm font-semibold">Panel</div>
                    <div className="text-white/80 text-xs">Herramientas rápidas</div>
                  </div>

                  <div className="space-y-3 mt-8">
                    <ItemLink to="/reservar">Reservar</ItemLink>
                    <ItemLink to="/perfil">Editar Perfil</ItemLink>
                    <ItemLink to="/emprendimiento">Emprendimiento</ItemLink>
                    <ItemLink to="/turnos">Turnos</ItemLink>
                    {isAdm && <ItemLink to="/admin">Admin</ItemLink>}
                    <ItemLink to="/estadisticas">Estadísticas</ItemLink>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => {
                        logout();
                        navigate("/login", { replace: true });
                      }}
                      className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-rose-600 to-red-500 shadow hover:brightness-110"
                    >
                      Cerrar sesión
                    </button>
                  </div>

                </div>
              </div>
            </aside>

            {/* ✅ alto mínimo para que no “se coma” el Footer */}
            <section className="min-h-[60vh] min-w-0 bg-white/0">
              <Outlet />
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
