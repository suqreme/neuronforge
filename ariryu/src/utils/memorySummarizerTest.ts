// Quick validation test for memory summarizer
import { generateMemorySummary, getMemoryStats } from './memorySummarizer';

export function testMemorySummarizer() {
  try {
    console.log('🧪 Testing Memory Summarizer...');
    
    // Test basic functionality
    const summary = generateMemorySummary({
      maxFiles: 5,
      maxFeedbacks: 5,
      maxTokens: 1000,
      prioritizeRecent: true,
      includeFileContent: false,
      qualityThreshold: 0.5
    });
    
    console.log('✅ Memory summary generated:');
    console.log(`- Files: ${summary.files.length}`);
    console.log(`- Feedbacks: ${summary.feedbacks.length}`);
    console.log(`- Project memories: ${summary.projectMemories.length}`);
    console.log(`- Estimated tokens: ${summary.stats.estimatedTokens}`);
    console.log(`- Context length: ${summary.context.length} chars`);
    
    // Test stats
    const stats = getMemoryStats();
    console.log('✅ Memory stats:');
    console.log(`- Total files: ${stats.totalFiles}`);
    console.log(`- Total feedbacks: ${stats.totalFeedbacks}`);
    console.log(`- Total memories: ${stats.totalMemories}`);
    console.log(`- Avg quality: ${Math.round(stats.avgQuality * 100)}%`);
    
    // Validate structure
    if (summary.context && summary.stats && summary.files && summary.feedbacks) {
      console.log('✅ Memory summarizer test passed!');
      return true;
    } else {
      console.error('❌ Memory summarizer test failed - missing properties');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Memory summarizer test failed:', error);
    return false;
  }
}

// Auto-run test in development
if (process.env.NODE_ENV === 'development') {
  // Delay to allow stores to initialize
  setTimeout(() => {
    testMemorySummarizer();
  }, 2000);
}