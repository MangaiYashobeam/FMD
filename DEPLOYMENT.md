# FaceMyDealer - VPS Deployment Guide

## Deployment Options Comparison

| Feature | Railway (Current) | Railway + VPS | Single VPS |
|---------|------------------|---------------|------------|
| **Main App** | ✅ Works | ✅ Railway | ✅ VPS |
| **Workers** | ❌ Not supported | ✅ VPS | ✅ VPS |
| **Cost** | ~$20/mo | ~$25-40/mo | ~$20-40/mo |
| **Complexity** | Low | Medium | Low |
| **Scaling** | Auto | Manual workers | Manual |
| **SSL** | Auto | Mixed | Auto (Traefik) |

## Option 1: Single VPS Deployment (Recommended)

Everything runs on one VPS - simplest to manage.

### Recommended VPS Specs

| Workers | RAM | CPUs | Provider Examples |
|---------|-----|------|-------------------|
| 2 workers | 8GB | 4 | Hetzner CX41 (~$15/mo) |
| 4 workers | 16GB | 6 | Hetzner CX51 (~$30/mo) |
| 8 workers | 32GB | 8 | Hetzner CCX23 (~$50/mo) |

### Quick Start

```bash
# 1. SSH into your VPS
ssh root@your-vps-ip

# 2. Run setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/facemydealer/main/scripts/vps-setup.sh | sudo bash

# 3. Clone repository
git clone https://github.com/your-repo/facemydealer.git
cd facemydealer

# 4. Configure environment
cp .env.production.example .env
nano .env  # Edit with your values

# 5. Generate secure keys
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET  
openssl rand -hex 32  # ENCRYPTION_KEY

# 6. Start everything
docker compose -f docker-compose.production.yml up -d

# 7. View logs
docker compose -f docker-compose.production.yml logs -f
```

### DNS Configuration

Point your domain to the VPS:
```
A     @      YOUR_VPS_IP
A     www    YOUR_VPS_IP
A     api    YOUR_VPS_IP  (optional, same IP)
```

### Scaling Workers

```bash
# Scale to 4 workers
docker compose -f docker-compose.production.yml up -d --scale browser-worker=4

# Or edit .env
WORKER_REPLICAS=4
docker compose -f docker-compose.production.yml up -d
```

---

## Option 2: Railway + VPS Hybrid

Keep main app on Railway, run workers separately.

### Railway Setup

Your current setup stays the same:
- Main app on Railway
- Add Railway Redis plugin

```bash
# Add Redis to Railway
railway add -p redis
```

### VPS Worker Setup

```bash
# On VPS, only run workers
cd facemydealer/python-workers
cp .env.example .env

# Edit .env
DATABASE_URL=postgresql://... (from your database)
REDIS_URL=redis://... (from your Redis instance)
API_BASE_URL=https://dealersface.com

# Start workers only
docker-compose up -d
```

---

## Management Commands

### View Status
```bash
docker compose -f docker-compose.production.yml ps
```

### View Logs
```bash
# All services
docker compose -f docker-compose.production.yml logs -f

# Specific service
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs -f browser-worker
```

### Restart Services
```bash
# All
docker compose -f docker-compose.production.yml restart

# Specific
docker compose -f docker-compose.production.yml restart api
```

### Update Deployment
```bash
git pull
docker compose -f docker-compose.production.yml up -d --build
```

### Database Backup
```bash
docker compose -f docker-compose.production.yml exec postgres \
  pg_dump -U facemydealer facemydealer > backup_$(date +%Y%m%d).sql
```

### Database Restore
```bash
cat backup.sql | docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U facemydealer facemydealer
```

---

## Monitoring

### Built-in Health Checks

- **API Health**: `https://your-domain.com/health`
- **Worker API**: Internal port 8000
- **Traefik Dashboard**: `https://traefik.your-domain.com/dashboard/`

### Check Worker Status

```bash
# Redis queue status
docker compose -f docker-compose.production.yml exec redis redis-cli LLEN fmd:tasks:pending

# Worker logs
docker compose -f docker-compose.production.yml logs browser-worker --tail 100
```

---

## Troubleshooting

### Workers Not Starting
```bash
# Check shared memory
df -h /dev/shm

# Increase if needed (in docker-compose.production.yml)
shm_size: '4gb'
```

### Database Connection Issues
```bash
# Check postgres is healthy
docker compose -f docker-compose.production.yml exec postgres pg_isready

# Check connection from API
docker compose -f docker-compose.production.yml exec api \
  node -e "require('./dist/config/database').default.\$connect().then(() => console.log('OK'))"
```

### SSL Certificate Issues
```bash
# Check Traefik logs
docker compose -f docker-compose.production.yml logs traefik

# Force certificate renewal
docker compose -f docker-compose.production.yml exec traefik \
  rm /letsencrypt/acme.json
docker compose -f docker-compose.production.yml restart traefik
```

---

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Generate unique JWT secrets
- [ ] Configure `SUPER_ADMIN_IPS` with your IP
- [ ] Enable Traefik dashboard auth
- [ ] Set up automated backups
- [ ] Configure monitoring alerts
