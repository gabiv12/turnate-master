# app/routers/horarios.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/horarios", tags=["horarios"])

def _ensure_emp(db: Session, user: models.Usuario) -> models.Emprendedor:
    # ✅ En tu modelo el FK es user_id (no usuario_id)
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.user_id == user.id).first()
    if not emp:
        # Si tu flujo permite autogenerar, podés crearlo acá;
        # si no, simplemente lanzar 404.
        raise HTTPException(status_code=404, detail="No tenés un emprendimiento asociado.")
    return emp

@router.get("/mis")
def mis_horarios(db: Session = Depends(get_db), user: models.Usuario = Depends(get_current_user)):
    emp = _ensure_emp(db, user)
    horarios = db.query(models.Horario).filter(models.Horario.emprendedor_id == emp.id).all()
    return horarios

@router.post("")
def crear_horario(payload: dict, db: Session = Depends(get_db), user: models.Usuario = Depends(get_current_user)):
    emp = _ensure_emp(db, user)
    # Ajustá a tu schema real:
    # payload esperado: { "dia": int, "desde": "HH:MM", "hasta": "HH:MM", "intervalo": int }
    try:
        h = models.Horario(
            emprendedor_id=emp.id,
            dia=payload.get("dia"),
            desde=payload.get("desde"),
            hasta=payload.get("hasta"),
            intervalo=payload.get("intervalo"),
        )
        db.add(h)
        db.commit()
        db.refresh(h)
        return h
    except Exception:
        db.rollback()
        raise HTTPException(status_code=422, detail="Datos inválidos para crear horario.")
