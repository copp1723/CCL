# 🚀 Render Deployment Guide

## 📋 Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repo**: Push your CCL 3 code to GitHub
3. **Environment Variables**: Ready to configure (see below)

---

## 🔧 Step-by-Step Deployment

### **Method 1: Automatic (Blueprint) - RECOMMENDED**

1. **Connect GitHub** to Render
2. **Create New → Blueprint**
3. **Connect Repository**: Select your CCL repo
4. **Render will automatically:**
   - Create PostgreSQL database
   - Deploy web service
   - Set up environment variables
   - Run migrations

### **Method 2: Manual Setup**

#### **A. Create Database**

1. **New → PostgreSQL**
   - Name: `ccl-database`
   - Plan: `Starter` (free)
   - Region: Choose closest to users

#### **B. Create Web Service**

1. **New → Web Service**
   - Connect your GitHub repo
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Starter` ($7/month)

#### **C. Environment Variables**

Set these in your web service environment:

```bash
# Required
NODE_ENV=production
PORT=10000
DATABASE_URL=[auto-filled from database]
ENCRYPTION_KEY=[generate with: openssl rand -base64 32]
API_KEY=[your secure API key]

# Optional
OPENAI_API_KEY=[for AI chat features]
MAILGUN_API_KEY=[for email campaigns]
```

---

## 🔑 Environment Variable Setup

### **Required Variables:**

1. **ENCRYPTION_KEY**

   ```bash
   # Generate secure key:
   openssl rand -base64 32
   # Copy output to Render
   ```

2. **API_KEY**

   ```bash
   # Generate secure API key:
   openssl rand -hex 32
   # Copy output to Render
   ```

3. **DATABASE_URL**
   - Automatically provided by Render database
   - Format: `postgresql://user:pass@host:port/dbname`

### **Optional Variables:**

- **OPENAI_API_KEY**: For AI chat widget
- **MAILGUN_API_KEY**: For email campaigns
- **MAILGUN_DOMAIN**: Your Mailgun domain

---

## 🚦 Post-Deployment Checklist

### **1. Verify Health**

```bash
curl https://your-app.onrender.com/health
# Should return: {"status": "healthy"}
```

### **2. Test Database**

```bash
curl https://your-app.onrender.com/api/system/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
# Should return system statistics
```

### **3. Test Lead Creation**

```bash
curl -X POST https://your-app.onrender.com/api/leads \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phoneNumber":"+1555000000","status":"new"}'
```

---

## 🔧 Common Issues & Solutions

### **Database Connection Issues**

- Verify `DATABASE_URL` is set correctly
- Check database is in same region as web service
- Ensure database is running (not paused)

### **Build Failures**

```bash
# Clear Render cache and rebuild
# In Render dashboard: Manual Deploy → Clear cache
```

### **Environment Variables**

- Verify all required variables are set
- Check for typos in variable names
- Ensure no extra spaces in values

### **SSL/Security Issues**

- Render automatically handles SSL certificates
- All traffic is HTTPS by default
- Database connections use SSL automatically

---

## 📊 Monitoring

### **Built-in Render Monitoring**

- **Logs**: Real-time in Render dashboard
- **Metrics**: CPU, memory, response times
- **Uptime**: Automatic health checks

### **Custom Monitoring**

- Health endpoint: `/health`
- System stats: `/api/system/stats`
- Error tracking in application logs

---

## 💰 Render Pricing

**Starter Plan (Recommended):**

- **Web Service**: $7/month
- **PostgreSQL**: Free (512MB)
- **Bandwidth**: 100GB/month
- **Custom Domain**: Included

**Total: ~$7/month for production CCL system**

---

## 🚀 Going Live

### **1. Custom Domain**

1. In Render dashboard → Settings
2. Add your domain (e.g., `app.completecarloans.com`)
3. Update DNS records as shown
4. SSL automatically configured

### **2. Production Optimization**

- Enable **Auto-Deploy** from main branch
- Set up **Preview Deployments** for staging
- Configure **Health Check** alerts
- Add **Environment Backups**

---

## 🆘 Support

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **CCL Health Check**: `https://your-app.onrender.com/health`
- **Database Backups**: Automatic daily backups included

---

**🎉 Your CCL system is now production-ready on Render!**
