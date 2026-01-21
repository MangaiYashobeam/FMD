#!/bin/bash
# ============================================================================
# FaceMyDealer - VPS Setup Script
# ============================================================================
# Run this script on a fresh Ubuntu 22.04 VPS to set up everything
#
# Usage: 
#   chmod +x scripts/vps-setup.sh
#   sudo ./scripts/vps-setup.sh
# ============================================================================

set -e

echo "=============================================="
echo "  FaceMyDealer VPS Setup Script"
echo "=============================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./vps-setup.sh)"
  exit 1
fi

# ===========================================
# 1. System Updates
# ===========================================
echo ""
echo "[1/7] Updating system packages..."
apt-get update && apt-get upgrade -y

# ===========================================
# 2. Install Docker
# ===========================================
echo ""
echo "[2/7] Installing Docker..."

if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
  
  # Add current user to docker group
  usermod -aG docker $SUDO_USER 2>/dev/null || true
else
  echo "Docker already installed"
fi

# ===========================================
# 3. Install Docker Compose
# ===========================================
echo ""
echo "[3/7] Installing Docker Compose..."

if ! command -v docker-compose &> /dev/null; then
  apt-get install -y docker-compose-plugin
else
  echo "Docker Compose already installed"
fi

# ===========================================
# 4. Install Required Packages
# ===========================================
echo ""
echo "[4/7] Installing required packages..."
apt-get install -y \
  curl \
  git \
  htop \
  nano \
  ufw \
  fail2ban \
  apache2-utils

# ===========================================
# 5. Configure Firewall
# ===========================================
echo ""
echo "[5/7] Configuring firewall..."

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Firewall configured: SSH, HTTP, HTTPS allowed"

# ===========================================
# 6. Configure Fail2Ban
# ===========================================
echo ""
echo "[6/7] Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# ===========================================
# 7. Create Swap (if needed)
# ===========================================
echo ""
echo "[7/7] Checking swap..."

if [ ! -f /swapfile ]; then
  echo "Creating 4GB swap file..."
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  
  # Optimize swap settings
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  echo "Swap already exists"
fi

# ===========================================
# Done!
# ===========================================
echo ""
echo "=============================================="
echo "  VPS Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Clone your repository:"
echo "   git clone https://github.com/your-repo/facemydealer.git"
echo "   cd facemydealer"
echo ""
echo "2. Create environment file:"
echo "   cp .env.production.example .env"
echo "   nano .env  # Edit with your values"
echo ""
echo "3. Generate secure keys:"
echo "   openssl rand -hex 32  # For JWT_SECRET"
echo "   openssl rand -hex 32  # For JWT_REFRESH_SECRET"
echo "   openssl rand -hex 32  # For ENCRYPTION_KEY"
echo ""
echo "4. Start the stack:"
echo "   docker compose -f docker-compose.production.yml up -d"
echo ""
echo "5. View logs:"
echo "   docker compose -f docker-compose.production.yml logs -f"
echo ""
echo "=============================================="
