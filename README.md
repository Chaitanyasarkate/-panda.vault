# 🐼 panda.vault

> **Client-Side Encrypted Zero-Knowledge Password Manager & Digital Vault with Manifest V3 Chrome Extension**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-panda--vault.onrender.com-brightgreen?style=for-the-badge&logo=render)](https://panda-vault.onrender.com)
[![Backend API](https://img.shields.io/badge/API%20Docs-panda--vault--backend.onrender.com-blue?style=for-the-badge&logo=fastapi)](https://panda-vault-backend.onrender.com/docs)
[![CI Security & Tests](https://img.shields.io/badge/CI%20Suite-68%20Passing-brightgreen?style=for-the-badge&logo=githubactions)](https://github.com/Chaitanyasarkate/-panda.vault/actions)
[![Security Architecture](https://img.shields.io/badge/Encryption-AES--256--GCM%20%7C%20Argon2id-gold?style=for-the-badge)](https://panda-vault.onrender.com)

---

## 🌐 Live Deployment & Links

| Service | Live URL | Description |
| :--- | :--- | :--- |
| 🚀 **Web Application** | [**https://panda-vault.onrender.com**](https://panda-vault.onrender.com) | Next.js 16 Client-Side Encrypted Web Dashboard |
| ⚡ **Backend API** | [**https://panda-vault-backend.onrender.com**](https://panda-vault-backend.onrender.com) | FastAPI REST API & Async PostgreSQL Engine |
| 📚 **Interactive Swagger Docs** | [**https://panda-vault-backend.onrender.com/docs**](https://panda-vault-backend.onrender.com/docs) | OpenAPI Interactive Endpoint Documentation |
| 🩺 **Health Check** | [**https://panda-vault-backend.onrender.com/health**](https://panda-vault-backend.onrender.com/health) | Uptime & Database Connectivity Probe |

---

## 🌟 Overview

**panda.vault** is an open-source, client-side encrypted password manager built on strict zero-knowledge principles. Your master password and plaintext vault items **never leave your device or touch the server unencrypted**.

```text
User Master Password + Email Salt
        ↓
  Argon2id (hash-wasm WebAssembly KDF)
        ↓
  Master Key (MK)
   ├──► HKDF-SHA256 (Info: "auth") ──► Auth Key (AK) ──► Server Auth (TLS)
   └──► HKDF-SHA256 (Info: "enc")  ──► Decrypts Vault Master Key (VMK)
                                            ↓
                                       AES-256-GCM
                                            ↓
                             Encrypted Vault Ciphertext (PostgreSQL)
```

---

## ✨ Key Features

- 🔐 **Zero-Knowledge Client-Side Encryption**: Argon2id KDF + HKDF-SHA256 key splitting + AES-256-GCM authenticated ciphertext.
- 🛡️ **Local Password Security Audit**: In-browser password health scoring, reused/weak password detection, and age analytics calculated 100% locally.
- 🧩 **Chrome & Edge Manifest V3 Extension**:
  - Auto-detects credential inputs on active browser tabs.
  - Strict eTLD+1 domain origin matching for robust phishing prevention.
  - Explicit user-controlled one-click autofill into login forms.
  - Rejection-sampling cryptographic password generator.
  - In-memory Master Key caching with auto-lock timers.
- ⏱️ **RFC 6238 TOTP Authenticator**: Built-in rotating 30-second two-factor code generator.
- 🚀 **1-Click Render Cloud Deployment**: Automated deployment blueprint (`render.yaml`) provisioning PostgreSQL, FastAPI, and Next.js.
- 🧪 **Enterprise Test Suite**: 68 automated unit, cryptographic, and integration tests across Backend (Pytest), Frontend (Vitest), and Extension (Vitest).

---

## 📂 Project Structure

```text
├── backend/                  # FastAPI REST API, Argon2id auth, rate limiting, and pytest suite
│   ├── app/                  # Application core, models, endpoints, and schemas
│   ├── tests/                # 17 backend security & CRUD pytest test cases
│   └── requirements.txt      # Python dependencies (FastAPI, SQLAlchemy, Argon2, Bandit)
├── frontend/                 # Next.js 16 App Router web app, Web Crypto workers, Vitest
│   ├── src/app/              # Next.js App Router pages and layouts
│   ├── src/lib/crypto/       # Zero-knowledge cryptographic engine & security auditors
│   └── src/lib/crypto/__tests__/ # 41 frontend crypto & TOTP unit tests
├── extension/                # Chrome/Edge Manifest V3 browser extension
│   ├── src/background/       # Background service worker with in-memory key storage
│   ├── src/content/          # DOM input detector & secure autofill injector
│   ├── src/popup/            # Extension UI popup built with React 19 & Tailwind CSS
│   └── src/__tests__/        # 10 origin-matching & extension crypto tests
├── .github/workflows/ci.yml  # Automated GitHub Actions CI test & security audit pipeline
└── render.yaml               # 1-Click Render Blueprint for DB, backend, and frontend
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend Service (FastAPI)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate      # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Web Application (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Browser Extension (Chrome / Edge / Brave)
```bash
cd extension
npm install
npm run build
```
1. Open your browser and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. Pin the **panda.vault** extension to your toolbar.

---

## 🧪 Automated Test Suite (68 Tests Passing)

```bash
# 1. Backend Pytest Suite (17 tests) + Bandit Security Scan
cd backend
python -m pytest -v

# 2. Frontend Vitest Suite (41 tests)
cd frontend
npx vitest run

# 3. Extension Vitest Suite (10 tests)
cd extension
npx vitest run
```

---

## ☁️ Deploying to Render

This repository includes a `render.yaml` Blueprint for automated deployment:

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Blueprint**.
3. Select your repository: `https://github.com/Chaitanyasarkate/-panda.vault.git`.
4. Render will automatically provision and connect:
   - **PostgreSQL Database** (`panda-vault-db`)
   - **FastAPI Web Service** (`panda-vault-backend`)
   - **Next.js Web Service** (`panda-vault`)
5. Click **Apply**.

---

## 🔒 Security & Threat Model

- **Zero-Knowledge Guarantee**: Master passwords never touch server RAM or persistent disks.
- **Argon2id Memory Hardening**: WebAssembly-powered key derivation resists GPU/ASIC brute-force attacks.
- **Authenticated Encryption**: All item payloads are encrypted with unique 96-bit random IVs and AES-256-GCM authentication tags.
- **Strict Content-Security-Policy (CSP)**: Hardened headers with `wasm-unsafe-eval` for client-side WASM crypto, blocking unauthorized scripts and cross-site exfiltration.

---

## 📄 License

MIT License. Designed with privacy, zero-knowledge security, and reliability as top priorities.
