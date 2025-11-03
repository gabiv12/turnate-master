git clone https://github.com/gabiv12/turnate-master.git
cd turnate-master
🔹 2. Configurar el entorno del backend (FastAPI)
Crear y activar entorno virtual
bash
Copiar código
cd backend
python -m venv venv
venv\Scripts\activate     # En Windows
# source venv/bin/activate  # En Linux / macOS
Instalar dependencias
bash
Copiar código
pip install -r requirements.txt
Ejecutar el servidor
bash
Copiar código
uvicorn app.main:app --reload
El backend se ejecutará por defecto en:
👉 http://127.0.0.1:8000

🔹 3. Configurar el entorno del frontend (React)
bash
Copiar código
cd frontend
npm install
npm start
El frontend se ejecutará por defecto en:
👉 http://localhost:3000

⚙️ Variables de entorno
Crea un archivo .env tanto en el backend como en el frontend según sea necesario.

Ejemplo .env (backend)
bash
Copiar código
DATABASE_URL=sqlite:///./dev.db
SECRET_KEY=tu_clave_secreta
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
Ejemplo .env (frontend)
bash
Copiar código
REACT_APP_API_URL=http://127.0.0.1:8000
🧠 Scripts útiles
Backend
bash
Copiar código
# Ejecutar el servidor FastAPI
uvicorn app.main:app --reload

# Ejecutar script de creación de admin
python app/scripts/crear_admin.py
Frontend
bash
Copiar código
# Ejecutar modo desarrollo
npm start