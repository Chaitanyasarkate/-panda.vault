# 🐼 panda.vault — Production Deployment Guide (Render)

This guide documents the complete, step-by-step production deployment of **panda.vault** on **Render** using a Zero-Knowledge, high-security architecture.

---

## 1. Production Architecture on Render

```text
               Internet Client (Browser / Extension)
                                │
                                ▼ HTTPS (TLS 1.3)
   ┌─────────────────────────────────────────────────────────┐
   │                     Render Cloud                        │
   │                                                         │
   │  ┌────────────────────────┐    ┌─────────────────────┐  │
   │  │ Frontend Web Service   │    │ Backend Web Service │  │
   │  │ (Next.js 16 UI)        │───►│ (FastAPI REST API)  │  │
   │  │ panda-vault-frontend   │    │ panda-vault-backend │  │
   │  └────────────────────────┘    └──────────┬──────────┘  │
   │                                           │             │
   │                                           │ Internal    │
   │                                           │ Network     │
   │                                           ▼             │
   │                                ┌─────────────────────┐  │
   │                                │ Managed PostgreSQL  │  │
   │                                │ (panda-vault-db)    │  │
   │                                └─────────────────────┘  │
   └─────────────────────────────────────────────────────────┘
```

---

## 2. Step 1: Provision PostgreSQL Database on Render

1. Log in to your **[Render Dashboard](https://dashboard.render.com)**.
2. Click **New +** $\rightarrow$ **PostgreSQL**.
3. Configure the database:
   - **Name**: `panda-vault-db`
   - **Database**: `panda_vault_db`
   - **User**: `panda_vault_db_user`
   - **Region**: Choose the region closest to you (e.g. Singapore, Oregon, Frankfurt).
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g. `postgresql://panda_vault_db_user:PASSWORD@dpg-xxxxxx-a/panda_vault_db`).

---

## 3. Step 2: Deploy Backend Web Service (FastAPI)

1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository: `https://github.com/Chaitanyasarkate/-panda.vault`.
3. Configure settings:
   - **Name**: `panda-vault-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | **`DATABASE_URL`** | *(Paste your PostgreSQL URL from Step 1)* |
   | **`ENVIRONMENT`** | `production` |
   | **`JWT_SECRET`** | *(Generate a random 64-char string)* |
   | **`PEPPER_SECRET`** | *(Generate a random 64-char string)* |
   | **`COOKIE_SECURE`** | `true` |
5. Click **Create Web Service**.
6. Copy your backend URL once live: (e.g. `https://panda-vault-backend.onrender.com`).

---

## 4. Step 3: Deploy Frontend Web Service (Next.js)

1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect the same GitHub repository: `https://github.com/Chaitanyasarkate/-panda.vault`.
3. Configure settings:
   - **Name**: `panda-vault-frontend`
   - **Root Directory**: `frontend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | **`NEXT_PUBLIC_API_URL`** | `https://panda-vault-backend.onrender.com` |
   | **`NODE_ENV`** | `production` |
5. Click **Create Web Service**.
6. Open your live frontend URL (e.g. `https://panda-vault-frontend.onrender.com`).

---

## 5. Step 4: Verification & Health Checks

1. Verify backend health endpoint:
   ```bash
   curl -i https://panda-vault-backend.onrender.com/health
   ```
   *Expected Response:*
   ```json
   {
     "status": "healthy"
   }
   ```
2. Navigate to your frontend URL in the browser, register your account, and verify that your zero-knowledge encrypted vault unlocks smoothly!
