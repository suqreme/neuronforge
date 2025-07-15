# ElevenLabs Voice Setup Guide

## 🎯 Overview
ElevenLabs provides high-quality AI-generated voices that are perfect for educational content, especially for non-readers and kindergarten students.

## 🔑 Getting Your API Key

### Step 1: Sign up for ElevenLabs
1. Go to [ElevenLabs](https://elevenlabs.io)
2. Click "Sign Up" and create an account
3. You'll get 10,000 free characters per month

### Step 2: Get Your API Key
1. Log in to your ElevenLabs account
2. Go to your [Profile page](https://elevenlabs.io/profile)
3. Copy your API key from the "API Key" section

### Step 3: Add API Key to Your Environment
1. Open your `.env.local` file
2. Replace `your_elevenlabs_api_key_here` with your actual API key:
   ```
   NEXT_PUBLIC_ELEVENLABS_API_KEY=your_actual_api_key_here
   ```
3. Save the file and restart your development server

## 🎵 Voice Features

### Child-Friendly Voices
- **Kindergarten & Early Elementary**: Automatically uses child-friendly voices
- **Older Students**: Uses more mature, clear voices
- **Age Detection**: Automatically detects grade level and selects appropriate voice

### Quality Benefits
- **Natural Speech**: Much more natural than browser voices
- **Emotional Expression**: Voices can convey enthusiasm and warmth
- **Clarity**: Crystal clear pronunciation for learning
- **Consistency**: Same voice quality across all devices

## 💰 Pricing
- **Free Tier**: 10,000 characters/month (about 30-40 lessons)
- **Starter Plan**: $5/month for 30,000 characters
- **Creator Plan**: $22/month for 100,000 characters

## 🔧 Technical Details

### Voice Selection
- **Child Voice ID**: `ErXwobaYiN019PkySvjV` (warm, friendly)
- **Adult Voice ID**: `EXAVITQu4vr4xnSDxMaL` (clear, professional)

### Settings Used
- **Stability**: 0.5 (balanced)
- **Similarity Boost**: 0.5 (natural)
- **Style**: 0.0 (neutral)
- **Speaker Boost**: Enabled (clearer audio)

### Fallback Behavior
- If ElevenLabs fails, automatically falls back to browser voices
- No interruption to the learning experience
- Users can switch between voice providers in settings

## 🚀 Usage in EduRoot

### Lesson Pages
- Click "Voice" settings button in the Audio Assistant
- Select "ElevenLabs (Premium)" from the dropdown
- Premium badge will appear when using ElevenLabs

### Automatic Features
- **Age-appropriate voice selection** based on grade level
- **Sentence-by-sentence reading** for better comprehension
- **Pause/Resume functionality** for interactive learning

### Accessibility Benefits
- **Non-readers** can fully access all lesson content
- **Kindergarten students** get engaging, child-friendly voices
- **Consistent experience** across all devices and browsers

## 🔍 Testing

### Without API Key
- Voice settings will show "Premium voices require ElevenLabs API key"
- Only browser voices will be available
- All functionality still works with free browser voices

### With API Key
- ElevenLabs option appears in voice settings
- Premium badge shows when using ElevenLabs
- High-quality voice synthesis for all lessons

## 📊 Usage Monitoring

### Character Count
- Average lesson: ~200-500 characters
- 10,000 characters = approximately 20-50 lessons
- Monitor usage in your ElevenLabs dashboard

### Cost Optimization
- Only used when user selects ElevenLabs voice
- Automatically falls back to free browser voices
- No additional cost for pause/resume functionality

## 🛠️ Troubleshooting

### Common Issues
1. **"ElevenLabs API key not configured"**: Check your `.env.local` file
2. **"API error: 401"**: Invalid API key, check your ElevenLabs account
3. **"API error: 429"**: Rate limit exceeded, wait or upgrade plan
4. **No sound**: Check browser permissions and audio settings

### Fallback Behavior
- ElevenLabs errors automatically fall back to browser voices
- Users can manually switch back to browser voices
- No interruption to the learning experience

## 🎓 Educational Benefits

### For Non-Readers
- **Full access** to all lesson content
- **Natural pronunciation** helps with language learning
- **Consistent pacing** optimized for comprehension

### For Kindergarten
- **Engaging voices** that sound like a friendly teacher
- **Clear articulation** for developing language skills
- **Appropriate tone** for young learners

### For All Students
- **Accessibility support** for learning disabilities
- **Multisensory learning** combining visual and auditory
- **Flexible learning** - can listen while following along visually