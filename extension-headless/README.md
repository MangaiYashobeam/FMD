# DealersFace Pro - Headless Extension

Server-side Facebook Marketplace automation using headless Chromium.

## Overview

This is a stripped-down version of DealersFace Pro designed to run on servers:
- No GUI/sidepanel dependencies
- Compatible with Puppeteer/Playwright
- Uses the verified `FBM-Official-P1` pattern
- Same core automation as the Chrome extension

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 extension config (headless-optimized) |
| `background-headless.js` | Service worker for mission management |
| `content-headless.js` | Content script with automation functions |
| `iai-soldier-headless.js` | Full IAI soldier (same as working extension) |
| `puppeteer-runner.js` | Puppeteer automation script |

## Installation

### 1. Install Dependencies

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
```

### 2. Load Extension in Puppeteer

```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--disable-blink-features=AutomationControlled',
  ],
});
```

## Usage

### CLI

```bash
# Set auth token
export AUTH_TOKEN="your-dealersface-api-token"

# Run automation
node puppeteer-runner.js --vehicle <vehicle-id> --account <fb-account-id>
```

### Programmatic

```javascript
const { runAutomation } = require('./puppeteer-runner');

const result = await runAutomation({
  vehicleData: {
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    price: 25000,
    mileage: 30000,
    vin: '1234567890',
    description: 'Well maintained vehicle...',
    imageUrls: ['https://example.com/image1.jpg'],
  },
  fbCookies: [
    { name: 'c_user', value: '...', domain: '.facebook.com' },
    { name: 'xs', value: '...', domain: '.facebook.com' },
  ],
  authToken: 'your-api-token',
});

console.log(result.success ? 'Posted!' : 'Failed:', result.error);
```

### Direct Page Control

```javascript
// After navigating to Facebook Marketplace
const result = await page.evaluate(async (vehicleData) => {
  // Wait for extension to load
  while (!window.__DEALERSFACE_HEADLESS__) {
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Execute mission
  return await window.__DEALERSFACE_HEADLESS__.executeMission(
    'mission_' + Date.now(),
    vehicleData,
    'auth-token',
    'FBM-Official-P1'
  );
}, vehicleData);
```

## Exposed Functions

The extension exposes these functions via `window.__DEALERSFACE_HEADLESS__`:

| Function | Description |
|----------|-------------|
| `executeMission(id, data, token, pattern)` | Run full posting mission |
| `clickHumanlike(element)` | Human-like click |
| `typeText(element, text, fast)` | Human-like typing |
| `findInput(label)` | Find input by label |
| `selectDropdownOption(trigger, value)` | Select dropdown option |
| `uploadImages(urls, proxyUrl)` | Upload images |
| `clickPublishButton()` | Click publish/next |
| `getMission()` | Get current mission status |

## Pattern: FBM-Official-P1

This headless extension uses the `FBM-Official-P1` pattern:
- 166 workflow steps
- Verified working Jan 27, 2026
- Full form fill + image upload + multi-step wizard

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | DealersFace API URL | `https://dealersface.com/api` |
| `AUTH_TOKEN` | API authentication token | Required |
| `HEADLESS` | Run headless mode | `true` |

## Stealth Features

The extension includes stealth measures:
- `puppeteer-extra-plugin-stealth` integration
- Disabled automation indicators
- Human-like mouse movements
- Variable typing speeds
- Random delays between actions

## Troubleshooting

### Extension not loading
- Ensure path is absolute
- Check manifest.json is valid
- Look for errors in console

### Facebook login fails
- Verify cookies are fresh
- Check cookie domain is `.facebook.com`
- Ensure `c_user` and `xs` cookies are present

### Mission fails
- Check screenshots in `./logs/`
- Verify vehicle data is complete
- Check Facebook account status

## Docker

```dockerfile
FROM node:18-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY extension-headless ./extension-headless
COPY package.json .
RUN npm install

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "extension-headless/puppeteer-runner.js"]
```

## Support

For issues or questions, contact the DealersFace development team.
