# app/routers/servicios.py
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user
from app.schemas import ServicioCreate, ServicioUpdate, ServicioOut

router = APIRouter(prefix="/servicios", tags=["servicios"])

def _get_emprendedor_or_404(db: Session, user_id: int) -> models.Emprendedor:
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.user_id == user_id).first()
    if not emp and hasattr(models.Emprendedor, "usuario_id"):
        emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == user_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No sos emprendedor.")
    return emp

@router.get("/mis", response_model=list[ServicioOut])
def listar_mis_servicios(
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _get_emprendedor_or_404(db, user.id)
    items = (
        db.query(models.Servicio)
        .filter(models.Servicio.emprendedor_id == emp.id)
        .order_by(models.Servicio.id.asc())
        .all()
    )
    return items

@router.post("", response_model=ServicioOut)
def crear_servicio(
    payload: ServicioCreate,
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _get_emprendedor_or_404(db, user.id)
    item = models.Servicio(
        nombre=payload.nombre.strip(),
        duracion_min=getattr(payload, "duracion_min", None) or getattr(payload, "duracion", None) or 30,
        precio=payload.precio,
        emprendedor_id=emp.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{servicio_id}", response_model=ServicioOut)
def actualizar_servicio(
    payload: ServicioUpdate,
    servicio_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _get_emprendedor_or_404(db, user.id)
    item = (
        db.query(models.Servicio)
        .filter(models.Servicio.id == servicio_id, models.Servicio.emprendedor_id == emp.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")

    if payload.nombre is not None:
        item.nombre = payload.nombre.strip()
    if payload.duracion_min is not None:
        item.duracion_min = payload.duracion_min
    if payload.precio is not None:
        item.precio = payload.precio

    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{servicio_id}")
def eliminar_servicio(
    servicio_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _get_emprendedor_or_404(db, user.id)
    item = (
        db.query(models.Servicio)
        .filter(models.Servicio.id == servicio_id, models.Servicio.emprendedor_id == emp.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")

    db.delete(item)
    db.commit()
    return {"detail": "Servicio eliminado."}
