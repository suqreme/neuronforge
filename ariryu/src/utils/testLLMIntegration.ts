import { promptAgent } from '../agents/promptAgent';
import { callClaudeWithContext } from './claudeApi';
import { getCurrentProvider, getAvailableProviders } from './providerManager';

export async function testLLMIntegration() {
  console.log('🧪 Testing Phase 10 - Real LLM Integration');
  
  // Test provider availability
  const providers = getAvailableProviders();
  const currentProvider = getCurrentProvider();
  
  console.log('📊 Available Providers:', providers);
  console.log('🎯 Current Provider:', currentProvider);
  
  const activeProvider = providers.find(p => p.provider === currentProvider);
  if (!activeProvider?.available) {
    console.warn('⚠️ Current provider API key not configured');
    return false;
  }
  
  try {
    // Test basic LLM call
    console.log(`🤖 Testing basic ${activeProvider.name} call...`);
    const basicResponse = await callClaudeWithContext({
      prompt: 'Say "Hello from NeuronForge LLM integration!"',
      system: 'You are a helpful assistant.',
      temperature: 0.1
    });
    
    console.log('✅ Basic LLM Response:', basicResponse.slice(0, 100) + '...');
    
    // Test UI Agent prompter
    console.log('🎨 Testing UI Agent file generation...');
    const uiFiles = await promptAgent({
      agentType: 'ui',
      task: 'Create a simple React button component with TypeScript and Tailwind CSS',
      provider: currentProvider
    });
    
    console.log(`✅ UI Agent generated ${uiFiles.length} files:`, uiFiles.map(f => f.filename));
    
    // Test Backend Agent prompter
    console.log('⚙️ Testing Backend Agent file generation...');
    const backendFiles = await promptAgent({
      agentType: 'backend',
      task: 'Create a simple Express.js API endpoint for user management',
      provider: currentProvider
    });
    
    console.log(`✅ Backend Agent generated ${backendFiles.length} files:`, backendFiles.map(f => f.filename));
    
    console.log('🎉 Phase 10 LLM Integration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ LLM Integration test failed:', error);
    return false;
  }
}

// Helper function to run test from browser console
(window as any).testLLMIntegration = testLLMIntegration;