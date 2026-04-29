#!/bin/bash
set -e

echo "🚀 Personal Cloud Platform — Setup"
echo ""

# Check requirements
command -v node >/dev/null 2>&1 || { echo "❌ Node.js gerekli"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm gerekli (npm install -g pnpm)"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker gerekli"; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ gerekli (mevcut: v$NODE_VERSION)"
  exit 1
fi

echo "✅ Tüm gereksinimler mevcut"
echo ""

# Install dependencies
echo "📦 Bağımlılıklar yükleniyor..."
pnpm install
echo ""

# Setup env
if [ ! -f infra/docker/.env ]; then
  echo "🔧 .env dosyası oluşturuluyor..."
  cp infra/docker/.env.example infra/docker/.env
  echo "⚠️  infra/docker/.env dosyasını gözden geçir ve sırlarını ayarla"
fi
echo ""

# Start infra
echo "🐳 Docker servisleri başlatılıyor..."
cd infra/docker
docker compose up -d
cd ../..
echo ""

# Wait for postgres
echo "⏳ PostgreSQL hazır olması bekleniyor..."
sleep 5

# Verify
echo "🔍 Servis durumu:"
cd infra/docker
docker compose ps
cd ../..
echo ""

echo "✅ Setup tamamlandı!"
echo ""
echo "Sonraki adımlar:"
echo "  1. infra/docker/.env dosyasını düzenle"
echo "  2. pnpm db:migrate (migration'ları çalıştır)"
echo "  3. pnpm dev (servisleri başlat)"
echo ""
echo "Erişim:"
echo "  - Web: http://localhost:3000"
echo "  - Auth service:      http://localhost:3001"
echo "  - Workspace service: http://localhost:3002"
echo "  - Runtime service:   http://localhost:3003"
echo "  - Agent service:     http://localhost:3004"
echo "  - Memory service:    http://localhost:3005"
echo "  - Publish service:   http://localhost:3006"
echo "  - Browser service:   http://localhost:3007"
echo "  - Traefik: http://localhost:8080"
echo "  - MinIO: http://localhost:9001"
echo "  - Mailhog: http://localhost:8025"