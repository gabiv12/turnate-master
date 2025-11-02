# app/routers/servicios.py
from __future__ import annotations
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from sqlalchemy.orm import Session

from app import models
from app.deps import get_db, get_current_user

router = APIRouter(prefix="/servicios", tags=["servicios"])

# ===== helpers =====
def _get_emp_del_usuario(db: Session, user_id: int) -> models.Emprendedor:
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == user_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Aún no activaste el plan Emprendedor.")
    return emp

def _to_dict(s: models.Servicio) -> Dict[str, Any]:
    return {
        "id": s.id,
        "emprendedor_id": s.emprendedor_id,
        "nombre": s.nombre,
        "duracion_min": s.duracion_min,
        "precio": s.precio,
        "color": s.color,
        "activo": s.activo,
    }

def _get_json(request: Request) -> Dict[str, Any]:
    try:
        return request.json() if isinstance(request, dict) else {}
    except Exception:
        return {}

# ===== endpoints =====
@router.get("/mis")
def listar_mis_servicios(
    db: Session = Depends(get_db),
    current: models.Usuario = Depends(get_current_user),
):
    emp = _get_emp_del_usuario(db, current.id)
    items = (
        db.query(models.Servicio)
        .filter(models.Servicio.emprendedor_id == emp.id)
        .order_by(models.Servicio.id.desc())
        .all()
    )
    return [_to_dict(s) for s in items]

@router.post("", status_code=201)
async def crear_servicio(
    request: Request,
    db: Session = Depends(get_db),
    current: models.Usuario = Depends(get_current_user),
):
    emp = _get_emp_del_usuario(db, current.id)

    body = await request.json()
    nombre = str(body.get("nombre", "")).strip()
    dur_min = body.get("duracion_min", body.get("duracion_minutos"))
    precio = body.get("precio", 0)
    color = body.get("color")

    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio.")
    try:
        dur_min = int(dur_min)
    except Exception:
        dur_min = None
    if dur_min is None or dur_min < 5:
        raise HTTPException(status_code=400, detail="La duración debe ser >= 5 minutos.")

    try:
        s = models.Servicio(
            emprendedor_id=emp.id,
            nombre=nombre,
            duracion_min=dur_min,
            precio=float(precio) if precio is not None else 0.0,
            color=color or None,
            activo=True,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        return _to_dict(s)
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudo crear el servicio: {ex}")

@router.put("/{servicio_id}")
async def actualizar_servicio(
    servicio_id: int = Path(..., ge=1),
    request: Request = None,
    db: Session = Depends(get_db),
    current: models.Usuario = Depends(get_current_user),
):
    emp = _get_emp_del_usuario(db, current.id)
    s = (
        db.query(models.Servicio)
        .filter(models.Servicio.id == servicio_id, models.Servicio.emprendedor_id == emp.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")

    body = await request.json()
    changed = False

    if "nombre" in body:
        nombre = str(body.get("nombre", "")).strip()
        if not nombre:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
        s.nombre = nombre
        changed = True

    if "duracion_min" in body or "duracion_minutos" in body:
        dur_min = body.get("duracion_min", body.get("duracion_minutos"))
        try:
            dur_min = int(dur_min)
        except Exception:
            dur_min = None
        if dur_min is None or dur_min < 5:
            raise HTTPException(status_code=400, detail="La duración debe ser >= 5.")
        s.duracion_min = dur_min
        changed = True

    if "precio" in body:
        try:
            s.precio = float(body.get("precio", 0))
        except Exception:
            s.precio = 0.0
        changed = True

    if "color" in body:
        s.color = body.get("color") or None
        changed = True

    if "activo" in body:
        s.activo = bool(body.get("activo"))
        changed = True

    if changed:
        try:
            db.add(s)
            db.commit()
            db.refresh(s)
        except Exception as ex:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"No se pudo actualizar el servicio: {ex}")

    return _to_dict(s)

@router.delete("/{servicio_id}", status_code=204)
def eliminar_servicio(
    servicio_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current: models.Usuario = Depends(get_current_user),
):
    emp = _get_emp_del_usuario(db, current.id)
    s = (
        db.query(models.Servicio)
        .filter(models.Servicio.id == servicio_id, models.Servicio.emprendedor_id == emp.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")
    try:
        db.delete(s)
        db.commit()
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudo eliminar el servicio: {ex}")
    return None
