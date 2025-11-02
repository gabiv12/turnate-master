# app/routers/turnos.py
from __future__ import annotations
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app.models import Turno, Emprendedor, Servicio
from app.schemas import TurnoCreate, TurnoOut
from app.crud.horarios import dentro_de_horario  # asumido existente en tu proyecto

router = APIRouter(prefix="/turnos", tags=["turnos"])

def _parse_iso(x: Optional[str], name: str) -> datetime:
    if not x:
        raise HTTPException(status_code=400, detail=f"Falta parámetro {name}")
    try:
        return datetime.fromisoformat(x.replace("Z", "+00:00")) if "Z" in x else datetime.fromisoformat(x)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Formato inválido en {name} (usar ISO 8601)")

# =========================
# Público por código
# =========================
class PublicTurnoCreate(BaseModel):
    codigo: Optional[str] = None           # codigo_cliente
    emprendedor_id: Optional[int] = None   # alternativa
    servicio_id: int
    inicio: datetime
    cliente_nombre: Optional[str] = "Cliente"
    cliente_contacto: Optional[str] = None
    nota: Optional[str] = None

@router.post("/publico", response_model=TurnoOut)
def crear_turno_publico(payload: PublicTurnoCreate, db: Session = Depends(get_db)):
    emp = None
    if payload.codigo:
        emp = db.query(Emprendedor).filter(Emprendedor.codigo_cliente == payload.codigo).first()
    elif payload.emprendedor_id:
        emp = db.query(Emprendedor).filter(Emprendedor.id == payload.emprendedor_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor inválido")

    s = db.query(Servicio).filter(Servicio.id == payload.servicio_id, Servicio.emprendedor_id == emp.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    fin = payload.inicio + timedelta(minutes=s.duracion_min)
    if not dentro_de_horario(db, emp.id, payload.inicio, fin):
        raise HTTPException(status_code=409, detail="Horario fuera de bloque")

    conflict = db.query(Turno).filter(
        Turno.emprendedor_id == emp.id,
        Turno.inicio == payload.inicio,
        Turno.fin == fin,
        Turno.estado == "reservado",
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Horario no disponible")

    t = Turno(
        emprendedor_id=emp.id,
        servicio_id=s.id,
        inicio=payload.inicio,
        fin=fin,
        cliente_nombre=(payload.cliente_nombre or "Cliente").strip(),
        cliente_contacto=(payload.cliente_contacto or "-").strip(),
        nota=(payload.nota or "").strip() or None,
        estado="reservado",
    )
    db.add(t); db.commit(); db.refresh(t)
    return TurnoOut.model_validate(t)

# =========================
# Dueño (owner)
# =========================
@router.get("/mis", response_model=List[TurnoOut])
def mis_turnos(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no activado")

    d1 = _parse_iso(desde, "desde")
    d2 = _parse_iso(hasta, "hasta")

    qs = (
        db.query(Turno)
        .filter(Turno.emprendedor_id == emp.id, Turno.inicio >= d1, Turno.fin <= d2)
        .order_by(Turno.inicio.asc())
    )
    return [TurnoOut.model_validate(t) for t in qs.all()]

class OwnerTurnoCreate(BaseModel):
    servicio_id: int
    inicio: datetime
    cliente_nombre: Optional[str] = "Cliente"
    cliente_contacto: Optional[str] = None
    nota: Optional[str] = None

@router.post("", response_model=TurnoOut)
def crear_turno_owner(
    payload: OwnerTurnoCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no activado")

    s = db.query(Servicio).filter(Servicio.id == payload.servicio_id, Servicio.emprendedor_id == emp.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    fin = payload.inicio + timedelta(minutes=s.duracion_min)
    if not dentro_de_horario(db, emp.id, payload.inicio, fin):
        raise HTTPException(status_code=409, detail="Fuera de horario")

    conflict = db.query(Turno).filter(
        Turno.emprendedor_id == emp.id,
        Turno.inicio == payload.inicio,
        Turno.fin == fin,
        Turno.estado == "reservado",
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Horario no disponible")

    t = Turno(
        emprendedor_id=emp.id,
        servicio_id=s.id,
        inicio=payload.inicio,
        fin=fin,
        cliente_nombre=(payload.cliente_nombre or "Cliente").strip(),
        cliente_contacto=(payload.cliente_contacto or "-").strip(),
        nota=(payload.nota or "").strip() or None,
        estado="reservado",
    )
    db.add(t); db.commit(); db.refresh(t)
    return TurnoOut.model_validate(t)

@router.delete("/{turno_id}", status_code=204)
def borrar_turno(
    turno_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no activado")
    t = db.query(Turno).filter(Turno.id == turno_id, Turno.emprendedor_id == emp.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    db.delete(t); db.commit()
    return
