import { useLogStore } from '../stores/logStore';
import { useMessageBus } from '../stores/messageBus';
import { useTokenBudgetStore } from '../stores/tokenBudgetStore';
import { useFileContext } from '../stores/fileContextStore';
import { callClaudeWithActions } from './claudeApi';
import { ContextBuilders } from './promptContextBuilder';
import { parseAndApplyClaudeFiles, previewParsedFiles, getMultiFileFormatInstruction } from './parseClaudeFileResponse';

/**
 * Configuration for test generation
 */
export interface TestGenerationConfig {
  targetDirectory: string;
  testFramework: 'vitest' | 'jest' | 'mocha';
  includeIntegrationTests: boolean;
  includeE2ETests: boolean;
  focusAreas: ('components' | 'utils' | 'routes' | 'stores' | 'agents')[];
  maxTestFiles: number;
}

export const defaultTestConfig: TestGenerationConfig = {
  targetDirectory: '/tests',
  testFramework: 'vitest',
  includeIntegrationTests: true,
  includeE2ETests: false,
  focusAreas: ['components', 'utils', 'routes', 'stores'],
  maxTestFiles: 20
};

/**
 * Triggers Claude to generate comprehensive test files for the project
 */
export async function triggerClaudeTestGeneration(
  config: Partial<TestGenerationConfig> = {}
): Promise<{
  success: boolean;
  filesGenerated: number;
  message: string;
}> {
  const finalConfig = { ...defaultTestConfig, ...config };
  
  // Check token budget first
  const tokenBudget = useTokenBudgetStore.getState();
  const estimatedTokens = 8000; // Test generation is token-intensive
  const operationResult = tokenBudget.checkOperationAllowed(estimatedTokens, 'test_generation');
  
  if (!operationResult.allowed) {
    const errorMsg = `Test generation blocked: ${operationResult.reason}`;
    useLogStore.getState().addLog({
      level: 'warn',
      source: 'Test Generator',
      message: `🚫 ${errorMsg}`
    });
    return { success: false, filesGenerated: 0, message: errorMsg };
  }

  try {
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Test Generator',
      message: '🧪 Starting Claude test generation...'
    });

    // Build context with project files for analysis
    const contextResult = ContextBuilders.planning(
      'Analyze project structure for comprehensive test generation',
      [] // Let it auto-select relevant files
    );

    // Create the test generation prompt
    const prompt = createTestGenerationPrompt(finalConfig, contextResult.context);

    // Log the operation with token awareness
    if (operationResult.degradationLevel !== 'none') {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Test Generator',
        message: `⚠️ Operating under ${operationResult.degradationLevel} degradation mode`
      });
    }

    // Send to Claude
    const response = await callClaudeWithActions(prompt, [], {
      includeFiles: false, // Context already included
      includeProjectState: false,
      includeMemory: false,
      enableActions: false
    });

    if (response.type === 'message' && response.content) {
      // Parse the multi-file response
      const { parseResult, applyResult } = parseAndApplyClaudeFiles(response.content, 'TEST_GENERATOR', {
        maxFiles: finalConfig.maxTestFiles,
        maxFileSize: 10000, // 10KB max per test file
        logParsing: true,
        validatePaths: true,
        skipEmptyFiles: true
      });

      // Track token usage
      const responseTokens = response.content.length / 3.5;
      tokenBudget.trackUsage(contextResult.tokenCount * 0.7, responseTokens);

      if (parseResult.success && parseResult.files.length > 0) {
        // Filter to only test files in the correct directory
        const testFiles = parseResult.files.filter(file => 
          file.path.includes('/test') || file.path.includes('.test.') || file.path.includes('.spec.')
        );

        useLogStore.getState().addLog({
          level: 'success',
          source: 'Test Generator',
          message: `🧪 Generated ${testFiles.length} test files: ${testFiles.map(f => f.path).join(', ')}`
        });

        // Send notification to message bus
        useMessageBus.getState().sendMessage({
          sender: 'TEST_GENERATOR',
          receiver: 'ALL',
          type: 'completion',
          content: `Test generation complete: ${testFiles.length} test files created`,
          priority: 'high',
          metadata: {
            tags: ['test-generation', 'claude-response', 'automation'],
            testFramework: finalConfig.testFramework,
            filesGenerated: testFiles.length,
            targetDirectory: finalConfig.targetDirectory,
            testFiles: testFiles.map(f => f.path),
            focusAreas: finalConfig.focusAreas,
            tokenUsage: Math.round(responseTokens)
          }
        });

        // Show preview of generated tests
        const preview = previewParsedFiles(parseResult);
        useMessageBus.getState().sendMessage({
          sender: 'TEST_GENERATOR',
          receiver: 'ALL',
          type: 'summary',
          content: preview,
          priority: 'medium',
          metadata: {
            tags: ['test-preview', 'file-generation'],
            previewType: 'test-files'
          }
        });

        return {
          success: true,
          filesGenerated: testFiles.length,
          message: `Successfully generated ${testFiles.length} test files`
        };
      } else {
        const errorMsg = 'Claude response did not contain valid test files';
        useLogStore.getState().addLog({
          level: 'warn',
          source: 'Test Generator',
          message: `⚠️ ${errorMsg}`
        });
        return { success: false, filesGenerated: 0, message: errorMsg };
      }
    } else {
      const errorMsg = 'Invalid response from Claude';
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Test Generator',
        message: `❌ ${errorMsg}`
      });
      return { success: false, filesGenerated: 0, message: errorMsg };
    }

  } catch (error) {
    const errorMsg = `Test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Test Generator',
      message: `❌ ${errorMsg}`
    });
    return { success: false, filesGenerated: 0, message: errorMsg };
  }
}

/**
 * Creates the comprehensive test generation prompt for Claude
 */
function createTestGenerationPrompt(config: TestGenerationConfig, projectContext: string): string {
  const focusAreasText = config.focusAreas.length > 0 
    ? config.focusAreas.join(', ')
    : 'all project areas';

  return `You are an expert test engineer for NeuronForge. Your task is to analyze the project and generate comprehensive ${config.testFramework} test files.

${projectContext}

${getMultiFileFormatInstruction()}

REQUIREMENTS:
- Generate test files for ${focusAreasText}
- Use ${config.testFramework} testing framework
- Place all test files in ${config.targetDirectory}/ directory
- Maximum ${config.maxTestFiles} test files
- Each test file should be complete and runnable

TEST TYPES TO INCLUDE:
✅ Unit tests for individual functions/components
✅ Integration tests for component interactions
${config.includeE2ETests ? '✅ End-to-end tests for full workflows' : '❌ Skip E2E tests'}
✅ Edge cases and error handling
✅ Input validation and boundary conditions
✅ Async operations and promises
✅ Mock external dependencies where needed

NAMING CONVENTIONS:
- Components: ComponentName.test.tsx
- Utils: utilityName.test.ts  
- Stores: storeName.test.ts
- Routes/API: routeName.test.ts

TEST STRUCTURE FOR EACH FILE:
\`\`\`typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Import the module under test
// Import any dependencies/mocks

describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('functionality group', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle edge case', () => {
      // Test implementation
    });

    it('should handle error case', () => {
      // Test implementation
    });
  });
});
\`\`\`

FOCUS AREAS:
${config.focusAreas.map(area => {
  switch (area) {
    case 'components':
      return '- React components: rendering, props, state, user interactions, accessibility';
    case 'utils':
      return '- Utility functions: input/output validation, edge cases, performance';
    case 'routes':
      return '- API routes: request/response, authentication, error handling';
    case 'stores':
      return '- State management: actions, reducers, persistence, subscriptions';
    case 'agents':
      return '- AI agents: Claude integration, token management, error recovery';
    default:
      return `- ${area}: comprehensive functionality testing`;
  }
}).join('\n')}

Generate comprehensive, production-ready test files that ensure code quality and reliability. Focus on practical test scenarios that catch real bugs.

Respond with complete test files using the multi-file format above.`;
}

/**
 * Quick trigger for common test generation scenarios
 */
export const TestGenerationPresets = {
  /**
   * Generate tests for all components
   */
  components: () => triggerClaudeTestGeneration({
    focusAreas: ['components'],
    maxTestFiles: 15,
    includeIntegrationTests: true
  }),

  /**
   * Generate tests for utilities and helpers
   */
  utilities: () => triggerClaudeTestGeneration({
    focusAreas: ['utils'],
    maxTestFiles: 10,
    includeIntegrationTests: false
  }),

  /**
   * Generate tests for API routes
   */
  routes: () => triggerClaudeTestGeneration({
    focusAreas: ['routes'],
    maxTestFiles: 8,
    includeIntegrationTests: true
  }),

  /**
   * Generate tests for state management
   */
  stores: () => triggerClaudeTestGeneration({
    focusAreas: ['stores'],
    maxTestFiles: 12,
    includeIntegrationTests: true
  }),

  /**
   * Generate comprehensive tests for everything
   */
  comprehensive: () => triggerClaudeTestGeneration({
    focusAreas: ['components', 'utils', 'routes', 'stores', 'agents'],
    maxTestFiles: 20,
    includeIntegrationTests: true,
    includeE2ETests: false
  }),

  /**
   * Quick smoke tests for critical functionality
   */
  critical: () => triggerClaudeTestGeneration({
    focusAreas: ['agents', 'stores'],
    maxTestFiles: 6,
    includeIntegrationTests: true
  })
};

/**
 * Get project test coverage summary
 */
export function getTestCoverageSummary(): {
  hasTests: boolean;
  testFileCount: number;
  testedComponents: string[];
  missingTests: string[];
} {
  const { getAllFiles } = useFileContext.getState();
  const allFiles = Object.values(getAllFiles());
  
  const testFiles = allFiles.filter(file => 
    file.path.includes('.test.') || 
    file.path.includes('.spec.') ||
    file.path.includes('/test/') ||
    file.path.includes('/tests/')
  );

  const sourceFiles = allFiles.filter(file => 
    (file.path.includes('/src/') || file.path.includes('/components/')) &&
    !file.path.includes('.test.') &&
    !file.path.includes('.spec.') &&
    (file.path.endsWith('.ts') || file.path.endsWith('.tsx'))
  );

  const testedComponents = testFiles.map(test => {
    // Extract component name from test file
    const fileName = test.path.split('/').pop()?.replace(/\.(test|spec)\.(ts|tsx)$/, '') || '';
    return fileName;
  });

  const missingTests = sourceFiles
    .map(file => file.path.split('/').pop()?.replace(/\.(ts|tsx)$/, '') || '')
    .filter(component => !testedComponents.includes(component));

  return {
    hasTests: testFiles.length > 0,
    testFileCount: testFiles.length,
    testedComponents,
    missingTests
  };
}