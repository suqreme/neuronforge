# 🚀 EduRoot Production Deployment Guide

## 📋 Prerequisites

### 1. Supabase Setup
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to Settings > API to get your keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Go to SQL Editor and run the schema from `supabase/schema.sql`

### 2. OpenAI Setup
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key: `OPENAI_API_KEY`
3. Set up billing (required for GPT-4 access)

### 3. Vercel Setup
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`

## 🔧 Environment Variables

Create a `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## 🚀 Deployment Steps

### 1. Local Testing
```bash
# Install dependencies
npm install

# Run locally with production environment
npm run dev

# Test with real API keys
```

### 2. Deploy to Vercel
```bash
# Deploy to Vercel
vercel --prod

# Or connect GitHub repo for automatic deployments
```

### 3. Configure Vercel Environment Variables
In Vercel dashboard:
1. Go to your project settings
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`

### 4. Set up Supabase Authentication
1. In Supabase Dashboard > Authentication > URL Configuration
2. Set Site URL to your Vercel domain
3. Add your Vercel domain to redirect URLs

## 🔐 Security Checklist

- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Proper API key management (never commit to git)
- [ ] Supabase service role key only used server-side
- [ ] OpenAI API key rate limits configured
- [ ] CORS configured for your domain only

## 📊 Post-Deployment

### 1. Database Seeding
The app will work with an empty database and create user profiles automatically.

### 2. Admin Setup
1. Create an account with email: `admin@eduroot.com`
2. Update the user profile in Supabase to set `role = 'admin'`

### 3. Monitoring
- Monitor OpenAI API usage
- Track Supabase database usage
- Set up Vercel analytics

## 🧪 Testing Production

Test these features:
- [ ] User registration/login
- [ ] AI lesson generation
- [ ] Quiz functionality
- [ ] Progress tracking
- [ ] Offline mode
- [ ] Theme switching
- [ ] Admin panel (with admin@eduroot.com)

## 🔄 Continuous Deployment

1. Connect GitHub repository to Vercel
2. Set up automatic deployments on push to main
3. Configure preview deployments for pull requests

## 📈 Scaling Considerations

- **Database**: Supabase handles scaling automatically
- **OpenAI**: Monitor API usage and set up rate limiting
- **Vercel**: Pro plan for higher limits if needed
- **CDN**: Vercel Edge Network handles global distribution

## 🐛 Troubleshooting

### Common Issues:
1. **OpenAI API errors**: Check API key and billing
2. **Supabase connection**: Verify URL and keys
3. **CORS errors**: Check Supabase auth settings
4. **Build errors**: Verify all environment variables

### Debug Mode:
Add `NEXT_PUBLIC_DEBUG=true` to enable detailed logging.

## 🎯 Success Metrics

Monitor these after deployment:
- User registration rate
- Lesson completion rate
- Quiz pass rate
- API response times
- Error rates

Your EduRoot platform is now production-ready! 🎉