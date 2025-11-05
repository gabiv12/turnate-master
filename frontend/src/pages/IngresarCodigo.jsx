import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";

const BOX = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-sky-300";
const BTN = "rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60";

export default function IngresarCodigo() {
  const nav = useNavigate();
  const { user } = useUser() || {};
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) {
      nav("/login?next=/reservar", { replace: true });
    }
  }, [user, nav]);

  const onSubmit = (e) => {
    e.preventDefault();
    const c = (code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(c)) {
      setMsg("Ingresá un código válido (6–12 caracteres alfanuméricos).");
      setTimeout(() => setMsg(""), 2500);
      return;
    }
    nav(`/reservar/${c}`);
  };

  return (
    <div className="space-y-5">
      <div className="-ml-4 lg:-mx-6 overflow-x-clip">
        <div className="bg-blue-600 p-6 text-white shadow">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Reservar por código</h1>
            <p className="text-sm md:text-base/relaxed opacity-90 mt-1">
              Ingresá el código que te compartió el emprendimiento para ver su agenda y sacar turno.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {msg && <div className="mb-3 rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 ring-1 ring-rose-200">{msg}</div>}
        <label className="block text-xs font-semibold text-sky-700 mb-1">Código del emprendimiento</label>
        <div className="flex gap-2">
          <input
            className={BOX}
            placeholder="Ej: 8GPWJXVG"
            value={code}
            onChange={(e)=>setCode(e.target.value)}
            autoFocus
          />
          <button type="submit" className={BTN}>Buscar</button>
        </div>

        <ul className="mt-3 text-xs text-slate-500 space-y-1.5">
          <li>• Encontrás el código en el link que te enviaron (termina en <code className="font-mono">/reservar/CODIGO</code>).</li>
          <li>• Si no lo tenés, pedíselo al emprendimiento.</li>
          <li>• El código puede cambiar si el dueño lo regenera.</li>
        </ul>
      </form>
    </div>
  );
}
