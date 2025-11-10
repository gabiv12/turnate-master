// src/components/Calendario.jsx
import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import {
  format as dfFormat,
  parse as dfParse,
  startOfWeek as dfStartOfWeek,
  getDay as dfGetDay,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

// Localizer con date-fns + español
const locales = { es };
const localizer = dateFnsLocalizer({
  format: (date, fmt, options) => dfFormat(date, fmt, { ...options, locale: es }),
  parse: (value, fmt, baseDate, options) =>
    dfParse(value, fmt, baseDate, { ...options, locale: es }),
  startOfWeek: (date, options) => dfStartOfWeek(date, { ...options, locale: es }),
  getDay: dfGetDay,
  locales,
});

// Traducciones de la UI del calendario
const messagesES = {
  date: "Fecha",
  time: "Hora",
  event: "Turno",
  allDay: "Todo el día",
  week: "Semana",
  work_week: "Laboral",
  day: "Día",
  month: "Mes",
  previous: "Anterior",
  next: "Siguiente",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  today: "Hoy",
  agenda: "Agenda",
  noEventsInRange: "No hay turnos en este rango.",
  showMore: (total) => `+ Ver ${total} más`,
};

export default function Calendario({
  // datos
  turnos = [], // [{title, start: Date, end: Date, ...}]
  // callbacks
  onSelectEvent,
  onSelectSlot,
  onRangeChange,
  onRangeRequest, // puente opcional para pedir al backend un rango
  // opciones visuales
  defaultView = "month",
  height = 700,
  eventPropGetter,
  dayPropGetter,
}) {
  // Aseguramos que los eventos tengan Date válidas
  const events = useMemo(() => {
    return (turnos || [])
      .map((e) => ({
        ...e,
        start: e.start instanceof Date ? e.start : new Date(e.start),
        end: e.end instanceof Date ? e.end : new Date(e.end),
      }))
      .filter((e) => !isNaN(+e.start) && !isNaN(+e.end));
  }, [turnos]);

  // Bridge RBC → onRangeRequest(start, end)
  const handleRangeChange = (range) => {
    onRangeChange?.(range);
    if (!onRangeRequest) return;
    if (Array.isArray(range)) {
      const start = range[0];
      const end = range[range.length - 1];
      onRangeRequest(start, end);
    } else if (range?.start && range?.end) {
      onRangeRequest(range.start, range.end);
    }
  };

  // Colores suaves por estado (si no te pasan eventPropGetter)
  const defaultEventPropGetter = (event) => {
    const estado = String(event?.estado || "").toLowerCase();
    let style = {};
    if (estado.includes("cancel")) style = { backgroundColor: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" };
    else if (estado.includes("confirm") || estado.includes("ok")) style = { backgroundColor: "#dcfce7", borderColor: "#bbf7d0", color: "#065f46" };
    else style = { backgroundColor: "#e0f2fe", borderColor: "#bae6fd", color: "#075985" };
    return { style, className: "rounded-md" };
  };

  return (
    <div className="w-full" style={{ height }}>
      <Calendar
        localizer={localizer}
        culture="es"
        messages={messagesES}
        defaultView={defaultView}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        events={events}
        startAccessor="start"
        endAccessor="end"
        popup
        selectable
        longPressThreshold={220}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        onRangeChange={handleRangeChange}
        eventPropGetter={eventPropGetter || defaultEventPropGetter}
        dayPropGetter={dayPropGetter}
        toolbar
        step={30}
        timeslots={2}
        formats={{
          timeGutterFormat: (date) => dfFormat(date, "HH:mm", { locale: es }),
          eventTimeRangeFormat: ({ start, end }) =>
            `${dfFormat(start, "HH:mm", { locale: es })} – ${dfFormat(end, "HH:mm", { locale: es })}`,
          agendaTimeRangeFormat: ({ start, end }) =>
            `${dfFormat(start, "HH:mm", { locale: es })} – ${dfFormat(end, "HH:mm", { locale: es })}`,
        }}
      />
    </div>
  );
}
