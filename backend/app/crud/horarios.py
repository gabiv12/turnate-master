from __future__ import annotations
from datetime import datetime, time as dt_time
from sqlalchemy.orm import Session

from app.models import Horario

def _to_minutes(t: dt_time) -> int:
    return t.hour * 60 + t.minute

def _weekday_dom0(dt: datetime) -> int:
    # Python: 0=Lun..6=Dom  →  Convención: 0=Dom..6=Sáb
    return (dt.weekday() + 1) % 7

def dentro_de_horario(db: Session, emp_id: int, inicio: datetime, fin: datetime) -> bool:
    """
    Valida que el intervalo [inicio, fin) esté completamente contenido
    en alguno de los bloques de 'horarios' para el día elegido.
    Tabla 'horarios' tiene: dia_semana (0..6), inicio (TIME), fin (TIME).
    """
    dia = _weekday_dom0(inicio)
    hs = db.query(Horario).filter(
        Horario.emprendedor_id == emp_id,
        Horario.dia_semana == dia
    ).all()

    ini_m = inicio.hour * 60 + inicio.minute
    fin_m = fin.hour * 60 + fin.minute

    for h in hs:
        s = _to_minutes(h.inicio)
        e = _to_minutes(h.fin)
        if s <= ini_m and fin_m <= e:
            return True
    return False
