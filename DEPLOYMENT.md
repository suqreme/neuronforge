# 🚀 NeuronForge Deployment Guide

## Quick Deploy to Vercel (Recommended)

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `neuronforge`
3. Description: `Node-based visual AI development platform`
4. Set as **Public**
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

### Step 2: Push Code to GitHub
```bash
# Add the GitHub remote (replace 'suqreme' with your username)
git remote add origin https://github.com/suqreme/neuronforge.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel
1. Go to https://vercel.com/new
2. Import your `neuronforge` repository
3. **Project settings:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. Click **Deploy**

## Alternative: Deploy to Netlify

### Option A: Git Integration
1. Go to https://app.netlify.com/sites/new
2. Connect to GitHub and select `neuronforge`
3. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**

### Option B: Drag & Drop
1. Run `npm run build` locally
2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder to deploy instantly

## Why Deploy?

The CORS issues we're experiencing are due to cross-origin isolation headers required for WebContainer. In production:

✅ **AI API calls will work** (no CORS blocks)  
✅ **External resources load** (Tailwind CDN, etc.)  
✅ **WebContainer runs properly** with correct headers  
✅ **File transfers work** between agents  

## What to Test After Deployment

1. **AI Generation**: Create a new project, verify files generate
2. **Static Preview**: Check if React components render properly  
3. **WebContainer Mode**: Switch modes and verify file preservation
4. **Edge Connections**: Confirm visual lines between nodes appear
5. **No Console Errors**: Verify CORS/CSP issues are resolved

## Production URLs

After deployment, you'll get URLs like:
- **Vercel**: `https://neuronforge-abc123.vercel.app`
- **Netlify**: `https://amazing-site-name.netlify.app`

## Emergency Local Fix

If you need to test locally without CORS issues:
```bash
# Disable web security (Chrome only - for testing)
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_test"
```

🎯 **Goal**: Get NeuronForge running in production where CORS won't block AI generation and file transfers!