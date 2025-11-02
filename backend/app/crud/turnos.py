from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Turno

def hay_conflicto(db: Session, emp_id: int, inicio: datetime, fin: datetime) -> bool:
    """
    Superposición de intervalos:
    A.inicio < B.fin  y  A.fin > B.inicio
    """
    q = db.query(Turno).filter(Turno.emprendedor_id == emp_id)
    q = q.filter(Turno.inicio < fin, Turno.fin > inicio)
    try:
        q = q.filter(Turno.estado == "reservado")
    except Exception:
        pass
    return db.query(q.exists()).scalar()
