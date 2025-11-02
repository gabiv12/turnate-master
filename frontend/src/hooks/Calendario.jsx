// src/hooks/Calendario.jsx
import { Calendar, Views, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse as dfParse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from "date-fns";
import es from "date-fns/locale/es";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse: (dateString, fmt, referenceDate) => dfParse(dateString, fmt, referenceDate, { locale: es }),
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
  const events = (turnos || []).map((e) => ({
    ...e,
    start: e.start instanceof Date ? e.start : new Date(e.start),
    end: e.end instanceof Date ? e.end : new Date(e.end),
  }));

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

  const handleRangeChange = (range, view) => {
    if (!onRangeRequest) return;
    const currentDate = Array.isArray(range) && range.length ? range[Math.floor(range.length / 2)] : new Date();
    const { start, end } = normalizeRange(range, view, currentDate);
    onRangeRequest(start, end, view);
  };

  const handleNavigate = (date, view) => {
    if (!onRangeRequest) return;
    const { start, end } = normalizeRange(null, view, date);
    onRangeRequest(start, end, view);
  };

  const handleView = (view) => {
    if (!onRangeRequest) return;
    const { start, end } = normalizeRange(null, view, new Date());
    onRangeRequest(start, end, view);
  };

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl">
      <Calendar
        localizer={localizer}
        culture="es"
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView={defaultView}
        defaultDate={defaultDate}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        popup
        selectable
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        messages={messages}
        dayPropGetter={dayPropGetter}
        onRangeChange={handleRangeChange}
        onNavigate={handleNavigate}
        onView={handleView}
      />
    </div>
  );
}
