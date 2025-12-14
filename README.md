# Shafi Backend API

Backend API for Shafi medical application built with Node.js, Express, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database
- AWS S3 bucket (for file storage)
- PM2 (for production deployment)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file with the following variables:
```env
# Server
PORT=5000
NODE_ENV=production

# Database
DB_USER=your_db_user
DB_HOST=your_db_host
DB_NAME=your_db_name
DB_PASS=your_db_password
DB_PORT=5432
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET=your_jwt_secret_key

# AWS
AWS_REGION=your_aws_region
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
```

4. Generate Prisma Client
```bash
npx prisma generate
```

5. Run database migrations (if needed)
```bash
npx prisma db push
```

## 📦 Development

```bash
npm run dev
```

## 🚀 Production Deployment on EC2

### 1. Install PM2 globally
```bash
npm install -g pm2
```

### 2. Create logs directory
```bash
mkdir logs
```

### 3. Start the application with PM2
```bash
npm run pm2:start
```

### 4. Save PM2 configuration
```bash
pm2 save
pm2 startup
```

### 5. Useful PM2 Commands
```bash
# View logs
npm run pm2:logs

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop

# Monitor application
npm run pm2:monit

# Delete application from PM2
npm run pm2:delete
```

### 6. Configure Nginx (Optional)
If you want to use Nginx as a reverse proxy, create a configuration file:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7. Security Groups on EC2
Make sure to open the following ports in your EC2 security group:
- Port 5000 (or your chosen port) for the API
- Port 22 for SSH
- Port 80/443 if using Nginx

## 📁 Project Structure

```
backend/
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── routes/          # API routes
├── utils/           # Utility functions
├── prisma/          # Prisma schema and migrations
├── generated/       # Generated Prisma client
├── uploads/         # Local file uploads (if not using S3)
├── logs/            # Application logs
├── server.js        # Main server file
├── db.js            # Database connection
└── ecosystem.config.js  # PM2 configuration
```

## 🔧 Environment Variables

Make sure all required environment variables are set in your `.env` file before starting the server.

## 📝 API Endpoints

See `routes/routes.js` for all available endpoints.

## 🐛 Troubleshooting

### Database Connection Issues
- Verify database credentials in `.env`
- Check if database is accessible from EC2 instance
- Ensure security groups allow database connections

### PM2 Issues
- Check logs: `pm2 logs shafi-backend`
- Restart: `pm2 restart shafi-backend`
- Check status: `pm2 status`

### Port Already in Use
- Change PORT in `.env` file
- Or kill the process using the port: `lsof -ti:5000 | xargs kill`

## 📄 License

ISC

