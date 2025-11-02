# backend/app/routers/admin.py
from __future__ import annotations

from datetime import datetime
from calendar import monthrange
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import get_db, require_roles
from ..models import Usuario, Emprendedor, Turno

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/resumen")
def resumen(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_roles(["admin"])),
):
    # métricas básicas: usuarios totales, emprendedores totales, turnos del mes
    hoy = datetime.utcnow()
    start_month = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_month_day = monthrange(hoy.year, hoy.month)[1]
    end_month = hoy.replace(day=end_month_day, hour=23, minute=59, second=59, microsecond=999999)

    total_usuarios = db.scalar(select(func.count()).select_from(Usuario)) or 0
    total_emprendedores = db.scalar(select(func.count()).select_from(Emprendedor)) or 0
    turnos_mes = db.scalar(
        select(func.count()).select_from(Turno).where(Turno.inicio >= start_month, Turno.inicio <= end_month)
    ) or 0

    return {
        "total_usuarios": int(total_usuarios),
        "total_emprendedores": int(total_emprendedores),
        "turnos_mes": int(turnos_mes),
        "desde": start_month,
        "hasta": end_month,
    }
