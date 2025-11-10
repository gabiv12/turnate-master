// src/pages/IngresarCodigo.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { apiListEmprendedores, apiListRubros } from "../services/api.js";

/* ===== Estilos base (alineados con Reservar) ===== */
const BOX = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-sky-300";
const BTN = "rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow hover:brightness-110 disabled:opacity-60";
const cx = (...c) => c.filter(Boolean).join(" ");

/* ===== Overlay premium (igual estilo que en Reservar, azul metalizado) ===== */
function StatusOverlay({ show, mode = "loading", title, caption, onClose }) {
  if (!show) return null;
  const isOK = mode === "success";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div
          className={cx(
            "mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full",
            isOK ? "bg-sky-50" : "bg-slate-100"
          )}
        >
          {isOK ? (
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-sky-700">
              <path
                fill="currentColor"
                d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm4.7-12.7a1 1 0 0 0-1.4-1.4L11 12.2l-2.3-2.3a1 1 0 1 0-1.4 1.4l3 3a1 1 0 0 0 1.4 0l5-5Z"
              />
            </svg>
          ) : (
            <svg className="h-7 w-7 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" className="opacity-80" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {caption && <p className="mt-1 text-sm text-slate-600">{caption}</p>}
        {isOK && (
          <button
            onClick={onClose}
            className="mt-4 rounded-xl bg-sky-700 text-white px-4 py-2 text-sm font-semibold shadow hover:brightness-110"
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== Helpers ===== */
const looksLikeCode = (s) => /^[A-Z0-9]{6,12}$/.test(String(s).trim().toUpperCase());
const short = (text, max = 110) => {
  const s = String(text || "").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};

const PAGE_SIZE = 20;

export default function IngresarCodigo() {
  const nav = useNavigate();
  const { user } = useUser() || {};

  // Form por código (mantiene tu validación)
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  // Buscador por rubro/nombre
  const [rubros, setRubros] = useState([]);
  const [rubro, setRubro] = useState("");
  const [q, setQ] = useState("");

  // Listado y estado UI
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Overlay premium
  const [overlay, setOverlay] = useState({ show: false, mode: "loading", title: "", caption: "" });

  // debounce
  const debounceRef = useRef(null);

  /* Redirección si no hay user (igual que tu versión anterior) */
  useEffect(() => {
    if (!user) {
      nav("/login?next=/reservar", { replace: true });
    }
  }, [user, nav]);

  /* Carga rubros al entrar */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setOverlay({ show: true, mode: "loading", title: "Cargando…", caption: "Preparando opciones" });
        const r = await apiListRubros();
        if (!mounted) return;
        setRubros(r || []);
      } catch {
        /* noop */
      } finally {
        setTimeout(() => setOverlay((o) => ({ ...o, show: false })), 300);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* Fetch paginado */
  const fetchPage = async (pageToLoad, append) => {
    setLoading(true);
    try {
      const data = await apiListEmprendedores({
        q: q?.trim() || undefined,
        rubro: rubro || undefined,
        limit: PAGE_SIZE,
        offset: pageToLoad * PAGE_SIZE,
      });
      const arr = Array.isArray(data) ? data : [];
      setList((prev) => (append ? [...prev, ...arr] : arr));
      setHasMore(arr.length === PAGE_SIZE); // hay más si llegaron PAGE_SIZE
      setPage(pageToLoad);
    } catch (e) {
      if (!append) setList([]);
      setHasMore(false);
      setOverlay({
        show: true,
        mode: "success",
        title: "No se pudo cargar el listado",
        caption: "Reintentá en unos segundos.",
      });
      setTimeout(() => setOverlay((o) => ({ ...o, show: false })), 1800);
    } finally {
      setLoading(false);
    }
  };

  /* Buscar en tiempo real con debounce; reinicia paginación */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage(0, false);
    }, 250);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rubro]);

  /* Submit por código → /reservar/:codigo */
  const onSubmit = (e) => {
    e.preventDefault();
    const c = (code || "").trim().toUpperCase();
    if (!looksLikeCode(c)) {
      setMsg("Ingresá un código válido (6–12 caracteres alfanuméricos).");
      setTimeout(() => setMsg(""), 2800);
      return;
    }
    nav(`/reservar/${c}`);
  };

  /* Click en tarjeta → agenda por código */
  const goTo = (codigo) => {
    const c = String(codigo || "").trim().toUpperCase();
    if (!looksLikeCode(c)) {
      setOverlay({
        show: true,
        mode: "success",
        title: "Código no disponible",
        caption: "Este emprendimiento aún no tiene código público.",
      });
      setTimeout(() => setOverlay((o) => ({ ...o, show: false })), 1500);
      return;
    }
    nav(`/reservar/${c}`);
  };

  /* Estado vacío */
  const emptyState = !loading && list.length === 0;

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col">
      <StatusOverlay
        show={overlay.show}
        mode={overlay.mode}
        title={overlay.title}
        caption={overlay.caption}
        onClose={() => setOverlay((o) => ({ ...o, show: false }))}
      />

      {/* Header premium */}
      <header className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow">
        <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 py-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Reservar por código</h1>
          <p className="text-sm md:text-base/relaxed text-white/90 mt-1">
            Ingresá el código que te compartió el emprendimiento o buscá por rubro y nombre.
          </p>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-7xl px-4 lg:px-6 py-6 space-y-6">
        {/* Bloque: Buscar por código */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {msg && (
            <div className="mb-3 rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 ring-1 ring-rose-200">
              {msg}
            </div>
          )}
          <label className="block text-sm font-semibold text-sky-700 mb-2 ml-[1px]">
            Código del emprendimiento
          </label>
          <form onSubmit={onSubmit} className="flex gap-2 flex-col sm:flex-row">
            <input
              className={BOX}
              placeholder="Ej: 8GPWJXVG"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              inputMode="latin"
              maxLength={12}
            />
            <button type="submit" className={BTN} disabled={!looksLikeCode(code)}>
              Buscar
            </button>
          </form>
          <ul className="mt-3 text-xs text-slate-500 space-y-1.5">
            <li>• El código está en el link que te compartieron (termina en <code className="font-mono">/reservar/CODIGO</code>).</li>
            <li>• Si no lo tenés, pedíselo al emprendimiento.</li>
            <li>• El código puede cambiar si el dueño lo regenera.</li>
          </ul>
        </section>

        {/* Bloque: Filtros + listado (paginado) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-800 mb-1">Rubro</label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="">Todos los rubros</option>
                {rubros.map((r) => (
                  <option key={r.rubro} value={r.rubro}>
                    {r.rubro}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-[2]">
              <label className="block text-sm font-semibold text-slate-800 mb-1">Buscar por nombre o rubro</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej.: Barbería, Uñas, Estética…"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="md:w-56">
              <label className="block text-sm font-semibold text-slate-800 mb-1">Estado</label>
              <div className={cx(
                "h-[42px] grid place-items-center rounded-xl border px-3 text-sm",
                loading ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600"
              )}>
                {loading ? "Buscando…" : "Explorá emprendimientos"}
              </div>
            </div>
          </div>

          {/* Grid de tarjetas (clickable, sin botón) */}
          <div className="mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading && list.length === 0 && Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse"
              >
                <div className="h-10 w-10 rounded-xl bg-slate-200" />
                <div className="mt-3 h-4 w-2/3 bg-slate-200 rounded" />
                <div className="mt-2 h-3 w-1/3 bg-slate-100 rounded" />
                <div className="mt-3 h-12 w-full bg-slate-100 rounded" />
                <div className="mt-3 h-9 w-1/2 bg-slate-200 rounded" />
              </div>
            ))}

            {!loading && list.map((e) => (
              <article
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => goTo(e.codigo_cliente)}
                onKeyDown={(ev) => (ev.key === "Enter" ? goTo(e.codigo_cliente) : null)}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-sky-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={e.logo_url || "/images/TurnateLogo.png"}
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 bg-white"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-sky-700 transition-colors">
                      {e.nombre || "Emprendimiento"}
                    </h3>
                    {e.rubro && (
                      <div className="text-xs font-medium text-slate-500">{e.rubro}</div>
                    )}
                  </div>
                </div>

                {e.descripcion && (
                  <p className="mt-3 text-sm text-slate-600">{short(e.descripcion)}</p>
                )}
              </article>
            ))}
          </div>

        {/* Paginación: mostrar si hay más resultados */}
          {(hasMore || (loading && list.length > 0)) && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => fetchPage(page + 1, true)}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? "Cargando…" : "Cargar más"}
              </button>
            </div>
          )}

          {emptyState && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              No encontramos resultados con esos filtros. Probá con otro rubro o nombre.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
