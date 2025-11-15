# Deployment Guide

Guide for deploying the UWG Engine to production.

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Nginx     │
│   Reverse   │
│   Proxy     │
└──────┬──────┘
       │
       ├─────────────────┐
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  API Server │   │  UI (React) │
│  (Node.js)  │   │  (Static)   │
└──────┬──────┘   └─────────────┘
       │
       ▼
┌─────────────┐
│   SQLite    │
│  Database   │
└─────────────┘
```

## Prerequisites

- Node.js 18+
- Nginx (or similar reverse proxy)
- PM2 (process manager)
- Domain name with SSL certificate

## Build

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build UI
cd packages/ui && npm run build
```

## Configuration

### Environment Variables

Create `.env.production`:

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_PATH=/var/lib/uwg/uwg.db

# CORS
CORS_ORIGIN=https://yourdomain.com

# Connectors
SLACK_BOT_TOKEN=xoxb-...
ANTHROPIC_API_KEY=sk-ant-...
WEBFLOW_API_KEY=...
NETLIFY_SITE_ID=...

# Security
WEBHOOK_SECRET=<random-secret>

# Logging
LOG_LEVEL=info
```

### Database Initialization

```bash
# Create database directory
sudo mkdir -p /var/lib/uwg
sudo chown $USER:$USER /var/lib/uwg

# Initialize database (will be created on first run)
node packages/api/dist/server.js
```

## Deployment

### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start API server
pm2 start packages/api/dist/server.js --name uwg-api

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY turbo.json ./

RUN npm install
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "packages/api/dist/server.js"]
```

Build and run:

```bash
docker build -t uwg-engine .
docker run -d \
  -p 3000:3000 \
  -v /var/lib/uwg:/app/data \
  --env-file .env.production \
  --name uwg-api \
  uwg-engine
```

### Option 3: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env.production
    restart: unless-stopped

  ui:
    image: nginx:alpine
    ports:
      - "3001:80"
    volumes:
      - ./packages/ui/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    restart: unless-stopped
```

Run:

```bash
docker-compose up -d
```

## Nginx Configuration

Create `/etc/nginx/sites-available/uwg`:

```nginx
upstream api {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # API
    location /api {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # UI
    location / {
        root /var/www/uwg/ui;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/uwg /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate

Using Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Monitoring

### PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs uwg-api

# Restart
pm2 restart uwg-api
```

### Health Checks

Set up health check monitoring:

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3000/health || systemctl restart uwg-api
```

### Logging

Configure log rotation:

```bash
# /etc/logrotate.d/uwg
/var/log/uwg/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

## Backup

### Database Backup

```bash
#!/bin/bash
# backup-uwg.sh

BACKUP_DIR=/var/backups/uwg
DB_PATH=/var/lib/uwg/uwg.db
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/uwg-$DATE.db'"

# Compress
gzip $BACKUP_DIR/uwg-$DATE.db

# Keep only last 30 days
find $BACKUP_DIR -name "uwg-*.db.gz" -mtime +30 -delete

echo "Backup completed: uwg-$DATE.db.gz"
```

Add to crontab:

```bash
0 2 * * * /usr/local/bin/backup-uwg.sh
```

## Security Checklist

- [ ] Enable HTTPS with valid SSL certificate
- [ ] Set up firewall (ufw/iptables)
- [ ] Implement API authentication
- [ ] Rate limiting enabled
- [ ] Database file permissions (chmod 600)
- [ ] Environment variables secured
- [ ] Regular security updates
- [ ] Webhook signature verification
- [ ] Input validation on all endpoints

## Performance Tuning

### Node.js

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" pm2 start ...
```

### Database

```sql
-- Optimize SQLite
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=MEMORY;
```

### Caching

Add Redis for execution caching:

```typescript
import Redis from 'ioredis';

const redis = new Redis();

// Cache execution results
await redis.setex(`exec:${runId}`, 3600, JSON.stringify(report));
```

## Scaling

### Horizontal Scaling

For high traffic, run multiple API instances behind load balancer:

```nginx
upstream api {
    least_conn;
    server api1.internal:3000;
    server api2.internal:3000;
    server api3.internal:3000;
}
```

### Database

Migrate from SQLite to PostgreSQL for better concurrency:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});
```

## Troubleshooting

### API Won't Start

```bash
# Check logs
pm2 logs uwg-api --lines 100

# Check port
lsof -i :3000

# Check environment
pm2 env uwg-api
```

### High Memory Usage

```bash
# Monitor
pm2 monit

# Restart if needed
pm2 restart uwg-api
```

### Database Locked

```bash
# Check processes
lsof /var/lib/uwg/uwg.db

# Kill blocking process
kill -9 <PID>
```

## Updates

```bash
# Pull latest code
git pull origin main

# Rebuild
npm run build

# Restart
pm2 restart uwg-api
```
