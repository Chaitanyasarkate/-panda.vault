# 🐼 panda.vault

> **Client-Side Encrypted Zero-Knowledge Password Manager & Digital Vault with Manifest V3 Chrome Extension**

[![Tests](https://img.shields.io/badge/tests-68%20passing-brightgreen.svg)]()
[![Security](https://img.shields.io/badge/encryption-AES--256--GCM-gold.svg)]()
[![KDF](https://img.shields.io/badge/kdf-Argon2id%20%2B%20HKDF-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

---

## 🌟 Overview

**panda.vault** is an open-source, client-side encrypted password manager built with strict zero-knowledge principles. Master passwords and plaintext credentials **never leave your device**.

```text
User Master Password
        ↓
  Argon2id (hash-wasm WebAssembly)
        ↓
  Master Key (MK) ──► HKDF-SHA256 ──► Auth Key (AK) ──► Server (TLS)
        ↓
  Vault Master Key (VMK) [256-bit AES-GCM]
        ↓
  Encrypted Vault Ciphertext (PostgreSQL / SQLite)
```

---

## ✨ Features

- 🔐 **Zero-Knowledge Client-Side Encryption**: Argon2id KDF + HKDF key splitting + AES-256-GCM authenticated ciphertext.
- 🛡️ **Comprehensive Security Dashboard**: Real-time password health audit, weak/reused detection, age tracker, and security scoring calculated 100% locally in-browser.
- 🧩 **Chrome / Edge Manifest V3 Browser Extension**:
  - Auto-detects login forms on active web pages.
  - Strict eTLD+1 domain origin matching and phishing prevention.
  - Explicit user-controlled one-click autofill.
  - Built-in rejection-sampling password generator.
- ⏱️ **RFC 6238 TOTP 2FA Authenticator**: Built-in 30-second rotating two-factor codes.
- 🚀 **Production-Ready Deployment**:
  - Cloudflare Tunnel zero-trust ingress (0 exposed host ports).
  - Multi-stage non-root Docker container (`UID 10001`).
  - Automated AES-256 encrypted database backups.
  - Next.js 16 App Router + FastAPI + PostgreSQL.

---

## 📂 Project Structure

```text
├── backend/          # FastAPI REST API, Argon2id auth, rate limiting, and pytest suite
├── frontend/         # Next.js 16 web app, Web Crypto Web Workers, and Vitest suite
├── extension/        # Chrome/Chromium Manifest V3 browser extension
├── scripts/          # Encrypted backup/restore and secret generator utilities
├── docs/             # Deployment runbook, threat model, and security rules
└── docker-compose.prod.yml # Production isolated container topology
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)**.

### 3. Browser Extension (Chrome / Edge / Brave)
```bash
cd extension
npm install
npm run build
```
Load the `extension/dist` folder in `chrome://extensions` via **Load unpacked**.

---

## 🧪 Automated Test Suite (68 Tests Passing)

```bash
# Backend pytest suite (17 tests)
cd backend && pytest -v

# Frontend vitest suite (41 tests)
cd frontend && npx vitest run

# Extension vitest suite (10 tests)
cd extension && npx vitest run
```

---

## 🔒 Production Deployment

See the complete production runbook in [**`docs/DEPLOYMENT_GUIDE.md`**](docs/DEPLOYMENT_GUIDE.md).

---

## 📄 License

MIT License. Designed with security and privacy as the #1 priority.
