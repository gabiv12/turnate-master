# app/routers/horarios.py
from __future__ import annotations
from typing import Any, Dict, List
from datetime import time as dt_time
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app import models

router = APIRouter(prefix="/horarios", tags=["horarios"])

# ---------- helpers ----------
def _norm_dia(v: Any) -> int:
    try:
        n = int(v)
    except Exception:
        n = 0
    if 0 <= n <= 6:
        return n
    if 1 <= n <= 7:
        return n % 7
    return 0

def _hhmm(s: Any) -> str:
    if not s:
        return "09:00"
    parts = str(s).split(":")
    h = parts[0].zfill(2)
    m = (parts[1] if len(parts) > 1 else "00").zfill(2)
    return f"{h}:{m}"

def _to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)

def _to_time(hhmm: str) -> dt_time:
    h, m = hhmm.split(":")
    return dt_time(hour=int(h), minute=int(m))

def _get_owner_emprendedor(db: Session, user_id: int) -> models.Emprendedor:
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == user_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Emprendedor no activado")
    return emp

def _row_base(dia: int, intervalo: int = 30) -> Dict[str, Any]:
    return {"dia_semana": _norm_dia(dia), "intervalo_min": int(intervalo or 30), "bloques": []}

# ---------- GET ----------
@router.get("/mis")
def get_mis_horarios(db: Session = Depends(get_db), user=Depends(get_current_user)):
    emp = _get_owner_emprendedor(db, user.id)

    filas = (
        db.query(models.Horario)
        .filter(models.Horario.emprendedor_id == emp.id)
        .order_by(models.Horario.dia_semana.asc(), models.Horario.inicio.asc())
        .all()
    )

    base: Dict[int, Dict[str, Any]] = {i: _row_base(i, 30) for i in [0,1,2,3,4,5,6]}
    for r in filas:
        d = _norm_dia(r.dia_semana)
        base[d]["bloques"].append({
            "desde": _hhmm(r.inicio.strftime("%H:%M")),
            "hasta": _hhmm(r.fin.strftime("%H:%M")),
        })

    order = [1,2,3,4,5,6,0]
    items = []
    for i in order:
        row = base[i]
        if not row.get("intervalo_min"):
            row["intervalo_min"] = 30
        items.append(row)

    return {"items": items}

# ---------- POST (reemplazo total) ----------
@router.post("/mis", status_code=200)
async def replace_mis_horarios(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    Acepta:
      - Plano: [ { dia_semana|dia|weekday, desde|inicio, hasta|fin, intervalo_min|intervalo } ... ]
      - Agrupado:
        { items: [ { dia_semana|dia|weekday, activo, intervalo_min|intervalo, bloques:[{desde|inicio, hasta|fin}] } ] }
      - {bloques:[...]} o lista directa.
    Tolera cuerpo como string JSON (doble-serializado). Si no quedan bloques válidos, limpia agenda y responde 200.
    """
    emp = _get_owner_emprendedor(db, user.id)

    # 1) Leer el cuerpo sin tipado
    try:
        body: Any = await request.json()
    except Exception:
        body = None

    # 2) Si vino como string JSON, parsear
    if isinstance(body, str):
        txt = body.strip()
        try:
            body = json.loads(txt)
        except Exception:
            # Si es string no-json, lo tratamos como vacío => limpiar
            body = []

    def as_list(x): return x if isinstance(x, list) else []

    # 3) Unificar "items" candidates
    items_any: List[Dict[str, Any]] = []
    if isinstance(body, dict) and isinstance(body.get("items"), list):
        items_any = body["items"]
    elif isinstance(body, dict) and isinstance(body.get("bloques"), list):
        items_any = body["bloques"]
    elif isinstance(body, list):
        items_any = body
    else:
        items_any = []

    # 4) Normalizar a lista plana de bloques
    planos: List[Dict[str, Any]] = []

    if items_any and isinstance(items_any[0], dict) and "bloques" in items_any[0]:
        # agrupado
        for it in items_any:
            if not isinstance(it, dict): 
                continue
            dia = _norm_dia(it.get("dia_semana", it.get("dia", it.get("weekday", 0))))
            intervalo = int(it.get("intervalo_min", it.get("intervalo", 30)) or 30)
            activo = it.get("activo", True) is not False
            if not activo:
                continue
            for b in as_list(it.get("bloques")):
                d_raw = b.get("desde", b.get("inicio"))
                h_raw = b.get("hasta", b.get("fin"))
                d = _hhmm(d_raw)
                h = _hhmm(h_raw)
                if _to_minutes(d) >= _to_minutes(h):
                    continue
                planos.append({
                    "dia_semana": dia,
                    "desde": d, "hasta": h,
                    "intervalo_min": intervalo,
                })
    else:
        # plano
        for r in as_list(items_any):
            if not isinstance(r, dict):
                continue
            dia = _norm_dia(r.get("dia_semana", r.get("dia", r.get("weekday", 0))))
            intervalo = int(r.get("intervalo_min", r.get("intervalo", 30)) or 30)
            d = _hhmm(r.get("desde", r.get("inicio")))
            h = _hhmm(r.get("hasta", r.get("fin")))
            if not d or not h:
                continue
            if _to_minutes(d) >= _to_minutes(h):
                continue
            planos.append({
                "dia_semana": dia,
                "desde": d, "hasta": h,
                "intervalo_min": intervalo,
            })

    # 5) Reemplazo total (si queda vacío, limpia)
    try:
        db.query(models.Horario).filter(models.Horario.emprendedor_id == emp.id).delete(synchronize_session=False)
        for r in planos:
            db.add(models.Horario(
                emprendedor_id=emp.id,
                dia_semana=_norm_dia(r["dia_semana"]),
                inicio=_to_time(r["desde"]),
                fin=_to_time(r["hasta"]),
            ))
        db.commit()
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudieron guardar los horarios: {ex}")

    return get_mis_horarios(db=db, user=user)
