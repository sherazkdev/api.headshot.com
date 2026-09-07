# Headshot API — VPS Deploy Guide (PM2 + Nginx + SSL)

Ek bar setup, phir sirf `git pull` + `bash deploy/deploy.sh`.

---

## 0) Requirements

| Cheez | Version |
|-------|---------|
| Node.js | 20+ |
| MongoDB | running (local ya Atlas) |
| PM2 | `npm i -g pm2` |
| Nginx | tumhari existing install |
| Domain (SSL ke liye) | DNS → VPS IP |

App folder: `~/headshot-api`

---

## 1) Code clone + build (ek bar)

```bash
cd ~
git clone https://github.com/sherazkdev/api.headshot.com.git headshot-api
cd headshot-api
bash deploy/install.sh
```

---

## 2) `.env` file

```bash
nano ~/headshot-api/.env
```

Production minimum:

```env
NODE_ENV=production
PORT=3000
API_BASE_PATH=/v1

# IP + port (bina SSL)
PUBLIC_BASE_URL=http://YOUR_VPS_IP:3016

# Domain + SSL ke baad
# PUBLIC_BASE_URL=https://api.yourdomain.com

MONGODB_URI=mongodb://127.0.0.1:27017/headshot_ai
ADMIN_EMAIL=admin@headshotapi.com
ADMIN_PASSWORD=strong-password-here
JWT_SECRET=minimum-32-char-random-secret

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GEMINI_API_KEY=...
GOOGLE_PLAY_VERIFY_ENABLED=false
```

---

## 3) PM2 start (tum yahi use karte ho)

```bash
cd ~/headshot-api
bash deploy/pm2-setup.sh
```

Ya manually:

```bash
cd ~/headshot-api
npm run build:api
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

### PM2 daily commands

```bash
pm2 status                  # chal raha hai?
pm2 logs headshot-api       # live logs
pm2 restart headshot-api    # restart
pm2 stop headshot-api       # stop
```

### Reboot par auto-start (ek bar)

```bash
pm2 startup
# terminal jo command print kare, woh chalao (kabhi sudo mangta hai — sirf is step ke liye)
pm2 save
```

API internally `127.0.0.1:3000` par chalegi. Bahar se nginx expose karega.

---

## 4) Nginx — bina SSL (port 3016)

```bash
cd ~/headshot-api
bash deploy/nginx/render-config.sh
bash deploy/nginx/check-port-3016.sh
```

Apni nginx config mein add karo:

```nginx
include /home/YOUR_USER/headshot-api/deploy/nginx/headshot-api.conf;
```

Reload:

```bash
nginx -t && nginx -s reload
```

Test:

```bash
curl http://127.0.0.1:3016/v1/health
curl http://YOUR_VPS_IP:3016/v1/health
```

Mobile app URL: `http://YOUR_VPS_IP:3016/v1`

---

## 5) Nginx + SSL certificate (domain)

### Step A — DNS

Domain A record point karo VPS IP par:

```
api.yourdomain.com  →  YOUR_VPS_IP
```

### Step B — SSL nginx config render

```bash
cd ~/headshot-api
DOMAIN=api.yourdomain.com bash deploy/nginx/render-ssl-config.sh
```

Nginx mein include:

```nginx
include /home/YOUR_USER/headshot-api/deploy/nginx/headshot-api-ssl.conf;
```

Reload (pehle HTTP chalega, SSL abhi nahi):

```bash
nginx -t && nginx -s reload
```

### Step C — Let's Encrypt certificate

**Certbot install (ek bar, yahan sudo lagta hai — sirf certificate ke liye):**

```bash
sudo apt update
sudo apt install -y certbot
```

**Certificate issue:**

```bash
sudo certbot certonly --webroot \
  -w ~/headshot-api/logs/certbot \
  -d api.yourdomain.com
```

Email daalo, agree karo. Success par files:

```
/etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
/etc/letsencrypt/live/api.yourdomain.com/privkey.pem
```

**Nginx reload:**

```bash
nginx -t && nginx -s reload
```

**`.env` update:**

```env
PUBLIC_BASE_URL=https://api.yourdomain.com
```

```bash
pm2 restart headshot-api
```

Test:

```bash
curl https://api.yourdomain.com/v1/health
```

### SSL auto-renew (ek bar)

```bash
sudo certbot renew --dry-run
```

Cron usually auto-add hota hai. Manual:

```bash
sudo crontab -e
# line add:
0 3 * * * certbot renew --quiet && nginx -s reload
```

---

## 6) Code update (har push ke baad)

```bash
cd ~/headshot-api
bash deploy/deploy.sh
```

Ya:

```bash
git pull origin main
npm ci
npm run build:api
pm2 restart headshot-api
nginx -t && nginx -s reload
```

---

## 7) Troubleshooting

| Problem | Fix |
|---------|-----|
| `502 Bad Gateway` | `pm2 status` — API down? `pm2 logs headshot-api` |
| Health OK on :3000 but not :3016 | nginx config include check, `nginx -t` |
| Images nahi dikhti | `PUBLIC_BASE_URL` sahi domain/port? |
| SSL error | `sudo certbot certificates`, paths nginx config mein match? |
| Port 3016 busy | `bash deploy/nginx/check-port-3016.sh` |

```bash
# API direct test (nginx bypass)
curl http://127.0.0.1:3000/v1/health

# Nginx test
curl http://127.0.0.1:3016/v1/health
```

---

## Quick reference

```
PM2:    pm2 start deploy/ecosystem.config.cjs
Nginx:  include .../deploy/nginx/headshot-api.conf;
SSL:    certbot certonly --webroot -w ~/headshot-api/logs/certbot -d api.domain.com
Health: https://api.domain.com/v1/health
Docs:   https://api.domain.com/docs
```
