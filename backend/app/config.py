# app/config.py
import os
from pathlib import Path
from datetime import timedelta

# === Paths base ===
BASE_DIR = Path(__file__).resolve().parent.parent  # carpeta /backend
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"
LOGOS_DIR = UPLOADS_DIR / "logos"
AVATARS_DIR = UPLOADS_DIR / "avatars"

for d in (DATA_DIR, UPLOADS_DIR, LOGOS_DIR, AVATARS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# === DB ===
# Si ya tenés database.db en la raíz del backend, esto lo respeta.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'database.db'}")

# === Auth/JWT ===
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# === CORS (Vite/Local) ===
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
