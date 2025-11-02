# app/routers/public_servicios.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import ServicioOut  # ya tiene model_config v2 (from_attributes=True)

router = APIRouter(prefix="/servicios", tags=["servicios"])

@router.get("/de/{codigo}", response_model=List[ServicioOut])
def servicios_public_by_codigo(codigo: str, db: Session = Depends(get_db)):
    """
    Devuelve los servicios del emprendedor identificado por su 'codigo_cliente'.
    Filtra por 'activo=True' si la columna existe.
    """
    emp = (
        db.query(models.Emprendedor)
        .filter(models.Emprendedor.codigo_cliente == codigo)
        .first()
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no encontrado")

    q = db.query(models.Servicio).filter(models.Servicio.emprendedor_id == emp.id)
    # Si tu modelo tiene 'activo', filtramos; si no, seguimos sin filtrar
    try:
        q = q.filter(models.Servicio.activo == True)  # noqa: E712
    except Exception:
        pass

    return q.all()

