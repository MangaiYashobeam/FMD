# Dealers Face Chrome Extension

Auto-post vehicles to Facebook Marketplace from your dealership inventory.

## Features

- 🔐 Secure login with Dealers Face backend
- 🤖 Auto-fill Facebook Marketplace listing forms
- 🔑 2FA handling with backup codes
- 📸 Automatic form completion
- ✅ Post tracking and confirmation

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension icon should appear in your toolbar

## Setup

1. Click the extension icon
2. Select API endpoint (Production or Local)
3. Log in with your Dealers Face credentials
4. Go to Dashboard → Settings → Credentials
5. Add your Facebook username, password, and 2FA backup codes

## How to Use

### Method 1: From Dashboard (Future)
1. Open Dealers Face dashboard
2. Go to Vehicles page
3. Click "Post to Marketplace" button on any vehicle
4. Extension opens Facebook and auto-fills the form
5. Review details and click "Publish"

### Method 2: Manual Trigger
1. Click extension icon
2. Click "Vehicles" quick action
3. Select vehicle to post
4. Extension handles the rest

## Security

- All credentials encrypted with AES-256-CBC
- JWT authentication for API requests
- No credentials stored in extension localStorage
- HTTPS-only communication

## Troubleshooting

**Extension not loading:**
- Make sure you're using Chrome/Edge (Manifest V3 required)
- Check that all files are in the `chrome-extension` folder

**Login fails:**
- Verify API endpoint is correct
- Check that backend is running
- Ensure you have a registered account

**Auto-fill not working:**
- Facebook page structure may have changed
- Check browser console for errors
- Try logging into Facebook manually first

**2FA issues:**
- Ensure backup codes are saved in dashboard
- Codes are single-use - regenerate if depleted

## Development

### File Structure
```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (API communication)
├── content.js            # Content script (Facebook automation)
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── inject.js             # Page injection script (future)
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### API Endpoints Used
- `POST /api/auth/login` - User authentication
- `GET /api/users/me/facebook-credentials` - Get FB credentials
- `POST /api/facebook/marketplace/confirm` - Confirm post success

## Future Enhancements

- [ ] Photo upload automation
- [ ] Bulk posting
- [ ] Post scheduling
- [ ] Analytics tracking
- [ ] Error reporting
- [ ] Multi-account support

## License

Proprietary - Dealers Face
