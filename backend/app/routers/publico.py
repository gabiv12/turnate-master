# app/routers/publico.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.database import get_db
from app import models
from app.schemas import ServicioOut, HorarioOut, TurnoOut

router = APIRouter(prefix="/publico", tags=["publico"])

def _emp_by_code(db: Session, code: str) -> models.Emprendedor | None:
    return (
        db.query(models.Emprendedor)
        .filter(models.Emprendedor.codigo_cliente == code.upper())
        .first()
    )

@router.get("/servicios/{codigo}", response_model=List[ServicioOut])
def servicios(codigo: str, db: Session = Depends(get_db)):
    emp = _emp_by_code(db, codigo)
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendimiento no encontrado")
    return (
        db.query(models.Servicio)
        .filter(models.Servicio.emprendedor_id == emp.id)
        .order_by(models.Servicio.nombre.asc())
        .all()
    )

@router.get("/horarios/{codigo}", response_model=List[HorarioOut])
def horarios(codigo: str, db: Session = Depends(get_db)):
    emp = _emp_by_code(db, codigo)
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendimiento no encontrado")
    return (
        db.query(models.Horario)
        .filter(
            models.Horario.emprendedor_id == emp.id,
            getattr(models.Horario, "activo", True) == True  # si no existe 'activo', evalúa True
        )
        .order_by(models.Horario.dia_semana.asc(), models.Horario.hora_desde.asc())
        .all()
    )

@router.get("/turnos/{codigo}", response_model=List[TurnoOut])
def turnos(
    codigo: str,
    desde: datetime = Query(...),
    hasta: datetime = Query(...),
    db: Session = Depends(get_db),
):
    emp = _emp_by_code(db, codigo)
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendimiento no encontrado")
    # Nota: si tu modelo usa campos 'inicio'/'fin' o 'desde'/'hasta', probamos ambos
    q = db.query(models.Turno).filter(models.Turno.emprendedor_id == emp.id)

    if hasattr(models.Turno, "inicio") and hasattr(models.Turno, "fin"):
        q = q.filter(models.Turno.inicio >= desde, models.Turno.fin <= hasta)
        q = q.order_by(models.Turno.inicio.asc())
    else:
        # fallback por compatibilidad
        q = q.filter(models.Turno.desde >= desde, models.Turno.hasta <= hasta)
        q = q.order_by(models.Turno.desde.asc())

    return q.all()
