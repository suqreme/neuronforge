# API Key Update Instructions

## Required Updates for Claude Sonnet 3.5 and OpenAI

### 1. Update your `.env` file

Replace your current `.env` file with:

```env
# AI Configuration - Updated API Key Names
VITE_CLAUDE_API_KEY=your_actual_claude_api_key_here
VITE_OPENAI_API_KEY=your_actual_openai_api_key_here
VITE_AI_PROVIDER=claude

# Development Settings
VITE_DEV_MODE=true
```

**Important Changes:**
- Changed `VITE_OPENAI_KEY` to `VITE_OPENAI_API_KEY` for consistency
- Claude now uses **Claude 3.5 Sonnet (2024-10-22)** model
- OpenAI still uses **GPT-4** model

### 2. API Key Format

**Claude API Key:**
- Should start with `sk-ant-`
- Example: `sk-ant-api03-abc123...`

**OpenAI API Key:**  
- Should start with `sk-`
- Example: `sk-abc123...`

### 3. Test the Integration

After updating your `.env` file:

1. Restart your development server (`npm run dev`)
2. Open browser console
3. Run: `testLLMIntegration()`
4. Check that both providers show green status indicators in the control bar

### 4. Model Information

- **Claude**: Now using Claude 3.5 Sonnet (2024-10-22) - Latest and most capable model
- **OpenAI**: Using GPT-4 - Reliable and well-tested model
- You can switch between providers in real-time using the dropdown in the control bar

### 5. Troubleshooting

If you see red status indicators:
- Check that your API keys are correctly set in `.env`
- Ensure no spaces or quotes around the API keys
- Restart the development server after making changes
- Check browser console for specific error messages

The system will gracefully fall back to template generation if API keys are not configured or if API calls fail.