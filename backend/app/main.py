import os
import logging
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from .database import Base, engine
from .routers import usuarios, emprendedores, servicios, horarios, turnos, publico

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | turnera.app | %(message)s")

app = FastAPI(title="Turnera API (Rescate)", version="1.0")

# ===== CORS =====
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== DB startup =====
@app.on_event("startup")
def on_startup():
    logging.info("SQLite dev engine para create_all: %s", os.getenv("DATABASE_URL", "sqlite:///./dev.db"))
    Base.metadata.create_all(bind=engine)
    logging.info("Tablas listas (SQLite desarrollo).")

# ===== Routers API =====
app.include_router(usuarios.router)
app.include_router(emprendedores.router)
app.include_router(servicios.router)
app.include_router(horarios.router)
app.include_router(turnos.router)
app.include_router(publico.router)

# ===== Health simples =====
@app.get("/healthz")
def healthz():
    return {"ok": True, "service": "turnera-api"}

# ===== SPA (Front estático + fallback) =====
# Ajustá esta ruta al build del front (Vite): ../frontend/dist
FRONT_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
INDEX_HTML = FRONT_DIST / "index.html"

# Sirve assets /assets/* si existe el build
if FRONT_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONT_DIST / "assets"), name="assets")

# Prefijos que NO deben hacer fallback (rutas API/estáticos)
API_PREFIXES = (
    "/openapi.json", "/docs", "/redoc",
    "/usuarios", "/servicios", "/turnos", "/horarios",
    "/emprendedores", "/reservas", "/static", "/assets",
    "/healthz"
)

@app.get("/{full_path:path}")
def spa_fallback(request: Request, full_path: str):
    # Si es una ruta de API/estático: devolvemos 404 real
    if any(request.url.path.startswith(p) for p in API_PREFIXES):
        raise HTTPException(status_code=404, detail="Not Found")
    # Si existe el build, devolvemos index.html para que React Router resuelva
    if INDEX_HTML.exists():
        return FileResponse(INDEX_HTML)
    # En dev sin build: mensaje claro
    return {"detail": "SPA fallback: generá el build del front (vite build) o corré el front dev server."}
