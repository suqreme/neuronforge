import { useFileContext } from '../stores/fileContextStore';
import { useMessageBus } from '../stores/messageBus';
import { useLogStore } from '../stores/logStore';
import { useTaskMemoryStore } from '../stores/taskMemoryStore';
import { callClaudeWithContext } from '../utils/claudeApi';

export interface ReflectionResult {
  redundantFiles: {
    file: string;
    reason: string;
    similarTo?: string;
  }[];
  unusedFiles: {
    file: string;
    reason: string;
    lastModified?: string;
  }[];
  refactorSuggestions: {
    file: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    category: 'performance' | 'organization' | 'clarity' | 'maintainability';
  }[];
  overallAssessment: {
    codeQuality: number; // 1-10
    fileOrganization: number; // 1-10
    recommendations: string[];
  };
}

export async function runClaudeReflection(): Promise<ReflectionResult> {
  const { files } = useFileContext.getState();
  const { addLog } = useLogStore.getState();
  const { sendMessage } = useMessageBus.getState();
  const { addTaskMemory } = useTaskMemoryStore.getState();

  try {
    addLog({
      level: 'info',
      source: 'Reflection Agent',
      message: '🧹 Starting Claude self-reflection and file cleanup analysis...'
    });

    // Send start notification
    sendMessage({
      sender: 'CLAUDE_REFLECTION',
      receiver: 'ALL',
      type: 'log',
      content: '🧹 Analyzing generated files for cleanup opportunities...',
      priority: 'medium',
      metadata: { tags: ['reflection', 'analysis', 'cleanup'] }
    });

    // Prepare file analysis data
    const analysisData = prepareFileAnalysis(files);
    
    // Generate AI-powered reflection
    const reflectionResult = await generateReflectionAnalysis(analysisData);
    
    // Format and log the results
    const formattedResults = formatReflectionResults(reflectionResult);
    
    addLog({
      level: 'success',
      source: 'Reflection Agent',
      message: formattedResults
    });

    // Send reflection results to message bus
    sendMessage({
      sender: 'CLAUDE_REFLECTION',
      receiver: 'ALL',
      type: 'reflection',
      content: JSON.stringify(reflectionResult, null, 2),
      priority: 'high',
      metadata: {
        tags: ['reflection', 'cleanup-suggestions', 'file-analysis'],
        redundantCount: reflectionResult.redundantFiles.length,
        unusedCount: reflectionResult.unusedFiles.length,
        suggestionCount: reflectionResult.refactorSuggestions.length,
        codeQuality: reflectionResult.overallAssessment.codeQuality
      }
    });

    // Store in task memory
    addTaskMemory({
      agent: 'CLAUDE_REFLECTION',
      taskId: `reflection-${Date.now()}`,
      title: 'File Cleanup & Reflection Analysis',
      content: `Analyzed ${Object.keys(files).length} files:\n- ${reflectionResult.redundantFiles.length} redundant files\n- ${reflectionResult.unusedFiles.length} unused files\n- ${reflectionResult.refactorSuggestions.length} refactor suggestions\n\nCode Quality: ${reflectionResult.overallAssessment.codeQuality}/10`,
      type: 'critique',
      status: 'completed',
      metadata: {
        importance: 'high',
        tags: ['reflection', 'cleanup', 'file-analysis'],
        fileCount: Object.keys(files).length,
        qualityScore: reflectionResult.overallAssessment.codeQuality
      }
    });

    addLog({
      level: 'info',
      source: 'Reflection Agent',
      message: `✅ Reflection complete - Found ${reflectionResult.redundantFiles.length} redundant, ${reflectionResult.unusedFiles.length} unused files, ${reflectionResult.refactorSuggestions.length} suggestions`
    });

    return reflectionResult;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    addLog({
      level: 'error',
      source: 'Reflection Agent',
      message: `Failed to perform reflection analysis: ${errorMsg}`
    });

    // Return fallback result
    return {
      redundantFiles: [],
      unusedFiles: [],
      refactorSuggestions: [{
        file: 'analysis-error',
        suggestion: 'Reflection analysis failed - please try again',
        priority: 'high',
        category: 'maintainability'
      }],
      overallAssessment: {
        codeQuality: 5,
        fileOrganization: 5,
        recommendations: ['Fix reflection analysis system']
      }
    };
  }
}

function prepareFileAnalysis(files: any) {
  // Convert files to analyzable format
  const fileEntries = Object.entries(files);
  
  // Build file dependency map
  const dependencies: Record<string, string[]> = {};
  const imports: Record<string, string[]> = {};
  
  fileEntries.forEach(([path, fileData]: [string, any]) => {
    const content = fileData.content || '';
    
    // Extract imports/dependencies
    const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
    const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    
    imports[path] = [
      ...importMatches.map((match: string) => match.match(/['"]([^'"]+)['"]/)?.[1] || ''),
      ...requireMatches.map((match: string) => match.match(/['"]([^'"]+)['"]/)?.[1] || '')
    ].filter(Boolean);
  });

  return {
    fileCount: fileEntries.length,
    totalSize: fileEntries.reduce((sum, [, fileData]: [string, any]) => sum + (fileData.content?.length || 0), 0),
    files: fileEntries.map(([path, fileData]: [string, any]) => ({
      path,
      size: fileData.content?.length || 0,
      language: fileData.language || 'unknown',
      lastUpdated: fileData.lastUpdatedBy || 'unknown',
      content: fileData.content || '',
      imports: imports[path] || []
    })),
    dependencies: imports
  };
}

async function generateReflectionAnalysis(data: any): Promise<ReflectionResult> {
  const prompt = `You are an expert software architect performing a post-development code review and cleanup analysis. 

Analyze this codebase and identify opportunities for improvement:

PROJECT OVERVIEW:
- Files: ${data.fileCount}
- Total Size: ${data.totalSize} characters
- Languages: ${[...new Set(data.files.map((f: any) => f.language))].join(', ')}

FILES AND DEPENDENCIES:
${data.files.map((file: any) => 
  `### ${file.path} (${file.size} chars, ${file.language})
Imports: ${file.imports.join(', ') || 'None'}
Content Preview: ${file.content.substring(0, 200)}${file.content.length > 200 ? '...' : ''}`
).join('\n\n')}

DEPENDENCY MAP:
${Object.entries(data.dependencies).map(([file, deps]) => 
  `${file}: [${(deps as string[]).join(', ')}]`
).join('\n')}

Provide a comprehensive analysis in this exact JSON format:

{
  "redundantFiles": [
    {
      "file": "path/to/duplicate.tsx",
      "reason": "Duplicate functionality found in similar file",
      "similarTo": "path/to/original.tsx"
    }
  ],
  "unusedFiles": [
    {
      "file": "path/to/unused.tsx", 
      "reason": "No imports or references found in other files",
      "lastModified": "agent-name"
    }
  ],
  "refactorSuggestions": [
    {
      "file": "path/to/file.tsx",
      "suggestion": "Specific actionable refactor recommendation",
      "priority": "high|medium|low",
      "category": "performance|organization|clarity|maintainability"
    }
  ],
  "overallAssessment": {
    "codeQuality": 8.5,
    "fileOrganization": 7.0,
    "recommendations": ["High-level recommendations for the entire codebase"]
  }
}

Focus on:
1. Files with identical or very similar functionality
2. Files that are never imported or referenced
3. Poor naming conventions or file organization
4. Opportunities to consolidate related functionality
5. Files that could be split or merged for better maintainability

Be practical and specific. Return ONLY the JSON, no additional text.`;

  const response = await callClaudeWithContext(prompt, [], {
    includeMemory: false,
    includeFiles: false,
    includeProjectState: false,
    includeTaskMemory: false
  });

  try {
    const analysis = JSON.parse(response);
    
    return {
      redundantFiles: analysis.redundantFiles || [],
      unusedFiles: analysis.unusedFiles || [],
      refactorSuggestions: analysis.refactorSuggestions || [],
      overallAssessment: {
        codeQuality: Math.min(Math.max(analysis.overallAssessment?.codeQuality || 7, 1), 10),
        fileOrganization: Math.min(Math.max(analysis.overallAssessment?.fileOrganization || 7, 1), 10),
        recommendations: analysis.overallAssessment?.recommendations || []
      }
    };
  } catch (parseError) {
    console.error('Failed to parse reflection analysis:', parseError);
    
    // Create fallback analysis from raw response
    const lines = response.split('\n');
    const suggestions = lines
      .filter(line => line.includes('file') || line.includes('suggest') || line.includes('refactor'))
      .slice(0, 3)
      .map((line, i) => ({
        file: `analysis-item-${i}`,
        suggestion: line.trim(),
        priority: 'medium' as const,
        category: 'maintainability' as const
      }));

    return {
      redundantFiles: [],
      unusedFiles: [],
      refactorSuggestions: suggestions,
      overallAssessment: {
        codeQuality: 6,
        fileOrganization: 6,
        recommendations: ['Improve reflection analysis parsing']
      }
    };
  }
}

function formatReflectionResults(result: ReflectionResult): string {
  return `🧹 CLAUDE REFLECTION ANALYSIS

📊 OVERALL ASSESSMENT:
Code Quality: ${result.overallAssessment.codeQuality}/10
File Organization: ${result.overallAssessment.fileOrganization}/10

🔄 REDUNDANT FILES (${result.redundantFiles.length}):
${result.redundantFiles.map(file => `• ${file.file}: ${file.reason}${file.similarTo ? ` (similar to ${file.similarTo})` : ''}`).join('\n')}

🗑️ UNUSED FILES (${result.unusedFiles.length}):
${result.unusedFiles.map(file => `• ${file.file}: ${file.reason}`).join('\n')}

💡 REFACTOR SUGGESTIONS (${result.refactorSuggestions.length}):
${result.refactorSuggestions.slice(0, 5).map(suggestion => `• [${suggestion.priority.toUpperCase()}] ${suggestion.file}: ${suggestion.suggestion} (${suggestion.category})`).join('\n')}

🎯 RECOMMENDATIONS:
${result.overallAssessment.recommendations.slice(0, 3).map(rec => `• ${rec}`).join('\n')}`;
}

// Quick reflection for immediate feedback
export async function quickReflection(): Promise<string> {
  try {
    const result = await runClaudeReflection();
    return `Quick Reflection: Quality ${result.overallAssessment.codeQuality}/10, ${result.redundantFiles.length} redundant files, ${result.unusedFiles.length} unused files, ${result.refactorSuggestions.length} suggestions.`;
  } catch (error) {
    return `Quick reflection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}