# Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend)
- Render or Heroku account (for backend)
- MongoDB Atlas account (for database)

## Step 1: Setup MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (M0 Free tier)
4. Wait for cluster to be created (5-10 minutes)
5. Click "Connect"
6. Add your current IP address to whitelist (or allow access from anywhere: 0.0.0.0/0)
7. Create a database user with username and password
8. Copy the connection string (looks like: mongodb+srv://username:password@cluster.mongodb.net/)
9. Replace `<password>` with your actual password
10. Replace `test` with `kashiful-hudha` in the connection string

## Step 2: Deploy Backend to Render

1. Go to https://render.com
2. Sign up/Login
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - Name: kashiful-hudha-backend
   - Environment: Node
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Instance Type: Free
6. Add environment variables:
   ```
   MONGO_URI=<your-mongodb-atlas-connection-string>
   PORT=5000
   JWT_SECRET=kashiful-hudha-production-secret-2024
   NODE_ENV=production
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=<your-email>
   EMAIL_PASS=<your-app-password>
   FRONTEND_URL=https://kashiful-hudha.vercel.app
   ```
7. Click "Create Web Service"
8. Wait for deployment (5-10 minutes)
9. Copy the backend URL (e.g., https://kashiful-hudha-backend.onrender.com)

### Seed Production Database

After backend is deployed, seed the database:

1. Go to Render dashboard
2. Click on your service
3. Go to "Shell" tab
4. Run: `cd backend && node seed.js`

## Step 3: Deploy Frontend to Vercel

### Option A: Using Vercel Dashboard

1. Go to https://vercel.com
2. Sign up/Login with GitHub
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Configure:
   - Framework Preset: Vite
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: dist
6. Add environment variable (optional):
   ```
   VITE_API_URL=https://kashiful-hudha-backend.onrender.com
   ```
7. Click "Deploy"
8. Wait for deployment (2-5 minutes)
9. Your site will be live at https://[your-project].vercel.app

### Option B: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   npm run build
   vercel --prod
   ```

4. Follow the prompts

## Step 4: Configure API Proxy

Since backend is on a different domain, update `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://kashiful-hudha-backend.onrender.com',
        changeOrigin: true,
      }
    }
  }
})
```

**Note**: In production, you may need to use absolute URLs in API calls or configure CORS properly.

## Step 5: Update Backend CORS

Make sure backend allows requests from Vercel domain. In `backend/server.js`:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://kashiful-hudha.vercel.app',
    'https://kashiful-hudha-*.vercel.app'  // Allow preview deployments
  ],
  credentials: true
}));
```

## Step 6: Custom Domain (Optional)

### For Vercel (Frontend)

1. Go to Vercel dashboard
2. Select your project
3. Go to "Settings" → "Domains"
4. Add custom domain (e.g., kashifulhudha.lk)
5. Follow DNS configuration instructions
6. Wait for SSL certificate to be issued (automatic)

### For Render (Backend)

1. Go to Render dashboard
2. Select your service
3. Go to "Settings" → "Custom Domain"
4. Add custom domain (e.g., api.kashifulhudha.lk)
5. Follow DNS configuration instructions

## Step 7: Monitoring and Analytics

### Add Google Analytics

1. Get Google Analytics tracking ID
2. Add to `index.html`:
   ```html
   <!-- Google Analytics -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');
   </script>
   ```

### Vercel Analytics

1. Go to Vercel dashboard
2. Select your project
3. Go to "Analytics" tab
4. Enable Web Analytics

### Render Monitoring

Render provides automatic monitoring and logs in the dashboard.

## Post-Deployment Checklist

- [ ] Frontend is accessible
- [ ] Backend API is responding
- [ ] Database connection is working
- [ ] Contact form sends emails
- [ ] News page displays content
- [ ] Faculty page displays content
- [ ] All pages load correctly
- [ ] Language toggle works
- [ ] Responsive design works on mobile
- [ ] WhatsApp link works
- [ ] Facebook link works
- [ ] Google Maps loads correctly
- [ ] SSL certificate is active (HTTPS)
- [ ] Google Analytics is tracking

## Maintenance

### Update Content

To update news or faculty:
1. Connect to MongoDB Atlas
2. Use MongoDB Compass or shell
3. Update documents directly
4. Or create an admin panel (future enhancement)

### Monitor Errors

- Check Vercel logs for frontend errors
- Check Render logs for backend errors
- Monitor MongoDB Atlas for database issues

### Backup Database

1. Go to MongoDB Atlas dashboard
2. Go to "Backup" tab
3. Enable automatic backups
4. Or export data manually

## Troubleshooting

### Frontend doesn't load
- Check Vercel deployment logs
- Verify build completed successfully
- Check browser console for errors

### API calls fail
- Verify backend is running on Render
- Check CORS configuration
- Verify environment variables are set
- Check API URL in frontend code

### Database connection fails
- Verify MongoDB Atlas cluster is running
- Check IP whitelist includes 0.0.0.0/0
- Verify connection string is correct
- Check database user credentials

### Emails not sending
- Verify EMAIL_USER and EMAIL_PASS are set
- Use Gmail App Password (not regular password)
- Check SMTP settings

## Costs

### Free Tier Limits

**MongoDB Atlas (Free M0)**
- 512 MB storage
- Shared RAM
- Shared vCPU

**Render (Free)**
- 750 hours/month
- Spins down after inactivity
- 100 GB bandwidth/month

**Vercel (Free)**
- Unlimited bandwidth
- 100 GB hours/month
- Automatic SSL

**Total**: $0/month for basic usage

### Upgrade Recommendations

When to upgrade:
- More than 100 students accessing website
- Need 24/7 uptime (no spin-down)
- Need more than 512 MB database
- Need email support beyond basic
- Need custom features

## Support

For deployment issues:
- Vercel: https://vercel.com/support
- Render: https://render.com/support
- MongoDB: https://www.mongodb.com/support

For application issues:
- GitHub Issues: https://github.com/AHSANMOHAMMED/Dharul-uloom-khasiful-hudha-arabic-collage-website-/issues
- Email: [College contact]
- Phone: 032-5612355, 070-5668463
