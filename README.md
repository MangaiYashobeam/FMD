# FaceMyDealer - Auto Dealer Facebook Marketplace Automation

<div align="center">

![FaceMyDealer](https://via.placeholder.com/800x200/4267B2/FFFFFF?text=FaceMyDealer+-+Automate+Your+Vehicle+Listings)

**Robust, Production-Ready Platform for Auto Dealerships**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.6-blue)](https://www.typescriptlang.org/)

</div>

---

## 🚀 Features

### 🤖 **Automated Synchronization**
- **3-Hour Intervals**: Automatic inventory sync every 3 hours
- **Price Updates**: Automatically update prices on Facebook when changed in DMS
- **Status Tracking**: Auto-mark vehicles as sold when removed from inventory
- **Background Processing**: Asynchronous, non-blocking operations

### 👥 **Multi-User & Multi-Account**
- **Account Management**: Multiple users per dealership account
- **Role-Based Access**: Owner, Admin, Member, Viewer roles
- **Multi-Profile**: Connect multiple Facebook profiles per user
- **Team Collaboration**: Share access with your sales team

### 📊 **Powerful Dashboard**
- **Analytics**: Track post performance, views, and engagement
- **Real-Time Updates**: See sync status and posting progress live
- **Inventory Management**: View, edit, and manage all vehicles
- **Notifications**: Get alerts for errors, completions, and updates

### 🔧 **Flexible Data Integration**
- **FTP/SFTP Support**: Direct integration with your DMS
- **CSV Import**: Standard CSV file format from any DMS
- **Alternative Sources**: API webhooks, manual uploads
- **Photo Management**: Automatic photo URL validation and caching

### 🌐 **Chrome Extension**
- **Side Panel**: View inventory without leaving Facebook
- **Manual Control**: Post vehicles selectively with one click
- **Status Indicators**: See connection status and errors
- **Background Sync**: Extension works in the background

### 🔒 **Enterprise-Grade Security**
- **Authentication**: JWT-based with refresh tokens
- **Encryption**: All sensitive data encrypted at rest
- **Input Sanitization**: Protection against SQL injection & XSS
- **Rate Limiting**: API protection against abuse
- **Audit Logs**: Track all user actions

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Chrome Extension](#chrome-extension-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/facemydealer.git
cd facemydealer

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:push

# Start development server
npm run dev
```

Server will be running at `http://localhost:3000`

---

## 💻 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14.0
- **Redis** >= 6.0 (for job queue)
- **npm** >= 9.0.0

### Step 1: Clone & Install

```bash
git clone https://github.com/yourusername/facemydealer.git
cd facemydealer
npm install
```

### Step 2: Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/facemydealer

# JWT Secrets
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Facebook
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
```

### Step 3: Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations (production)
npm run db:migrate
```

---

## 🗃️ Database Setup

### PostgreSQL Setup

**Option 1: Local PostgreSQL**

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE facemydealer;
CREATE USER facemydealer_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE facemydealer TO facemydealer_user;
\q
```

**Option 2: Railway (Recommended for Production)**

1. Go to [Railway.app](https://railway.app)
2. Create new project → Add PostgreSQL
3. Copy `DATABASE_URL` to your `.env`

### Redis Setup

**Local Redis:**

```bash
# Install Redis (Ubuntu/Debian)
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis
```

**Railway Redis:**

1. In your Railway project → Add Redis
2. Copy connection details to `.env`

---

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

- Server: `http://localhost:3000`
- Hot reload enabled
- Debug logging enabled

### Production Build

```bash
npm run build
npm start
```

### Database Tools

```bash
# Prisma Studio (Database GUI)
npm run db:studio

# Generate migrations
npm run db:migrate

# View database
npx prisma studio
```

---

## 🔧 Configuration

### Account Settings

Configure via API or Dashboard:

- **Auto Sync**: Enable/disable automatic syncing
- **Sync Interval**: Set hours between syncs (default: 3)
- **Posts Per Run**: Limit posts per sync
- **AI Descriptions**: Enable AI-generated descriptions
- **Custom Templates**: Add custom description templates

### FTP Configuration

```json
{
  "host": "ftp.yourdms.com",
  "port": 21,
  "username": "your-username",
  "password": "your-password",
  "path": "/inventory",
  "protocol": "ftp" // or "sftp", "ftps"
}
```

---

## 📱 Chrome Extension Setup

### Build Extension

```bash
cd chrome-extension
npm install
npm run build
```

### Load in Chrome

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension/build` folder

### Connect to Backend

1. Click extension icon
2. Login with your FaceMyDealer credentials
3. Extension will connect to your account

---

## 📚 API Documentation

### Authentication

**Register**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "dealer@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "accountName": "ABC Auto Sales"
}
```

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "dealer@example.com",
  "password": "SecurePass123"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Vehicles

**Get All Vehicles**
```http
GET /api/vehicles?accountId=<account-id>
Authorization: Bearer <token>
```

**Trigger Manual Sync**
```http
POST /api/sync/manual
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "account-uuid"
}
```

### Facebook

**Get Auth URL**
```http
GET /api/facebook/auth-url
Authorization: Bearer <token>
```

**Post Vehicle**
```http
POST /api/facebook/post
Authorization: Bearer <token>
Content-Type: application/json

{
  "vehicleId": "vehicle-uuid",
  "facebookProfileId": "profile-uuid"
}
```

---

## 🚀 Deployment

### Railway Deployment

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login to Railway**
```bash
railway login
```

3. **Initialize Project**
```bash
railway init
```

4. **Add Services**
- PostgreSQL database
- Redis instance
- Web service

5. **Deploy**
```bash
railway up
```

6. **Set Environment Variables**
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret
# ... add all variables from .env.example
```

### Environment Variables (Railway)

Set in Railway dashboard:
- `DATABASE_URL` (auto-set by Railway PostgreSQL)
- `REDIS_URL` (auto-set by Railway Redis)
- All other vars from `.env.example`

---

## 🛠️ Development

### Project Structure

```
facemydealer/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── jobs/           # Background jobs
│   ├── utils/          # Utility functions
│   └── server.ts       # Entry point
├── prisma/
│   └── schema.prisma   # Database schema
├── chrome-extension/   # Chrome extension code
├── frontend/           # Web dashboard (React)
└── logs/               # Application logs
```

### Code Style

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Database Migrations

```bash
# Create migration
npx prisma migrate dev --name add_new_field

# Apply migrations
npx prisma migrate deploy
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## 📊 Monitoring

### Logs

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:00:00.000Z",
  "uptime": 12345
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Email**: support@facemydealer.com
- **Documentation**: https://docs.facemydealer.com
- **Issues**: https://github.com/yourusername/facemydealer/issues

---

## 🗺️ Roadmap

See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) for detailed development plan.

### Upcoming Features
- [ ] Instagram integration
- [ ] Craigslist posting
- [ ] Advanced analytics dashboard
- [ ] Mobile app
- [ ] WhatsApp notifications
- [ ] Multi-language support

---

<div align="center">

**Built with ❤️ for Auto Dealers**

[Website](https://facemydealer.com) • [Documentation](https://docs.facemydealer.com) • [Demo](https://demo.facemydealer.com)

</div>
