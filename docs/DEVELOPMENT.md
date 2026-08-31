# VaultX Development Guide - Phase 1

This guide covers setting up, running, and testing the initial development environment for **VaultX**.

---

## 1. System Requirements

- **Node.js**: v18+ (tested with v24.x) & npm
- **Python**: 3.11+ (tested with 3.14.x)
- **Docker & Docker Compose**: Optional for containerized PostgreSQL and backend
- **PostgreSQL**: 16+ (or via Docker Compose)

---

## 2. Project Architecture (Phase 1)

```
vaultx/
├── frontend/             # Next.js (App Router, TypeScript, Tailwind CSS)
├── backend/              # Python FastAPI + SQLAlchemy
├── docs/                 # Documentation (PROJECT_SPEC, SECURITY_RULES, DEVELOPMENT)
├── docker-compose.yml    # Container orchestration for PostgreSQL & FastAPI
├── .env.example          # Root environment template
└── README.md
```

---

## 3. Quick Start with Docker Compose

If Docker is running on your machine, you can spin up the entire backend and PostgreSQL database with:

```bash
docker compose up -d
```

This starts:
- **PostgreSQL Database** on `localhost:5432` (`vaultx_db`)
- **FastAPI Backend Server** on `localhost:8000`

---

## 4. Local Development Setup (Without Docker)

### A. Backend Setup

1. Open a terminal in `backend/`:
   ```bash
   cd backend
   python -m venv venv
   ```

2. Activate virtual environment:
   - **Windows (PowerShell)**: `.\venv\Scripts\Activate.ps1`
   - **Linux/macOS**: `source venv/bin/activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt pytest-asyncio aiosqlite email-validator
   ```

4. Configure environment:
   ```bash
   cp .env.example .env
   ```

5. Run FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - API Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/health`

### B. Frontend Setup

1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```

3. Run Next.js development server:
   ```bash
   npm run dev
   ```
   - Application URL: `http://localhost:3000`

---

## 5. Automated Testing

### Running Backend Tests
From the `backend/` directory:
```bash
python -m pytest
```

### Running Frontend Tests
From the `frontend/` directory:
```bash
npx vitest run
```

### Building Frontend
```bash
npm run build
```

---

## 6. Health & Connectivity Verification

- **FastAPI Health Endpoint**:
  ```bash
  curl http://localhost:8000/health
  ```
  Expected Response:
  ```json
  {
    "status": "ok",
    "service": "VaultX",
    "database": "connected",
    "environment": "development",
    "phase": "Phase 1 - Initial Environment"
  }
  ```
- **Interactive API Documentation**: Visit `http://localhost:8000/docs` in your browser.
