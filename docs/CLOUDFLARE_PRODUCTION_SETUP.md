# Cloudflare Production Setup Guide for FaceMyDealer

## Overview

This guide configures Cloudflare as the CDN and security layer for FaceMyDealer production deployment.

**Architecture:**
```
Users → Cloudflare (dealersface.com) → VPS (46.4.224.182)
                                     ↓
                            ┌────────┴────────┐
                            │                 │
                         Traefik           Docker
                            │                 │
                    ┌───────┼───────┐    ┌────┴────┐
                    │       │       │    │         │
                   API   Frontend  Workers  Redis  PostgreSQL
```

---

## Step 1: Cloudflare Account Setup

### 1.1 Add Your Domain

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **"Add a Site"**
3. Enter: `dealersface.com`
4. Select plan (Free tier works fine)
5. Cloudflare will scan existing DNS records

### 1.2 Update Nameservers

At your domain registrar, update nameservers to Cloudflare's:
```
ns1.cloudflare.com
ns2.cloudflare.com
```

Wait 5-30 minutes for DNS propagation.

---

## Step 2: DNS Configuration

### 2.1 Required DNS Records

Go to **DNS → Records** and add/update these records:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | `@` | `46.4.224.182` | **Proxied** (orange) | Auto |
| A | `www` | `46.4.224.182` | **Proxied** (orange) | Auto |
| A | `api` | `46.4.224.182` | **Proxied** (orange) | Auto |
| CNAME | `traefik` | `dealersface.com` | DNS only (gray) | Auto |

### 2.2 Important Notes

- **Proxied (Orange Cloud)**: Traffic goes through Cloudflare - enables CDN, DDoS protection, SSL
- **DNS Only (Gray Cloud)**: Direct connection to server - use for internal services

---

## Step 3: SSL/TLS Configuration

### 3.1 SSL Mode

Go to **SSL/TLS → Overview**:

1. Set SSL/TLS encryption mode to: **Full (strict)**
   - This ensures end-to-end encryption
   - Cloudflare → VPS connection is also encrypted

### 3.2 Edge Certificates

Go to **SSL/TLS → Edge Certificates**:

1. **Always Use HTTPS**: ✅ ON
2. **HTTP Strict Transport Security (HSTS)**: ✅ Enable
   - Max Age: 6 months
   - Include subdomains: ✅
   - Preload: ✅
3. **Minimum TLS Version**: TLS 1.2
4. **Opportunistic Encryption**: ✅ ON
5. **TLS 1.3**: ✅ ON
6. **Automatic HTTPS Rewrites**: ✅ ON

### 3.3 Origin Server Certificate

Go to **SSL/TLS → Origin Server**:

1. Click **Create Certificate**
2. Generate certificate for: `dealersface.com, *.dealersface.com`
3. Certificate validity: 15 years
4. Download the certificate and private key
5. Install on VPS (instructions in Step 6)

---

## Step 4: Security Settings

### 4.1 Firewall Rules

Go to **Security → WAF**:

Create these rules:

#### Rule 1: Block Bad Bots
```
(cf.client.bot) and not (cf.client.bot eq "googlebot") and not (cf.client.bot eq "bingbot")
Action: Block
```

#### Rule 2: Rate Limit API
```
(http.request.uri.path contains "/api/auth/")
Action: Rate Limit (10 requests per minute)
```

#### Rule 3: Allow Extension Requests
```
(http.request.uri.path contains "/api/extension/") and (http.request.method eq "GET")
Action: Allow
```

### 4.2 Bot Fight Mode

Go to **Security → Bots**:

1. **Bot Fight Mode**: ✅ ON
2. **Super Bot Fight Mode** (if available): Configure to allow verified bots

### 4.3 DDoS Protection

Go to **Security → DDoS**:

1. HTTP DDoS attack protection: ✅ Enabled (default)
2. Sensitivity: High
3. Action: Managed Challenge

---

## Step 5: Performance Settings

### 5.1 Caching

Go to **Caching → Configuration**:

1. **Caching Level**: Standard
2. **Browser Cache TTL**: Respect Existing Headers
3. **Always Online™**: ✅ ON

### 5.2 Cache Rules

Go to **Caching → Cache Rules**:

#### Rule 1: Cache Static Assets
```
(http.request.uri.path.extension in {"js" "css" "png" "jpg" "jpeg" "gif" "ico" "svg" "woff2" "woff"})
Cache eligibility: Eligible for cache
Edge TTL: 1 month
Browser TTL: 1 week
```

#### Rule 2: Bypass API Cache
```
(http.request.uri.path contains "/api/")
Cache eligibility: Bypass cache
```

### 5.3 Speed Optimizations

Go to **Speed → Optimization**:

1. **Auto Minify**: ✅ JavaScript, CSS, HTML
2. **Brotli**: ✅ ON
3. **Early Hints**: ✅ ON
4. **Rocket Loader™**: ❌ OFF (can break React apps)

---

## Step 6: VPS Origin Server Setup

### 6.1 Install Cloudflare Origin Certificate

SSH into VPS and run:

```bash
# Create SSL directory
mkdir -p /opt/facemydealer/ssl

# Save the Cloudflare Origin Certificate (from Step 3.3)
cat > /opt/facemydealer/ssl/cloudflare-origin.pem << 'EOF'
-----BEGIN CERTIFICATE-----
[PASTE YOUR CERTIFICATE HERE]
-----END CERTIFICATE-----
EOF

# Save the private key
cat > /opt/facemydealer/ssl/cloudflare-origin.key << 'EOF'
-----BEGIN PRIVATE KEY-----
[PASTE YOUR PRIVATE KEY HERE]
-----END PRIVATE KEY-----
EOF

# Set permissions
chmod 600 /opt/facemydealer/ssl/*.key
chmod 644 /opt/facemydealer/ssl/*.pem
```

### 6.2 Update Traefik for Cloudflare SSL

Edit docker-compose.production.yml traefik section:

```yaml
traefik:
  image: traefik:v2.11
  restart: unless-stopped
  command:
    - "--api.dashboard=true"
    - "--log.level=INFO"
    - "--providers.docker=true"
    - "--providers.docker.exposedbydefault=false"
    - "--providers.docker.network=facemydealer_fmd-network"
    - "--entrypoints.web.address=:80"
    - "--entrypoints.websecure.address=:443"
    # Use Cloudflare Origin Certificate
    - "--providers.file.directory=/etc/traefik/dynamic"
    - "--providers.file.watch=true"
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /opt/facemydealer/ssl:/etc/traefik/ssl:ro
    - /opt/facemydealer/traefik:/etc/traefik/dynamic:ro
```

### 6.3 Create Traefik Dynamic Config

```bash
mkdir -p /opt/facemydealer/traefik

cat > /opt/facemydealer/traefik/tls.yml << 'EOF'
tls:
  certificates:
    - certFile: /etc/traefik/ssl/cloudflare-origin.pem
      keyFile: /etc/traefik/ssl/cloudflare-origin.key
  options:
    default:
      minVersion: VersionTLS12
      sniStrict: true
EOF
```

### 6.4 Configure Real IP from Cloudflare

Add to docker-compose API service:

```yaml
api:
  # ... existing config ...
  environment:
    # ... existing env vars ...
    # Trust Cloudflare proxy headers
    TRUST_PROXY: "cloudflare"
```

---

## Step 7: Facebook App Configuration

### 7.1 Main App (ID: 2154291218715435)

Go to [Facebook Developers](https://developers.facebook.com) → Your App → Settings:

**Facebook Login → Settings:**

| Setting | Value |
|---------|-------|
| Client OAuth Login | ✅ Yes |
| Web OAuth Login | ✅ Yes |
| Enforce HTTPS | ✅ Yes |
| Valid OAuth Redirect URIs | See below |

**Valid OAuth Redirect URIs:**
```
https://dealersface.com/api/facebook/callback
https://dealersface.com/api/auth/facebook/callback
https://www.dealersface.com/api/facebook/callback
https://www.dealersface.com/api/auth/facebook/callback
```

**App Domains:**
```
dealersface.com
www.dealersface.com
```

### 7.2 IAI Extension App (ID: 1247275793957279)

**Facebook Login → Settings:**

| Setting | Value |
|---------|-------|
| Client OAuth Login | ✅ Yes |
| Web OAuth Login | ✅ Yes |

**Valid OAuth Redirect URIs:**
```
https://<YOUR-EXTENSION-ID>.chromiumapp.org/
```

To get your extension ID:
1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Find your extension and copy the ID

---

## Step 8: Final VPS Configuration

### 8.1 Update .env File

Already configured, verify with:

```bash
cat /opt/facemydealer/.env | grep -E 'DOMAIN|URL|CORS|ORIGIN|FACEBOOK_REDIRECT'
```

Expected output:
```
DOMAIN=dealersface.com
FRONTEND_URL=https://dealersface.com
API_BASE_URL=https://dealersface.com
API_URL=https://dealersface.com
ALLOWED_ORIGINS=https://dealersface.com,https://www.dealersface.com,https://www.facebook.com,https://facebook.com,https://m.facebook.com
FACEBOOK_REDIRECT_URI=https://dealersface.com/api/facebook/callback
CORS_ORIGINS=https://dealersface.com,https://www.dealersface.com,https://www.facebook.com,https://facebook.com,https://m.facebook.com,http://localhost:3000,http://localhost:5173
```

### 8.2 Rebuild and Deploy

```bash
cd /opt/facemydealer

# Pull latest code
git pull origin main

# Rebuild all services
docker compose -f docker-compose.production.yml build --no-cache

# Restart all services
docker compose -f docker-compose.production.yml up -d

# Check logs
docker compose -f docker-compose.production.yml logs -f --tail=50
```

---

## Step 9: Verification Checklist

### 9.1 DNS Verification

```bash
# Check DNS resolves through Cloudflare
dig dealersface.com +short
# Should show Cloudflare IPs (104.x.x.x or 172.x.x.x)

# Check HTTPS works
curl -I https://dealersface.com
# Should return 200 OK with Cloudflare headers
```

### 9.2 API Health Check

```bash
curl https://dealersface.com/health
# Should return: {"status":"ok"}

curl https://dealersface.com/api/health
# Should return API health info
```

### 9.3 Extension Connectivity

```bash
curl -X GET https://dealersface.com/api/extension/config \
  -H "Origin: https://www.facebook.com"
# Should return config, not CORS error
```

### 9.4 Facebook OAuth Test

1. Open https://dealersface.com/dashboard
2. Click "Connect Facebook"
3. Should redirect to Facebook, then back to dashboard

---

## Step 10: Cloudflare Firewall IPs

### 10.1 Restrict VPS to Cloudflare Only

For maximum security, configure VPS firewall to only accept connections from Cloudflare:

```bash
# Get Cloudflare IPs
curl -s https://www.cloudflare.com/ips-v4 > /tmp/cf-ips-v4.txt
curl -s https://www.cloudflare.com/ips-v6 > /tmp/cf-ips-v6.txt

# Create iptables rules (example)
# WARNING: Don't run this if you'll lose SSH access!

# First, ensure SSH is allowed
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow Cloudflare IPs on port 80/443
while read ip; do
  iptables -A INPUT -p tcp --dport 80 -s $ip -j ACCEPT
  iptables -A INPUT -p tcp --dport 443 -s $ip -j ACCEPT
done < /tmp/cf-ips-v4.txt

# Block all other HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j DROP
iptables -A INPUT -p tcp --dport 443 -j DROP
```

---

## Troubleshooting

### CORS Errors

If you see CORS errors in console:
1. Check Origin header is in allowed list
2. Verify Cloudflare isn't caching error responses
3. Purge Cloudflare cache: Dashboard → Caching → Purge Everything

### 522 Connection Timed Out

1. Check VPS is reachable: `curl http://46.4.224.182:3000/health`
2. Check Docker containers are running: `docker ps`
3. Check firewall isn't blocking Cloudflare IPs

### 520 Unknown Error

1. Check API logs: `docker logs facemydealer-api-1 --tail=100`
2. Usually means API crashed or returned invalid response

### SSL Certificate Errors

1. Verify SSL mode is "Full (strict)"
2. Check Origin Certificate is installed correctly
3. Ensure certificate hasn't expired

---

## Security Best Practices

1. **Never expose VPS IP directly** - Always go through Cloudflare
2. **Enable WAF** for common attack patterns
3. **Monitor Analytics** for unusual traffic
4. **Set up Page Rules** for sensitive endpoints
5. **Use Cloudflare Access** for admin routes (optional)
6. **Regular security audits** via Cloudflare Security Center

---

## Quick Reference

| Service | URL |
|---------|-----|
| Main App | https://dealersface.com |
| API | https://dealersface.com/api |
| Dashboard | https://dealersface.com/dashboard |
| FB OAuth Callback | https://dealersface.com/api/facebook/callback |
| Extension Tasks | https://dealersface.com/api/extension/tasks/{id} |
| Health Check | https://dealersface.com/health |

---

## Support

For issues with this setup:
1. Check Cloudflare Analytics for error codes
2. Check VPS logs: `docker compose -f docker-compose.production.yml logs`
3. Verify DNS propagation: https://dnschecker.org

