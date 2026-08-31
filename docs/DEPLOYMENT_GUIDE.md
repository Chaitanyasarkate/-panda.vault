# panda.vault — Production Deployment & Security Runbook

This guide documents the step-by-step production deployment of **panda.vault** following a Zero-Knowledge, Zero-Trust architecture.

---

## 1. Production Architecture Overview

```text
  Internet Client (Browser / Extension)
               │
               ▼ HTTPS (TLS 1.3 Strict)
  ┌─────────────────────────────────────────┐
  │            Cloudflare Edge              │
  │  - WAF & DDoS Shield                    │
  │  - DNS & SSL Termination                │
  └────────────┬────────────────────────────┘
               │
       ┌───────┴────────────────────────────┐
       │                                    │
       ▼                                    ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Vercel (Frontend)     │   │     Cloudflare Tunnel     │
│ - Next.js 16 (App Router) │   │ (cloudflared daemon)      │
│ - Zero-Knowledge Crypto   │   │ (Zero inbound open ports) │
│ - Security Headers & CSP  │   └─────────────┬─────────────┘
└──────────────┬────────────┘                 │
               │ HTTPS API Requests           │ Private VPC
               └─────────────────────────────►│
                                              ▼
                                ┌───────────────────────────┐
                                │   VPS (Docker Compose)    │
                                │   ┌─────────────────────┐ │
                                │   │ FastAPI Backend     │ │
                                │   │ (Non-root UID 10001)│ │
                                │   └──────────┬──────────┘ │
                                │              │ Internal   │
                                │              │ Network    │
                                │              ▼            │
                                │   ┌─────────────────────┐ │
                                │   │ PostgreSQL 16 (DB)  │ │
                                │   │ (0 host open ports) │ │
                                │   └─────────────────────┘ │
                                └───────────────────────────┘
```

---

## 2. Step 1: Generate High-Entropy Production Secrets

Run the built-in cryptographic secret generator on your local machine:

```bash
python scripts/generate_secrets.py > .env.production
```

This populates `.env.production` with 256-bit CSPRNG tokens:
- `JWT_SECRET`: Used for short-lived session signing
- `PEPPER_SECRET`: Used for anti-enumeration dummy salts
- `POSTGRES_PASSWORD`: High-entropy database credential

> [!CAUTION]
> **NEVER** commit `.env.production` to GitHub. Store a copy in a secure offline location.

---

## 3. Step 2: Deploy Frontend on Vercel

1. Import your GitHub repository into **Vercel** (`https://vercel.com`).
2. Set **Root Directory** to `frontend`.
3. In **Environment Variables**, add:
   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```
4. Click **Deploy**. Vercel will automatically build and serve the zero-knowledge frontend with global CDN edge caching.
5. In **Custom Domains**, add your frontend domain (e.g., `vault.yourdomain.com`).

---

## 4. Step 3: Deploy Backend & Isolated Database on VPS

1. SSH into your VPS (Ubuntu 22.04 / 24.04 recommended):
   ```bash
   ssh root@your-vps-ip
   ```
2. Install Docker and Docker Compose:
   ```bash
   apt-get update && apt-get install -y docker.io docker-compose-v2
   systemctl enable --now docker
   ```
3. Clone the repository on the VPS:
   ```bash
   git clone https://github.com/your-username/pandavault.git /opt/pandavault
   cd /opt/pandavault
   ```
4. Copy your generated `.env.production` to `/opt/pandavault/.env.production`.
5. Start the production cluster:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
6. Verify containers are running and healthy:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

---

## 5. Step 4: Configure Cloudflare Tunnel (Zero Open Inbound Ports)

Using Cloudflare Tunnel allows your VPS firewall to block **all inbound ports (including 80 and 443)**, exposing the API strictly through Cloudflare's secure edge.

1. In the **Cloudflare Zero Trust Dashboard** (`https://one.dash.cloudflare.com`):
   - Go to **Networks** $\rightarrow$ **Tunnels**.
   - Click **Create a Tunnel** (select `Cloudflared`).
   - Name it `pandavault-api`.
2. Copy the **Tunnel Token** provided in the dashboard.
3. In `/opt/pandavault/.env.production`, set:
   ```env
   CLOUDFLARE_TUNNEL_TOKEN=your_token_here
   ```
4. In the Cloudflare Tunnel configuration tab:
   - **Public Hostname**: `api.yourdomain.com`
   - **Service Type**: `HTTP`
   - **URL**: `backend:8000`
5. Restart the compose stack:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```
6. On your VPS firewall (UFW), ensure all ports except SSH (22) are closed:
   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp
   ufw enable
   ```

---

## 6. Step 5: Configure Automated Encrypted Backups

Set up an automated daily cron job on the VPS to dump and AES-256 encrypt PostgreSQL:

1. Make scripts executable:
   ```bash
   chmod +x /opt/pandavault/scripts/*.sh
   ```
2. Open crontab:
   ```bash
   crontab -e
   ```
3. Add a daily backup rule at 02:00 AM:
   ```cron
   0 2 * * * BACKUP_ENCRYPTION_KEY="your-strong-backup-passphrase" /opt/pandavault/scripts/backup.sh >> /var/log/pandavault_backup.log 2>&1
   ```

To test restoring a backup:
```bash
BACKUP_ENCRYPTION_KEY="your-strong-backup-passphrase" /opt/pandavault/scripts/restore.sh /var/backups/pandavault/pandavault_backup_TIMESTAMP.sql.gz.enc
```

---

## 7. Step 6: Verification & Health Checks

1. Verify backend health endpoint:
   ```bash
   curl -i https://api.yourdomain.com/health
   ```
   *Expected Response:*
   ```json
   {
     "status": "ok",
     "service": "panda.vault",
     "database": "connected",
     "database_engine": "postgresql",
     "environment": "production",
     "phase": "Production Ready"
   }
   ```
2. Navigate to `https://vault.yourdomain.com` and register a new production account.
3. Add a test credential, refresh the page, unlock the vault, and verify that credentials decrypt cleanly.
4. Load the browser extension, connect it to your production API URL, and verify autofill works.
