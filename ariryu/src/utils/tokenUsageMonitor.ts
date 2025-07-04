// Token Usage Monitor - Prevents runaway API costs
interface TokenUsage {
  totalTokens: number;
  outputTokens: number;
  requestCount: number;
  lastReset: number;
  dailyLimit: number;
  requestLimit: number;
}

const DAILY_TOKEN_LIMIT = 50000; // Conservative daily limit
const HOURLY_REQUEST_LIMIT = 100; // Max requests per hour

let usage: TokenUsage = {
  totalTokens: 0,
  outputTokens: 0,
  requestCount: 0,
  lastReset: Date.now(),
  dailyLimit: DAILY_TOKEN_LIMIT,
  requestLimit: HOURLY_REQUEST_LIMIT
};

export function trackTokenUsage(inputTokens: number, outputTokens: number) {
  // Reset daily counters if needed
  const now = Date.now();
  const oneDayAgo = 24 * 60 * 60 * 1000;
  
  if (now - usage.lastReset > oneDayAgo) {
    usage.totalTokens = 0;
    usage.outputTokens = 0;
    usage.requestCount = 0;
    usage.lastReset = now;
  }

  usage.totalTokens += inputTokens + outputTokens;
  usage.outputTokens += outputTokens;
  usage.requestCount++;

  // Log warnings
  if (usage.totalTokens > usage.dailyLimit * 0.8) {
    console.warn('⚠️ TOKEN WARNING: Approaching daily limit!', {
      used: usage.totalTokens,
      limit: usage.dailyLimit,
      percentage: Math.round((usage.totalTokens / usage.dailyLimit) * 100)
    });
  }

  return usage;
}

export function checkTokenLimits(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneHourAgo = 60 * 60 * 1000;
  
  // Check daily token limit
  if (usage.totalTokens >= usage.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily token limit reached (${usage.totalTokens}/${usage.dailyLimit})`
    };
  }

  // Check hourly request limit
  if (usage.requestCount >= usage.requestLimit) {
    return {
      allowed: false,
      reason: `Hourly request limit reached (${usage.requestCount}/${usage.requestLimit})`
    };
  }

  return { allowed: true };
}

export function getTokenUsage() {
  return { ...usage };
}

export function resetTokenUsage() {
  usage = {
    totalTokens: 0,
    outputTokens: 0,
    requestCount: 0,
    lastReset: Date.now(),
    dailyLimit: DAILY_TOKEN_LIMIT,
    requestLimit: HOURLY_REQUEST_LIMIT
  };
}