import { Calendar, Views, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  format,
  parse as dfParse,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  getDay,
} from "date-fns";
import es from "date-fns/locale/es";
import { useMemo, useRef, useState } from "react";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse: (dateString, fmt, referenceDate) =>
    dfParse(dateString, fmt, referenceDate, { locale: es }),
  startOfWeek: (d) => startOfWeek(d, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const messages = {
  today: "Hoy",
  next: "Siguiente",
  previous: "Anterior",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "No hay turnos en el rango seleccionado.",
  showMore: (total) => `+${total} más`,
};

/* -------- Helpers de rango ---------- */
function normalizeRange(range, view, currentDate) {
  if (Array.isArray(range) && range.length) {
    const start = new Date(range[0]);
    const end = new Date(range[range.length - 1]);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range?.start && range?.end) {
    const start = new Date(range.start);
    const end = new Date(range.end);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return { start, end };
  }
  if (view === Views.MONTH) {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (view === Views.WEEK) {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(currentDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/* -------- Toolbar propio (evita “botón apretado”) ---------- */
function Toolbar({ label, onNavigate, onView, activeView }) {
  const monthBtn = useRef(null);
  const weekBtn = useRef(null);
  const dayBtn = useRef(null);
  const agendaBtn = useRef(null);

  const clickView = (view, ref) => {
    onView(view);
    // Evita que quede “apretado”/focado
    if (ref?.current) ref.current.blur();
  };

  const btnBase =
    "px-3 py-1.5 rounded-lg text-sm font-medium border transition";
  const active = "bg-sky-600 text-white border-sky-600";
  const idle =
    "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-2 pb-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate("PREV")}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50"
        >
          {messages.previous}
        </button>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <button
          type="button"
          onClick={() => onNavigate("NEXT")}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50"
        >
          {messages.next}
        </button>
        <button
          type="button"
          onClick={() => onNavigate("TODAY")}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 ml-2"
        >
          {messages.today}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          ref={monthBtn}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => clickView(Views.MONTH, monthBtn)}
          className={`${btnBase} ${
            activeView === Views.MONTH ? active : idle
          }`}
        >
          {messages.month}
        </button>
        <button
          ref={weekBtn}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => clickView(Views.WEEK, weekBtn)}
          className={`${btnBase} ${
            activeView === Views.WEEK ? active : idle
          }`}
        >
          {messages.week}
        </button>
        <button
          ref={dayBtn}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => clickView(Views.DAY, dayBtn)}
          className={`${btnBase} ${
            activeView === Views.DAY ? active : idle
          }`}
        >
          {messages.day}
        </button>
        <button
          ref={agendaBtn}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => clickView(Views.AGENDA, agendaBtn)}
          className={`${btnBase} ${
            activeView === Views.AGENDA ? active : idle
          }`}
        >
          {messages.agenda}
        </button>
      </div>
    </div>
  );
}

export default function Calendario({
  turnos = [],
  onSelectEvent = () => {},
  onSelectSlot = () => {},
  defaultView = "month",
  defaultDate = new Date(),
  height = 720,
  dayPropGetter,
  onRangeRequest,
}) {
  const [currentView, setCurrentView] = useState(
    typeof defaultView === "string" ? defaultView : Views.MONTH
  );
  const [currentDate, setCurrentDate] = useState(defaultDate);

  const events = useMemo(
    () =>
      (turnos || []).map((e) => ({
        ...e,
        start: e.start instanceof Date ? e.start : new Date(e.start),
        end: e.end instanceof Date ? e.end : new Date(e.end),
      })),
    [turnos]
  );

  const doRangeRequest = (view, dateOrRange) => {
    if (!onRangeRequest) return;
    const mid =
      Array.isArray(dateOrRange) && dateOrRange.length
        ? dateOrRange[Math.floor(dateOrRange.length / 2)]
        : currentDate;
    const { start, end } = normalizeRange(dateOrRange, view, mid);
    onRangeRequest(start, end, view);
  };

  const handleRangeChange = (range) => doRangeRequest(currentView, range);

  const handleNavigate = (action) => {
    let next = new Date(currentDate);
    if (action === "TODAY") next = new Date();
    if (action === "NEXT") {
      if (currentView === Views.MONTH) next.setMonth(next.getMonth() + 1);
      else if (currentView === Views.WEEK) next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 1);
    }
    if (action === "PREV") {
      if (currentView === Views.MONTH) next.setMonth(next.getMonth() - 1);
      else if (currentView === Views.WEEK) next.setDate(next.getDate() - 7);
      else next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
    doRangeRequest(currentView, null);
  };

  const handleView = (view) => {
    setCurrentView(view);
    doRangeRequest(view, null);
  };

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl">
      <Calendar
        localizer={localizer}
        culture="es"
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={currentView}
        onView={handleView}
        date={currentDate}
        onNavigate={(_, __, action) => handleNavigate(action)}
        defaultDate={defaultDate}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        popup
        selectable
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        messages={messages}
        dayPropGetter={dayPropGetter}
        onRangeChange={handleRangeChange}
        components={{
          toolbar: (props) => (
            <Toolbar
              label={props.label}
              onNavigate={props.onNavigate}
              onView={handleView}
              activeView={currentView}
            />
          ),
        }}
      />
    </div>
  );
}
