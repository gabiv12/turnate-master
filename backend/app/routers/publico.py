from __future__ import annotations
from datetime import datetime, time as dt_time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Emprendedor, Servicio, Horario, Turno
from app.crud.horarios import dentro_de_horario
from app.crud.turnos import hay_conflicto

router = APIRouter(prefix="/publico", tags=["publico"])

# ---------- helpers ----------
def _as_list(x) -> list[str] | None:
    if x is None:
        return None
    if isinstance(x, list):
        return x
    s = str(x).strip()
    if not s:
        return None
    # soporta CSV sencillo
    return [p.strip() for p in s.split(",") if p.strip()]

def _time_to_hhmm(t: dt_time) -> str:
    return f"{t.hour:02d}:{t.minute:02d}"

# ================== GET /publico/emprendedores/by-codigo/{codigo} ==================
@router.get("/emprendedores/by-codigo/{codigo}")
def publico_emp_by_codigo(codigo: str, db: Session = Depends(get_db)):
    e: Emprendedor | None = db.query(Emprendedor).filter(Emprendedor.codigo_cliente == codigo).first()
    if not e:
        raise HTTPException(status_code=404, detail="Código no encontrado")

    # Mapeo a lo que muestra el front en la "ficha" de presentación
    return {
        "id": e.id,
        "nombre": e.nombre,
        "descripcion": e.descripcion,
        "codigo_cliente": e.codigo_cliente,
        "logo_url": getattr(e, "logo_url", None),
        "direccion": getattr(e, "direccion", None),
        "telefono": getattr(e, "telefono", None),
        "email_contacto": getattr(e, "email_contacto", None),
        "rubro": getattr(e, "rubro", None),
        "web": getattr(e, "web", None),
        "redes": _as_list(getattr(e, "redes", None)),
        "cuit": getattr(e, "cuit", None),
    }

# ================== GET /publico/servicios/{codigo} (por código público) ==================
@router.get("/servicios/{codigo}")
def publico_servicios(codigo: str, db: Session = Depends(get_db)) -> List[dict]:
    emp = db.query(Emprendedor).filter(Emprendedor.codigo_cliente == codigo).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no encontrado")

    q = db.query(Servicio).filter(Servicio.emprendedor_id == emp.id, Servicio.activo == True)  # noqa: E712
    items = []
    for s in q.all():
        items.append({
            "id": s.id,
            "nombre": s.nombre,
            "descripcion": None,                 # si no tenés esa col
            "duracion_min": int(s.duracion_min), # requerido por front
            "precio": float(s.precio or 0.0),
            "activo": bool(s.activo),
            "emprendedor_id": s.emprendedor_id,
        })
    return items

# ================== GET /publico/horarios/{emp_id} ==================
@router.get("/horarios/{emp_id}")
def publico_horarios(emp_id: int, db: Session = Depends(get_db)) -> List[dict]:
    # Tu modelo tiene: dia_semana (0..6), inicio: TIME, fin: TIME
    hs: list[Horario] = db.query(Horario).filter(Horario.emprendedor_id == emp_id).all()
    items: list[dict] = []
    for h in hs:
        items.append({
            "id": h.id,
            "emprendedor_id": h.emprendedor_id,
            "dia_semana": int(h.dia_semana),
            "hora_desde": _time_to_hhmm(h.inicio),
            "hora_hasta": _time_to_hhmm(h.fin),
            "intervalo_min": 30,  # el front lo usa; si no tenés columna, fijo 30
            "activo": True,       # mismo criterio
        })
    return items

# ================== GET /publico/turnos/{emp_id}?desde&hasta ==================
@router.get("/turnos/{emp_id}")
def publico_turnos(
    emp_id: int,
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
) -> List[dict]:
    q = db.query(Turno).filter(Turno.emprendedor_id == emp_id)
    if desde:
        q = q.filter(Turno.inicio >= desde)
    if hasta:
        q = q.filter(Turno.fin <= hasta)
    # si tu estado existe, filtramos "reservado" para público
    try:
        q = q.filter(Turno.estado == "reservado")
    except Exception:
        pass

    items = []
    for t in q.all():
        items.append({
            "id": t.id,
            "emprendedor_id": t.emprendedor_id,
            "servicio_id": t.servicio_id,
            "inicio": t.inicio,
            "fin": t.fin,
            "cliente_nombre": t.cliente_nombre,
            "cliente_contacto": t.cliente_contacto,
            "nota": t.nota,
            "estado": t.estado,
        })
    return items

# ================== POST /publico/turnos ==================
@router.post("/turnos")
def crear_turno_publico(payload: dict, db: Session = Depends(get_db)):
    """
    Espera EXACTAMENTE:
    {
      "codigo": "<codigo_publico>",
      "servicio_id": <number>,
      "inicio": "YYYY-MM-DDTHH:MM:SS",
      "cliente_nombre": "...",
      "cliente_contacto": "...",
      "nota": "..."   # opcional
    }
    """
    codigo = (payload.get("codigo") or "").strip()
    servicio_id = int(payload.get("servicio_id") or 0)
    try:
        inicio: datetime = datetime.fromisoformat(str(payload.get("inicio")))
    except Exception:
        raise HTTPException(status_code=422, detail="Formato de 'inicio' inválido")

    emp = db.query(Emprendedor).filter(Emprendedor.codigo_cliente == codigo).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Código inválido")

    s = db.query(Servicio).filter(Servicio.id == servicio_id, Servicio.emprendedor_id == emp.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    # calcular fin por duración de servicio
    from datetime import timedelta
    fin = inicio + timedelta(minutes=int(s.duracion_min or 30))

    # validar bloque (usa horarios.inicio/fin TIME + dia_semana 0..6)
    if not dentro_de_horario(db, emp.id, inicio, fin):
        raise HTTPException(status_code=409, detail="Horario fuera de bloque")

    # validar conflicto con turnos
    if hay_conflicto(db, emp.id, inicio, fin):
        raise HTTPException(status_code=409, detail="Horario no disponible")

    t = Turno(
        emprendedor_id=emp.id,
        servicio_id=s.id,
        inicio=inicio,
        fin=fin,
        cliente_nombre=(payload.get("cliente_nombre") or "Cliente").strip(),
        cliente_contacto=(payload.get("cliente_contacto") or "").strip() or None,
        nota=(payload.get("nota") or "").strip() or None,
        estado="reservado",
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    return {
        "id": t.id,
        "emprendedor_id": t.emprendedor_id,
        "servicio_id": t.servicio_id,
        "inicio": t.inicio,
        "fin": t.fin,
        "cliente_nombre": t.cliente_nombre,
        "cliente_contacto": t.cliente_contacto,
        "nota": t.nota,
        "estado": t.estado,
    }
