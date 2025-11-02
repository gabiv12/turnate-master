# app/routers/horarios.py
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, time as dt_time
from typing import Any, Dict, List, Optional

from app.deps import get_db, get_current_user
from app.models import Usuario, Emprendedor, Horario

router = APIRouter(prefix="/horarios", tags=["horarios"])

# --- helpers de reflexión sobre el modelo ---
CAND_DIA = ["dia_semana", "dia", "weekday"]
CAND_INICIO = ["desde", "hora_desde", "inicio", "hora_inicio", "start"]
CAND_FIN = ["hasta", "hora_hasta", "fin", "hora_fin", "end"]
CAND_INTERVALO = ["intervalo_min", "intervalo", "duracion_min", "duracion"]
CAND_EMP_ID = ["emprendedor_id", "id_emprendedor", "owner_id"]

def _first_attr_name(model, candidates) -> Optional[str]:
    for n in candidates:
        if hasattr(model, n):
            return n
    return None

# Descubre los nombres reales en TU modelo Horario
DIA_COL = _first_attr_name(Horario, CAND_DIA) or "dia_semana"
INICIO_COL = _first_attr_name(Horario, CAND_INICIO)  # puede ser None
FIN_COL = _first_attr_name(Horario, CAND_FIN)        # puede ser None
INTERVALO_COL = _first_attr_name(Horario, CAND_INTERVALO)  # opcional
EMP_ID_COL = _first_attr_name(Horario, CAND_EMP_ID) or "emprendedor_id"

def _hhmm_to_time(v: str) -> dt_time:
    if isinstance(v, dt_time):
        return v
    if not isinstance(v, str):
        raise ValueError("Hora inválida")
    v = v.strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(v, fmt).time()
        except ValueError:
            continue
    parts = v.split(":")
    if len(parts) >= 2:
        h = str(parts[0]).zfill(2)
        m = str(parts[1]).zfill(2)
        s = str(parts[2]).zfill(2) if len(parts) > 2 else "00"
        return datetime.strptime(f"{h}:{m}:{s}", "%H:%M:%S").time()
    raise ValueError("Hora inválida")

def _fmt_time(val: Any) -> str:
    if isinstance(val, dt_time):
        return val.strftime("%H:%M")
    if isinstance(val, str):
        try:
            return _hhmm_to_time(val).strftime("%H:%M")
        except Exception:
            return val
    return ""

def _current_emprendedor(db: Session, user: Usuario) -> Emprendedor:
    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Aún no tenés un emprendimiento activo.")
    return emp

def _normalize_payload_to_flat_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = payload.get("items")
    if not items and isinstance(payload, list):
        items = payload
    items = items or []

    flat: List[Dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        dia = int(it.get("dia_semana", it.get("dia", it.get("weekday", -1))))
        if dia < 0:
            continue
        intervalo_min = int(it.get("intervalo_min", it.get("intervalo", it.get("duracion_min", it.get("duracion", 30)))))
        activo = it.get("activo", True)

        if "bloques" in it and isinstance(it["bloques"], list):
            if not activo:
                continue
            for b in it["bloques"]:
                if not isinstance(b, dict):
                    continue
                d = b.get("desde") or b.get("inicio") or b.get("hora_inicio")
                h = b.get("hasta") or b.get("fin") or b.get("hora_fin")
                if not d or not h:
                    continue
                flat.append({"dia_semana": dia, "desde": str(d), "hasta": str(h), "intervalo_min": intervalo_min})
        else:
            if activo is False:
                continue
            d = it.get("desde") or it.get("inicio") or it.get("hora_inicio")
            h = it.get("hasta") or it.get("fin") or it.get("hora_fin")
            if not d or not h:
                continue
            flat.append({"dia_semana": dia, "desde": str(d), "hasta": str(h), "intervalo_min": intervalo_min})
    return flat

# --- Endpoints ---

@router.get("/mis")
def list_mis_horarios(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    emp = _current_emprendedor(db, current_user)

    q = db.query(Horario).filter(getattr(Horario, EMP_ID_COL) == emp.id)
    # order_by flexible (si no existen columnas de tiempo, ordena por día solamente)
    order_cols = [getattr(Horario, DIA_COL)]
    if INICIO_COL:
        order_cols.append(getattr(Horario, INICIO_COL))
    q = q.order_by(*order_cols)

    rows = q.all()

    out = []
    for r in rows:
        dia_val = getattr(r, DIA_COL)
        inicio_val = _fmt_time(getattr(r, INICIO_COL)) if INICIO_COL else ""
        fin_val = _fmt_time(getattr(r, FIN_COL)) if FIN_COL else ""
        intervalo_val = int(getattr(r, INTERVALO_COL)) if (INTERVALO_COL and getattr(r, INTERVALO_COL) is not None) else 30

        out.append({
            "id": getattr(r, "id", None),
            "dia_semana": int(dia_val),
            "desde": inicio_val,
            "hasta": fin_val,
            "intervalo_min": intervalo_val,
            "activo": True,  # informativo
        })
    return out

def _replace_core(payload: Dict[str, Any], db: Session, current_user: Usuario):
    emp = _current_emprendedor(db, current_user)
    flat = _normalize_payload_to_flat_items(payload)

    # Borrar existentes
    db.query(Horario).filter(getattr(Horario, EMP_ID_COL) == emp.id).delete(synchronize_session=False)

    to_insert: List[Horario] = []
    for it in flat:
        try:
            dia = int(it["dia_semana"])
            d_time = _hhmm_to_time(it["desde"])
            h_time = _hhmm_to_time(it["hasta"])
            intervalo_min = int(it.get("intervalo_min", 30))

            data = {
                EMP_ID_COL: emp.id,
                DIA_COL: dia,
            }
            if INICIO_COL:
                data[INICIO_COL] = d_time
            if FIN_COL:
                data[FIN_COL] = h_time
            if INTERVALO_COL:
                data[INTERVALO_COL] = intervalo_min

            to_insert.append(Horario(**data))
        except Exception:
            # Si un item viene mal, lo salteamos sin romper todo
            continue

    if to_insert:
        db.bulk_save_objects(to_insert)
    db.commit()
    return {"ok": True, "items": len(to_insert)}

@router.post("/mis")
def replace_mis_horarios(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    """
    Reemplaza todos mis horarios. Acepta:
    - Plano: {"items":[{"dia_semana":1,"desde":"09:00","hasta":"13:00","intervalo_min":30}, ...]}
    - Agrupado: {"items":[{"dia_semana":1,"activo":true,"intervalo_min":30,"bloques":[{"desde":"09:00","hasta":"13:00"}]}]}
    """
    return _replace_core(payload, db, current_user)

@router.post("/mis:replace")
def replace_mis_horarios_alias(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return _replace_core(payload, db, current_user)
