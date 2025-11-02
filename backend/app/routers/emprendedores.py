# app/routers/emprendedores.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session

from app import models, schemas
from app.deps import get_db, get_current_user

router = APIRouter(prefix="/emprendedores", tags=["emprendedores"])

@router.get("/mi", response_model=schemas.EmprendedorOut)
def get_mi_emprendedor(
    db: Session = Depends(get_db),
    current: models.Usuario = Depends(get_current_user),
):
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == current.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Aún no activaste el plan Emprendedor.")
    return schemas.EmprendedorOut.model_validate({
        "id": emp.id,
        "nombre": emp.nombre,
        "descripcion": emp.descripcion,
        "codigo_cliente": emp.codigo_cliente,
        "owner_user_id": emp.usuario_id,
        "created_at": emp.created_at,
        "cuit": emp.cuit,
        "telefono": emp.telefono,
        "direccion": emp.direccion,
        "rubro": emp.rubro,
        "redes": emp.redes,
        "web": emp.web,
        "email_contacto": emp.email_contacto,
        "logo_url": emp.logo_url,
    })

@router.get("/by-codigo/{codigo}", response_model=schemas.EmprendedorOut)
def get_by_codigo(codigo: str, db: Session = Depends(get_db)):
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.codigo_cliente == codigo).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No existe emprendimiento con ese código.")
    return schemas.EmprendedorOut.model_validate(emp)

@router.put("/{emprendedor_id}", response_model=schemas.EmprendedorOut)
def update_emprendedor(
    emprendedor_id: int,
    body: schemas.EmprendedorUpdate,
    db: Session = Depends(get_db),
    current: models.Usuario = Depends(get_current_user),
):
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.id == emprendedor_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no encontrado")
    if emp.usuario_id != current.id and current.rol not in ("admin",):
        raise HTTPException(status_code=403, detail="No autorizado")

    # actualizar sólo si se envía el campo
    if body.nombre is not None:
        if not body.nombre.strip():
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
        emp.nombre = body.nombre.strip()

    if body.descripcion is not None:
        emp.descripcion = (body.descripcion or "").strip()

    emp.cuit = body.cuit if body.cuit is not None else emp.cuit
    emp.telefono = body.telefono if body.telefono is not None else emp.telefono
    emp.direccion = body.direccion if body.direccion is not None else emp.direccion
    emp.rubro = body.rubro if body.rubro is not None else emp.rubro
    emp.redes = body.redes if body.redes is not None else emp.redes
    emp.web = body.web if body.web is not None else emp.web
    emp.email_contacto = body.email_contacto if body.email_contacto is not None else emp.email_contacto
    emp.logo_url = body.logo_url if body.logo_url is not None else emp.logo_url

    db.add(emp); db.commit(); db.refresh(emp)
    return schemas.EmprendedorOut.model_validate(emp)
