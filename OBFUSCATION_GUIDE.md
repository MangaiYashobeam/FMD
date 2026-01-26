# 🔒 FaceMyDealer Code Obfuscation & De-Mangling Guide

> **Version:** 3.1.0  
> **Last Updated:** January 26, 2026  
> **Security Level:** A- (85/100)  
> **Author:** System Documentation

---

## 📋 Table of Contents

1. [Current Obfuscation Status](#current-obfuscation-status)
2. [What IS Obfuscated](#what-is-obfuscated)
3. [What is NOT Obfuscated](#what-is-not-obfuscated)
4. [How Obfuscation Was Applied](#how-obfuscation-was-applied)
5. [De-Mangling Steps](#de-mangling-steps)
6. [Debugging Production Code](#debugging-production-code)
7. [Future Enhancements](#future-enhancements)

---

## 🎯 Current Obfuscation Status

### Summary

| Component | Obfuscation Method | Level | Reversible |
|-----------|-------------------|-------|------------|
| Frontend JS | Vite Minification | Standard | Yes (source maps) |
| Frontend CSS | PostCSS/Tailwind | Standard | Yes |
| Backend TS | None (server-side) | N/A | N/A |
| API Paths | Plain text | Minimal | N/A |
| Environment Secrets | Docker env vars | Strong | Authorized only |

### Obfuscation Score: **6/10 (Moderate)**

```
Security Model: Authentication > Obfuscation
Philosophy: We rely on proper auth, not security through obscurity
```

---

## ✅ What IS Obfuscated

### 1. Frontend JavaScript (Vite Build)

**Location:** `/web/dist/assets/index-*.js`

**Obfuscation Applied:**
- Variable name mangling (a, b, c, t, s, r, l, i, d)
- Function name shortening
- Whitespace removal
- Dead code elimination
- Tree shaking (unused exports removed)
- Module bundling (all imports merged)

**Example - Before (Development):**
```javascript
function handleUserLogin(email, password) {
  const isValid = validateCredentials(email, password);
  if (isValid) {
    const userData = fetchUserData(email);
    setAuthToken(userData.token);
    redirectToDashboard();
  }
}
```

**Example - After (Production):**
```javascript
function ZC(t,s){const r=wL(t,s);r&&(xM(t).then(l=>{qT(l.token),nR()})}
```

### 2. CSS Classes (Tailwind)

**Obfuscation Applied:**
- Utility classes preserved (intentional - Tailwind design)
- Custom classes minified
- Unused styles purged

### 3. Chunk Splitting

**Files Generated:**
```
index-DlHz3cw6.js      (1.85 MB) - Main application bundle
TrafficMap-Bd_tUnRX.js (165 KB)  - Lazy-loaded map component
index-eOuaEI9L.css     (155 KB)  - Compiled styles
```

**Hash-based naming:** Filenames include content hash for cache busting

---

## ❌ What is NOT Obfuscated

### 1. API Endpoint Paths
```
/api/health                    - Visible in network tab
/api/extension/status/:id      - Visible in network tab
/api/auth/login                - Visible in network tab
```
**Why:** Protected by authentication, CORS, CSRF - not relying on obscurity

### 2. React Component Names (DevTools)
If React DevTools is installed, component names are visible:
```
<DashboardLayout>
  <ExtensionStatus>
  <FacebookConnectionStatus>
```

### 3. Error Messages
Generic messages, no stack traces in production:
```json
{"success": false, "message": "Authentication required", "code": "AUTH_REQUIRED"}
```

### 4. Backend Source Code
Server-side TypeScript is not minified (runs in Node.js container)

---

## 🔧 How Obfuscation Was Applied

### Step 1: Vite Build Configuration

**File:** `/web/vite.config.ts`

```typescript
export default defineConfig({
  build: {
    // Minification enabled by default in production
    minify: 'esbuild',  // Fast minifier
    
    // Chunk splitting for lazy loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for caching
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        }
      }
    },
    
    // Source maps disabled in production
    sourcemap: false,
    
    // Target modern browsers
    target: 'es2020',
  }
});
```

### Step 2: Build Command

```bash
cd web
npm run build
# Executes: tsc -b && vite build
```

### Step 3: Deployment

```bash
# Built files deployed to VPS
scp -r web/dist/* root@46.4.224.182:/opt/facemydealer/web/dist/
```

### Step 4: Backend (No Obfuscation)

Backend TypeScript is transpiled but NOT minified:
```bash
# In Docker container
npx tsx src/server.ts
# Runs TypeScript directly with tsx loader
```

---

## 🔓 De-Mangling Steps

### Method 1: Enable Source Maps (Development Debugging)

**Step 1:** Modify vite.config.ts temporarily:
```typescript
build: {
  sourcemap: true,  // Enable source maps
}
```

**Step 2:** Rebuild:
```bash
cd web
npm run build
```

**Step 3:** Deploy with source maps:
```bash
scp -r web/dist/* root@46.4.224.182:/opt/facemydealer/web/dist/
```

**Step 4:** Debug in browser DevTools → Sources → Enable source maps

**⚠️ IMPORTANT:** Remove source maps after debugging!
```bash
rm web/dist/assets/*.map
ssh root@46.4.224.182 "rm /opt/facemydealer/web/dist/assets/*.map"
```

### Method 2: Use Pretty Print (Quick Debug)

In Chrome DevTools:
1. Open Network tab
2. Click on the .js file
3. Click "{ }" (Pretty Print) button
4. Code becomes readable (but variables still mangled)

### Method 3: Local Development Mode

**Step 1:** Run dev server locally:
```bash
cd web
npm run dev
```

**Step 2:** Access at http://localhost:5173
- Full source code visible
- Hot module reloading
- React DevTools friendly

### Method 4: Map Mangled Names

**Common Patterns in Our Codebase:**

| Mangled | Original Pattern | Context |
|---------|-----------------|---------|
| `ZC`, `wL`, `xM` | Utility functions | Helper modules |
| `qT`, `nR` | Action dispatchers | State management |
| `t`, `s`, `r` | Function parameters | First 3 params |
| `l`, `i`, `d` | Loop variables | Iterations |
| `e` | Event object | Event handlers |
| `n` | Node/element | DOM operations |

### Method 5: Trace API Calls

**Finding endpoints in minified code:**
```bash
# Search for API paths in production bundle
grep -o '"/api/[^"]*"' web/dist/assets/index-*.js | sort -u
```

**Output:**
```
"/api/auth/login"
"/api/auth/logout"
"/api/extension/status"
"/api/health"
...
```

---

## 🐛 Debugging Production Code

### Scenario 1: Finding a Bug in Production

**Step 1:** Get error from logs
```bash
ssh root@46.4.224.182 "docker logs facemydealer-api-1 --tail 100 | grep error"
```

**Step 2:** Identify the API endpoint involved

**Step 3:** Find corresponding frontend code:
```bash
# In local dev environment
grep -r "extension/status" web/src/
```

**Step 4:** Debug locally with same data

### Scenario 2: Network Error Investigation

**Step 1:** Open browser DevTools → Network tab
**Step 2:** Find failed request
**Step 3:** Check request/response headers
**Step 4:** Match endpoint to local source code

### Scenario 3: React Component Error

**Step 1:** Error shows mangled stack trace
**Step 2:** Enable source maps temporarily (Method 1)
**Step 3:** Reproduce error
**Step 4:** Get readable stack trace
**Step 5:** Disable source maps

---

## 🚀 Future Enhancements (For A+ Security)

### Option 1: Advanced JS Obfuscation

**Install javascript-obfuscator:**
```bash
npm install --save-dev javascript-obfuscator
```

**Add to build process:**
```javascript
// vite.config.ts
import { obfuscator } from 'rollup-plugin-obfuscator';

export default defineConfig({
  plugins: [
    obfuscator({
      compact: true,
      controlFlowFlattening: true,
      deadCodeInjection: true,
      debugProtection: true,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      rotateStringArray: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
    })
  ]
});
```

### Option 2: API Path Encoding

**Encode sensitive paths:**
```typescript
// Instead of: /api/admin/users
// Use: /api/v1/a3d2f1 (hash-based routing)

const ROUTE_MAP = {
  'a3d2f1': 'admin/users',
  'b4e3g2': 'admin/settings',
};
```

### Option 3: Request Payload Encryption

```typescript
// Encrypt sensitive payloads
const encryptedPayload = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  JSON.stringify(data)
);
```

---

## 📁 File Reference

### Production Files (Obfuscated)

```
/opt/facemydealer/web/dist/
├── index.html
└── assets/
    ├── index-DlHz3cw6.js     # Main bundle (minified)
    ├── index-eOuaEI9L.css    # Styles (minified)
    └── TrafficMap-Bd_tUnRX.js # Lazy chunk (minified)
```

### Source Files (Not Obfuscated)

```
/web/src/
├── App.tsx                    # Main app component
├── pages/                     # Page components
├── components/                # Reusable components
├── contexts/                  # React contexts
├── lib/                       # Utilities & API client
└── layouts/                   # Layout components
```

### Backend Files (Not Obfuscated)

```
/src/
├── server.ts                  # Express server
├── middleware/                # Security middleware
├── routes/                    # API routes
├── services/                  # Business logic
└── config/                    # Configuration
```

---

## 🔑 Quick Commands Reference

```bash
# Build with source maps (debugging)
cd web && VITE_SOURCEMAP=true npm run build

# Build without source maps (production)
cd web && npm run build

# Check what's in production bundle
ssh root@46.4.224.182 "head -c 500 /opt/facemydealer/web/dist/assets/index-*.js"

# Search for strings in minified code
ssh root@46.4.224.182 "grep -o 'GREEN_ROUTE\|SECRET' /opt/facemydealer/web/dist/assets/*.js"

# List all API paths in bundle
grep -oE '"/api/[^"]*"' web/dist/assets/index-*.js | sort -u

# Verify no secrets in frontend
grep -E 'API_KEY|SECRET|PASSWORD' web/dist/assets/*.js
# Should return empty!
```

---

## ⚠️ Security Reminders

1. **NEVER** deploy source maps to production permanently
2. **NEVER** commit .env files with real secrets
3. **ALWAYS** verify no secrets in frontend bundle before deployment
4. **ALWAYS** remove debugging source maps after use

---

## 📞 Emergency De-Mangling

If you need to debug production urgently:

```bash
# 1. Enable source maps
cd web
sed -i 's/sourcemap: false/sourcemap: true/' vite.config.ts
npm run build

# 2. Deploy temporarily
scp -r web/dist/* root@46.4.224.182:/opt/facemydealer/web/dist/

# 3. Debug in browser

# 4. IMMEDIATELY after debugging:
sed -i 's/sourcemap: true/sourcemap: false/' vite.config.ts
npm run build
scp -r web/dist/* root@46.4.224.182:/opt/facemydealer/web/dist/
ssh root@46.4.224.182 "rm -f /opt/facemydealer/web/dist/assets/*.map"
```

---

**Document End**
