# app/routers/turnos.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/turnos", tags=["turnos"])

def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

@router.get("/mis")
def turnos_mios(
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
    desde: str | None = Query(None),
    hasta: str | None = Query(None),
):
    # ✅ user es ORM, no dict
    u_id = int(user.id)

    # Traer el emprendedor del usuario (por FK user_id o relación)
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.user_id == u_id).first()
    if not emp:
        return []  # o [] si no tiene emprendimiento aún

    q = db.query(models.Turno).filter(models.Turno.emprendedor_id == emp.id)
    d1 = _parse_dt(desde)
    d2 = _parse_dt(hasta)
    if d1:
        q = q.filter(models.Turno.inicio >= d1)
    if d2:
        q = q.filter(models.Turno.inicio <= d2)

    turnos = q.order_by(models.Turno.inicio.asc()).all()
    # retorná como tu esquema actual; si devolvés ORM, FastAPI serializa attrs simples
    return turnos
