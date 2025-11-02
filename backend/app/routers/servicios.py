from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app.models import Usuario, Emprendedor, Servicio

from pydantic import BaseModel, Field, ConfigDict

router = APIRouter(prefix="/servicios", tags=["servicios"])

# ===== Schemas (locales y simples) =====
class ServicioIn(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    duracion_min: int = Field(30, ge=5, le=600)
    precio: float = 0.0
    color: Optional[str] = None
    activo: bool = True

class ServicioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emprendedor_id: int
    nombre: str
    duracion_min: int
    precio: float
    color: Optional[str] = None
    activo: bool

def _get_my_emprendedor(db: Session, user: Usuario) -> Emprendedor | None:
    return db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()

def _to_out(svc: Servicio) -> ServicioOut:
    return ServicioOut.model_validate(svc)

@router.get("/mis", response_model=List[ServicioOut])
def list_my_services(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    emp = _get_my_emprendedor(db, current_user)
    if not emp:
        return []
    rows = (
        db.query(Servicio)
        .filter(Servicio.emprendedor_id == emp.id)
        .order_by(Servicio.id.desc())
        .all()
    )
    return [_to_out(r) for r in rows]

@router.post("", response_model=ServicioOut, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServicioIn,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    emp = _get_my_emprendedor(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="Primero activá tu perfil de emprendedor.")
    svc = Servicio(
        emprendedor_id=emp.id,
        nombre=payload.nombre.strip(),
        duracion_min=payload.duracion_min,
        precio=float(payload.precio or 0),
        color=(payload.color or "").strip() or None,
        activo=bool(payload.activo),
    )
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return _to_out(svc)

@router.put("/{servicio_id}", response_model=ServicioOut)
def update_service(
    servicio_id: int = Path(..., gt=0),
    payload: ServicioIn = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    emp = _get_my_emprendedor(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="No tenés emprendimiento activo.")
    svc = (
        db.query(Servicio)
        .filter(Servicio.id == servicio_id, Servicio.emprendedor_id == emp.id)
        .first()
    )
    if not svc:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")

    if payload.nombre:
        svc.nombre = payload.nombre.strip()
    svc.duracion_min = payload.duracion_min
    svc.precio = float(payload.precio or 0)
    svc.color = (payload.color or "").strip() or None
    svc.activo = bool(payload.activo)

    db.commit()
    db.refresh(svc)
    return _to_out(svc)

@router.delete("/{servicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    servicio_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    emp = _get_my_emprendedor(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="No tenés emprendimiento activo.")
    svc = (
        db.query(Servicio)
        .filter(Servicio.id == servicio_id, Servicio.emprendedor_id == emp.id)
        .first()
    )
    if not svc:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")
    db.delete(svc)
    db.commit()
    return

# Alias opcional por si el front viejo lista por emprendedor_id
@router.get("/emprendedor/{emprendedor_id}", response_model=List[ServicioOut], include_in_schema=False)
def list_by_emprendedor(
    emprendedor_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    emp = _get_my_emprendedor(db, current_user)
    if not emp or emp.id != emprendedor_id:
        raise HTTPException(status_code=403, detail="No autorizado.")
    rows = db.query(Servicio).filter(Servicio.emprendedor_id == emp.id).all()
    return [_to_out(r) for r in rows]
