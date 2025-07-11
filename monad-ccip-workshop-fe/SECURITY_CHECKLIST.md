# 🔒 Security Checklist for Vercel Deployment

## ✅ Pre-Deployment Security Tasks

### **1. Environment Variables**
- [ ] All `.env*` files are in `.gitignore` ✅ (Already done)
- [ ] No sensitive data hardcoded in source code
- [ ] All `VITE_*` variables added to Vercel dashboard
- [ ] API keys have proper restrictions set

### **2. API Key Security**
- [ ] **Pimlico API Key**: Domain restrictions enabled
- [ ] **WalletConnect Project ID**: Domain allowlist configured
- [ ] **Infura/Alchemy Keys**: Rate limits and domain restrictions set
- [ ] Monthly spending limits configured where applicable

### **3. Contract Addresses**
- [ ] All contract addresses are correct for target network
- [ ] Contract addresses match deployed contracts
- [ ] Helper contract address is optional but recommended

### **4. Repository Security**
- [ ] No `.env` files committed to git
- [ ] No private keys in repository
- [ ] No sensitive comments or TODOs with credentials

### **5. Build Configuration**
- [ ] `vercel.json` configured with security headers
- [ ] Build command correctly set to `npm run build`
- [ ] Output directory set to `dist`

## 🚨 Critical Security Notes

### **Frontend Security Reality**
- ⚠️ **All `VITE_*` variables are PUBLIC** - visible in browser
- ✅ **This is normal** for frontend apps
- 🔐 **Use API restrictions** to prevent abuse

### **API Key Restrictions**
```bash
# Pimlico Dashboard Settings:
Domain Restrictions: your-app.vercel.app, localhost:5173
Rate Limits: 100 requests/minute
Spending Limits: $10/month

# WalletConnect Dashboard Settings:
Allowed Origins: https://your-app.vercel.app, http://localhost:5173
```

### **What's Safe to be Public**
- ✅ Contract addresses (already on blockchain)
- ✅ RPC URLs (public endpoints)
- ✅ Chain IDs (network identifiers)
- ✅ WalletConnect Project ID (with domain restrictions)

### **What Needs Protection**
- 🔐 API keys (through provider restrictions)
- 🔐 Policy IDs (through usage monitoring)
- 🔐 Any private keys (should never be in frontend)

## 🚀 Deployment Steps

1. **Set up API key restrictions** in provider dashboards
2. **Add environment variables** to Vercel dashboard
3. **Deploy from GitHub** - Vercel will auto-detect Vite
4. **Test all functionality** on deployed site
5. **Monitor API usage** after deployment

## 📊 Post-Deployment Monitoring

- [ ] Monitor API key usage in provider dashboards
- [ ] Check Vercel analytics for traffic patterns
- [ ] Review error logs for security issues
- [ ] Set up alerts for unusual API usage

## 🆘 Emergency Procedures

If API keys are compromised:
1. **Immediately revoke** keys in provider dashboards
2. **Generate new keys** with proper restrictions
3. **Update Vercel environment variables**
4. **Redeploy** the application
5. **Monitor** for any unauthorized usage 