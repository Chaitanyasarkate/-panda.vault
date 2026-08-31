#!/usr/bin/env python3
"""
panda.vault Production Secrets Generator
Generates high-entropy CSPRNG keys for .env.production
"""
import secrets

def generate_production_env():
    jwt_secret = secrets.token_urlsafe(64)
    pepper_secret = secrets.token_urlsafe(64)
    db_password = secrets.token_urlsafe(32)

    template = f"""# ==========================================================
# panda.vault Production Environment Configuration
# Generated with CSPRNG via scripts/generate_secrets.py
# NEVER COMMIT THIS FILE TO VERSION CONTROL
# ==========================================================

ENVIRONMENT=production

# Database (PostgreSQL)
POSTGRES_SERVER=db
POSTGRES_PORT=5432
POSTGRES_USER=pandavault_admin
POSTGRES_PASSWORD={db_password}
POSTGRES_DB=pandavault_production

# Backend Security
JWT_SECRET={jwt_secret}
PEPPER_SECRET={pepper_secret}
COOKIE_SECURE=true

# Frontend Integration
FRONTEND_URL=https://vault.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Cloudflare Tunnel Token (From Cloudflare Zero Trust Dashboard)
CLOUDFLARE_TUNNEL_TOKEN=
"""
    print(template)

if __name__ == "__main__":
    generate_production_env()
