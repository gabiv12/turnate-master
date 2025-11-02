# app/routers/estadisticas.py
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import schemas
from app.models import Turno, Servicio, Emprendedor
from app.deps import get_db, get_current_user

router = APIRouter(prefix="/estadisticas", tags=["estadisticas"])

# ===== Helpers reutilizables =====
def _get_my_emprendedor(db: Session, user) -> Emprendedor:
    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=400, detail="No tenés un perfil de emprendedor activo.")
    return emp

def _turno_has_attr(name: str) -> bool:
    return hasattr(Turno, name)

def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if "Z" in s else datetime.fromisoformat(s)
    except Exception:
        return None

def _normalize_range(desde: Optional[str], hasta: Optional[str]) -> (datetime, datetime):
    now = datetime.now()
    start = _parse_iso(desde) or datetime(now.year, now.month, 1, 0, 0, 0)
    end = _parse_iso(hasta)
    if not end:
        # fin de mes
        if start.month == 12:
            end = datetime(start.year + 1, 1, 1) - timedelta(milliseconds=1)
        else:
            end = datetime(start.year, start.month + 1, 1) - timedelta(milliseconds=1)
    if start.tzinfo:
        start = start.replace(tzinfo=None)
    if end.tzinfo:
        end = end.replace(tzinfo=None)
    return start, end

def _svc_duration_min(svc: Servicio) -> int:
    for attr in ("duracion_min", "duracion_minutos"):
        if hasattr(svc, attr):
            try:
                return int(getattr(svc, attr) or 30)
            except Exception:
                pass
    return 30

# ===== Endpoints =====
@router.get("/mis/resumen", response_model=schemas.StatsResumenOut)
def stats_mis_resumen(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    emp = _get_my_emprendedor(db, user)
    start, end = _normalize_range(desde, hasta)

    # Base query: turnos del emprendedor en el rango
    q = db.query(Turno).filter(Turno.servicio_id.isnot(None))
    if _turno_has_attr("emprendedor_id"):
        q = q.filter(Turno.emprendedor_id == emp.id)
    else:
        # filtrar por servicio.emprendedor_id
        q = q.join(Servicio, Servicio.id == Turno.servicio_id).filter(Servicio.emprendedor_id == emp.id)

    if _turno_has_attr("inicio"):
        q = q.filter(Turno.inicio >= start, Turno.inicio <= end)
    elif _turno_has_attr("desde"):
        q = q.filter(Turno.desde >= start, Turno.desde <= end)

    items: List[Turno] = q.all()

    # Prefetch servicios para nombre/duración
    servicios = {s.id: s for s in db.query(Servicio).filter(Servicio.emprendedor_id == emp.id).all()}

    # Agregaciones en memoria (robusto ante columnas distintas)
    por_dia: Dict[date, int] = {}
    por_servicio: Dict[int, Dict[str, int]] = {}  # {serv_id: {"cant": n, "min": m, "nombre": str}}

    total = 0
    for t in items:
        inicio = getattr(t, "inicio", None) or getattr(t, "desde", None) or getattr(t, "datetime", None)
        fin = getattr(t, "fin", None) or getattr(t, "hasta", None)

        if not inicio:
            # si algún turno no tiene inicio, lo salteamos
            continue

        if not fin:
            # inferir fin con la duración del servicio
            svc = servicios.get(getattr(t, "servicio_id", None))
            fin = inicio + timedelta(minutes=_svc_duration_min(svc)) if svc else inicio + timedelta(minutes=30)

        # clave día
        dia = date(inicio.year, inicio.month, inicio.day)
        por_dia[dia] = por_dia.get(dia, 0) + 1

        # por servicio
        sid = getattr(t, "servicio_id", 0) or 0
        svc = servicios.get(sid)
        nombre = getattr(svc, "nombre", "Servicio") if svc else "Servicio"
        dur_min = int((fin - inicio).total_seconds() // 60)

        if sid not in por_servicio:
            por_servicio[sid] = {"cant": 0, "min": 0, "nombre": nombre}
        por_servicio[sid]["cant"] += 1
        por_servicio[sid]["min"] += max(dur_min, 0)

        total += 1

    # construir salida
    out = schemas.StatsResumenOut(
        rango=schemas.StatsRango(desde=start, hasta=end),
        total_turnos=total,
        por_dia=[
            schemas.StatsPorDiaItem(fecha=k, cantidad=v)
            for k, v in sorted(por_dia.items(), key=lambda x: x[0])
        ],
        por_servicio=[
            schemas.StatsPorServicioItem(
                servicio_id=sid,
                servicio_nombre=data["nombre"],
                cantidad=data["cant"],
                minutos_totales=data["min"],
            )
            for sid, data in sorted(por_servicio.items(), key=lambda x: (-x[1]["cant"], x[0]))
        ],
    )
    return out
