# backend/app/crud/horarios.py
from __future__ import annotations

from datetime import datetime, timedelta, time
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Horario, Turno

def _weekday(dt: datetime) -> int:
    # Python: Monday=0..Sunday=6 (coincide con nuestro contrato)
    return dt.weekday()

def generar_slots(db: Session, emprendedor_id: int, desde: datetime, hasta: datetime) -> List[datetime]:
    """
    Genera posibles inicios de turno en la grilla definida por Horario.
    No filtra por duración de servicios (grid puro).
    """
    # indexar horarios por día
    horarios = db.scalars(
        select(Horario).where(Horario.emprendedor_id == emprendedor_id)
    ).all()
    por_dia = {}
    for h in horarios:
        por_dia.setdefault(h.dia_semana, []).append(h)

    slots: List[datetime] = []
    cur = desde
    # Iterar por días
    while cur <= hasta:
        d = _weekday(cur)
        if d in por_dia:
            for h in por_dia[d]:
                # construir timeline del día actual
                start_dt = cur.replace(hour=h.hora_desde.hour, minute=h.hora_desde.minute, second=0, microsecond=0)
                end_dt = cur.replace(hour=h.hora_hasta.hour, minute=h.hora_hasta.minute, second=0, microsecond=0)
                step = timedelta(minutes=h.intervalo_min)
                t = start_dt
                while t + step <= end_dt + timedelta(seconds=1):  # permitir borde
                    if t >= desde and t <= hasta:
                        slots.append(t)
                    t += step
        cur = (cur + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    # ordenar
    slots.sort()
    return slots

def hay_superposicion(db: Session, emprendedor_id: int, inicio: datetime, fin: datetime, excluir_turno_id: int | None = None) -> bool:
    q = select(Turno).where(
        Turno.emprendedor_id == emprendedor_id,
        Turno.estado != "cancelado",
        # [inicio, fin) se solapa si: inicio < fin_existente y fin > inicio_existente
        Turno.inicio < fin,
        Turno.fin > inicio,
    )
    if excluir_turno_id is not None:
        q = q.where(Turno.id != excluir_turno_id)
    return db.scalar(q.limit(1)) is not None

def dentro_de_horario(db: Session, emprendedor_id: int, inicio: datetime, fin: datetime) -> bool:
    """
    Verifica que [inicio, fin) caiga dentro de algún bloque horario del día correspondiente.
    """
    d = _weekday(inicio)
    hs = db.scalars(select(Horario).where(Horario.emprendedor_id == emprendedor_id, Horario.dia_semana == d)).all()
    if not hs:
        return False
    for h in hs:
        start_dt = inicio.replace(hour=h.hora_desde.hour, minute=h.hora_desde.minute, second=0, microsecond=0)
        end_dt = inicio.replace(hour=h.hora_hasta.hour, minute=h.hora_hasta.minute, second=0, microsecond=0)
        if inicio >= start_dt and fin <= end_dt:
            return True
    return False
