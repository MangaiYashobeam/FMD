# Nova-in-Chromium Deployment Guide

## Overview

This guide covers deploying the Nova AI browser control system. Nova can now control Chromium browsers directly on the VPS, enabling:

- **Natural language browser control** (navigate, click, type, screenshot)
- **Facebook Marketplace automation** (create listings, send messages)
- **Vision-based reasoning** (screenshot analysis with GPT-4V/Claude)
- **ReAct agent pattern** (think → act → observe loop)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Node.js API (Railway)                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ src/routes/iai.routes.ts                                ││
│  │   /api/admin/iai/nova/*  ← Nova browser control routes  ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ src/services/nova-chromium.service.ts                   ││
│  │   NovaChromiumService ← Bridge to Python workers        ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (callWorkerApi)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Python Workers (VPS :8000)                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ api/browser_routes.py                                   ││
│  │   /api/browser/*  ← Browser control endpoints           ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ browser/nova_controller.py                              ││
│  │   NovaController ← 30+ action handlers                  ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ browser/nova_vision.py                                  ││
│  │   NovaVisionService ← GPT-4V/Claude screenshot analysis ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ browser/nova_agent.py                                   ││
│  │   NovaAgent ← ReAct reasoning loop                      ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Playwright → Chromium                  ││
│  │                     (headless browser)                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Files Created/Modified

### Python Workers (VPS)

| File | Purpose |
|------|---------|
| `browser/nova_controller.py` | Core browser control (30+ actions) |
| `browser/nova_vision.py` | AI vision analysis service |
| `browser/nova_agent.py` | ReAct agent reasoning loop |
| `api/browser_routes.py` | FastAPI browser control endpoints |
| `api/main.py` | Updated to include browser routes |
| `requirements.txt` | Added openai, anthropic packages |

### Node.js API (Railway)

| File | Purpose |
|------|---------|
| `src/services/nova-chromium.service.ts` | Bridge to Python workers |
| `src/routes/iai.routes.ts` | Added Nova browser endpoints |
| `src/services/nova-tooling.service.ts` | Added browser control tools |

## Deployment Steps

### 1. VPS (Python Workers)

SSH into VPS and update the code:

```bash
ssh root@46.4.224.182
cd /root/facemydealer
git pull origin main

# Update Python dependencies
cd python-workers
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
playwright install-deps chromium

# Restart the worker-api container
docker-compose restart worker-api
```

### 2. Railway (Node.js API)

Push to Railway via git:

```bash
git add .
git commit -m "Nova-in-Chromium production implementation"
git push railway main
```

### 3. Environment Variables

Ensure these are set on the VPS:

```env
# AI Vision (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Session encryption
SESSION_ENCRYPTION_KEY=your-32-byte-key-here

# Worker API port
PORT=8000
```

## API Endpoints

### Create Browser Session

```bash
POST /api/admin/iai/nova/session
Authorization: Bearer <token>

Response:
{
  "success": true,
  "session": {
    "sessionId": "session_abc123",
    "status": "ready"
  }
}
```

### Execute Action

```bash
POST /api/admin/iai/nova/:sessionId/action
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "navigate",
  "params": {
    "url": "https://facebook.com/marketplace"
  }
}

Response:
{
  "success": true,
  "result": {
    "action": "navigate",
    "success": true,
    "data": {
      "url": "https://facebook.com/marketplace",
      "title": "Facebook Marketplace"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Available Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `navigate` | Go to URL | `url` |
| `click` | Click element | `selector` |
| `type` | Type text | `selector`, `text` |
| `screenshot` | Capture screen | *(none)* |
| `extract_text` | Get page text | `selector` (optional) |
| `extract_html` | Get page HTML | `selector` (optional) |
| `wait` | Wait for element | `selector`, `timeout` |
| `scroll` | Scroll page | `direction`, `amount` |
| `hover` | Hover element | `selector` |
| `select` | Select dropdown | `selector`, `value` |
| `press_key` | Press key | `key` |
| `upload_file` | Upload file | `selector`, `file_path` |
| `execute_js` | Run JavaScript | `script` |
| `fb_send_message` | Send FB message | `conversation_url`, `message` |
| `fb_create_listing` | Create FB listing | `listing` object |
| `fb_navigate_marketplace` | Go to marketplace | *(none)* |
| `fb_search_marketplace` | Search marketplace | `query` |

### Take Screenshot with Vision Analysis

```bash
GET /api/admin/iai/nova/:sessionId/screenshot?analyze=true
Authorization: Bearer <token>

Response:
{
  "success": true,
  "screenshot": "data:image/png;base64,...",
  "analysis": {
    "elements": [
      {
        "type": "button",
        "text": "Create Listing",
        "selector": "[data-testid='marketplace-create-listing']",
        "location": { "x": 150, "y": 200 },
        "confidence": 0.95
      }
    ],
    "current_state": "Marketplace main page",
    "suggested_actions": ["click create listing button"],
    "navigation_context": "Ready to create a new listing"
  }
}
```

### Send Facebook Message (High-Level)

```bash
POST /api/admin/iai/nova/:sessionId/send-message
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationUrl": "https://www.facebook.com/messages/t/123456789",
  "message": "Hello! Is this item still available?"
}
```

### Create Marketplace Listing (High-Level)

```bash
POST /api/admin/iai/nova/:sessionId/create-listing
Authorization: Bearer <token>
Content-Type: application/json

{
  "listing": {
    "title": "2019 Honda Civic EX",
    "price": "18500",
    "category": "vehicles",
    "condition": "used_good",
    "description": "Low mileage, well maintained...",
    "images": ["path/to/image1.jpg", "path/to/image2.jpg"]
  }
}
```

### Natural Language Execution (AI Goal)

```bash
POST /api/admin/iai/nova/:sessionId/execute-goal
Authorization: Bearer <token>
Content-Type: application/json

{
  "goal": "Find and reply to all unread messages in Facebook Marketplace"
}

Response:
{
  "success": true,
  "result": {
    "goal": "Find and reply to all unread messages...",
    "steps_taken": 8,
    "final_state": "Replied to 3 unread messages",
    "history": [
      {"step": 1, "thought": "Navigate to FB messages", "action": "navigate"},
      {"step": 2, "thought": "Look for unread indicators", "action": "screenshot"},
      ...
    ]
  }
}
```

## IAI Integration

Each IAI Soldier can have its own browser session:

```bash
GET /api/admin/iai/nova/iai/:soldierId/session
```

This retrieves or creates a dedicated browser session for the soldier, automatically restoring Facebook login cookies from the soldier's encrypted session.

## Nova Tooling Access

Nova agents now have these browser tools available:

```typescript
// Create browser session
await novaTooling.createBrowserSession();

// Execute action
await novaTooling.executeBrowserAction(sessionId, 'click', { selector: '#login-button' });

// Navigation helpers
await novaTooling.browserNavigate(sessionId, 'https://facebook.com');
await novaTooling.browserClick(sessionId, '[data-testid="marketplace"]');
await novaTooling.browserType(sessionId, '#search-input', 'Honda Civic');

// Screenshot with vision
await novaTooling.browserScreenshot(sessionId, true);

// Facebook-specific
await novaTooling.browserSendFacebookMessage(sessionId, conversationUrl, message);
await novaTooling.browserCreateMarketplaceListing(sessionId, listing);
```

## Monitoring

### Check Browser Pool Status

```bash
GET /api/admin/iai/nova/health
```

Returns:
```json
{
  "pool_size": 5,
  "active_sessions": 2,
  "available_slots": 3,
  "sessions": [
    { "id": "session_1", "created": "2024-01-15T10:00:00Z", "last_action": "2024-01-15T10:30:00Z" },
    { "id": "session_2", "created": "2024-01-15T11:00:00Z", "last_action": "2024-01-15T11:05:00Z" }
  ]
}
```

### View Worker Logs

```bash
ssh root@46.4.224.182
docker logs -f facemydealer-worker-api-1
```

## Troubleshooting

### Browser won't start

```bash
# Check Playwright installation
playwright install chromium
playwright install-deps chromium

# Check system dependencies
apt-get install -y libnss3 libxss1 libasound2
```

### Vision analysis fails

```bash
# Verify API keys
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Test vision endpoint directly
curl -X POST http://localhost:8000/api/browser/test-vision \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "..."}'
```

### Session times out

Sessions auto-expire after 30 minutes of inactivity. Adjust in `nova_controller.py`:

```python
SESSION_TIMEOUT = 1800  # 30 minutes (default)
```

## Security Considerations

1. **Session Encryption**: All Facebook cookies are encrypted with AES-256-GCM
2. **Scoped Access**: Each IAI soldier can only access its own session
3. **Action Logging**: All browser actions are logged for audit
4. **Rate Limiting**: Built-in human-like delays prevent detection
5. **Cookie Isolation**: Sessions are sandboxed per-soldier

## Performance Tips

1. **Browser Pool**: Pre-warm browsers during low-traffic hours
2. **Screenshot Caching**: Cache vision analysis results
3. **Action Batching**: Use `/batch` endpoint for multiple actions
4. **Session Reuse**: Reuse sessions instead of creating new ones

---

*Nova-in-Chromium v1.0.0 - Production Ready*
