# Deployment Guide

This guide covers deploying to a DigitalOcean Droplet with Docker.

## Prerequisites

- DigitalOcean Droplet (Ubuntu with Docker pre-installed)
- Domain pointing to your Droplet IP
- SSH access to the server

## Initial Server Setup

### 1. SSH into your server

```bash
ssh root@your-server-ip
```

### 2. Configure firewall

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

### 3. Clone the repository

```bash
cd /opt
git clone https://github.com/your-username/your-repo.git ailiens
cd ailiens
```

### 4. Create environment file

```bash
cp .env.example .env
nano .env
```

Configure these required variables:

```env
# Domain
DOMAIN=yourdomain.com
ACME_EMAIL=your-email@example.com

# Database
POSTGRES_PASSWORD=your-secure-db-password

# Redis
REDIS_PASSWORD=your-secure-redis-password

# App Security
SECRET_KEY=your-256-bit-secret-key

# AI
OPENAI_API_KEY=sk-your-openai-key

# Traefik Dashboard (generate with: htpasswd -nb admin password | sed 's/\$/\$\$/g')
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$...escaped-hash...
```

### 5. Initial deployment

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 6. Run database migrations

```bash
docker exec -it personal_automations_backend alembic upgrade head
```

### 7. Create admin user

```bash
docker exec -it personal_automations_backend personal_automations user create-admin
```

## Updating the Deployment

When you have new code changes to deploy:

```bash
# Navigate to project
cd /opt/ailiens

# Pull latest code
git pull

# Rebuild and restart containers
docker compose -f docker-compose.prod.yml up -d --build

# Run any new migrations
docker exec -it personal_automations_backend alembic upgrade head
```

## Useful Commands

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs --tail 100

# Specific service
docker logs personal_automations_backend --tail 100

# Follow logs in real-time
docker logs -f personal_automations_backend
```

### Check container status

```bash
docker ps
```

### Restart a specific service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Stop all services

```bash
docker compose -f docker-compose.prod.yml down
```

### Access database directly

```bash
docker exec -it personal_automations_db psql -U postgres -d personal_automations
```

### Run CLI commands

```bash
docker exec -it personal_automations_backend personal_automations --help
docker exec -it personal_automations_backend personal_automations user list
```

## Traefik Dashboard

Access at: `https://traefik.yourdomain.com`

Generate credentials:
```bash
htpasswd -nb admin your-password | sed 's/\$/\$\$/g'
```

Add to `.env` as `TRAEFIK_DASHBOARD_AUTH`, then restart Traefik:
```bash
docker compose -f docker-compose.prod.yml restart traefik
```

## SSL Certificates

Traefik automatically provisions SSL certificates via Let's Encrypt. Certificates are stored in the `traefik_letsencrypt` volume.

## Troubleshooting

### Container won't start
```bash
docker logs personal_automations_backend
```

### Database connection issues
```bash
# Check if db is healthy
docker ps | grep db

# Check db logs
docker logs personal_automations_db
```

### Migration errors
```bash
# Check current migration state
docker exec -it personal_automations_backend alembic current

# View migration history
docker exec -it personal_automations_backend alembic history
```

