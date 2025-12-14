#!/bin/bash

# Deploy script for EC2
# Usage: ./deploy.sh

echo "🚀 Starting deployment..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Create logs directory if it doesn't exist
mkdir -p logs

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed!"
echo "📊 Check status with: pm2 status"
echo "📝 View logs with: pm2 logs shafi-backend"

