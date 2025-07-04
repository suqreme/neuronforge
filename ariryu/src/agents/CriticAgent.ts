import { useFileContext } from '../stores/fileContextStore';
import { useMessageBus, AGENT_TYPES, MessagePatterns } from '../stores/messageBus';
import { useLogStore } from '../stores/logStore';
import { useMemoryStore } from '../stores/memoryStore';
import { useTaskMemoryStore } from '../stores/taskMemoryStore';
import { callClaudeWithContext } from '../utils/claudeApi';

export interface CriticSummary {
  buildProgress: string;
  codeQuality: {
    score: number; // 1-10
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  projectStatus: {
    completedFeatures: string[];
    workingComponents: string[];
    brokenComponents: string[];
    missingFeatures: string[];
  };
  nextSteps: string[];
  urgentIssues: string[];
  confidence: number;
  timestamp: number;
}

export async function runCriticAgent(): Promise<CriticSummary> {
  const { files } = useFileContext.getState();
  const { getRecentMessages } = useMessageBus.getState();
  const { logs } = useLogStore.getState();
  const { getRecentMemory } = useMemoryStore.getState();
  const { getRecentMemory: getTaskMemory, addTaskMemory } = useTaskMemoryStore.getState();
  const { addLog } = useLogStore.getState();
  const { sendMessage } = useMessageBus.getState();

  try {
    addLog({
      level: 'info',
      source: 'Critic Agent',
      message: '🧠 Starting intelligent build progress analysis...'
    });

    // Send start notification
    sendMessage(MessagePatterns.log(
      'CRITIC_AGENT',
      '🧠 Analyzing build progress and providing intelligent feedback...',
      ['criticism', 'analysis', 'build-progress']
    ));

    // Gather comprehensive data
    const analysisData = gatherAnalysisData(files, logs, getRecentMessages(20), getRecentMemory(undefined, 15), getTaskMemory('CLAUDE', 10));
    
    // Generate AI-powered criticism and analysis
    const criticSummary = await generateCriticAnalysis(analysisData);
    
    // Format and log the criticism
    const formattedSummary = formatCriticSummary(criticSummary);
    
    addLog({
      level: 'success',
      source: 'Critic Agent',
      message: formattedSummary
    });

    // Send criticism to message bus
    sendMessage({
      sender: 'CRITIC',
      receiver: 'ALL',
      type: 'summary',
      content: formattedSummary,
      priority: criticSummary.urgentIssues.length > 0 ? 'high' : 'medium',
      metadata: {
        tags: ['criticism', 'build-summary', 'ai-analysis'],
        codeQualityScore: criticSummary.codeQuality.score,
        urgentIssueCount: criticSummary.urgentIssues.length,
        confidence: criticSummary.confidence
      }
    });

    // Store in task memory
    addTaskMemory({
      agent: 'CRITIC',
      taskId: `build-criticism-${Date.now()}`,
      title: 'Build Progress Analysis',
      content: `Quality Score: ${criticSummary.codeQuality.score}/10\n\n${criticSummary.buildProgress}\n\nUrgent Issues: ${criticSummary.urgentIssues.length}\nNext Steps: ${criticSummary.nextSteps.length}`,
      type: 'critique',
      status: 'completed',
      metadata: {
        importance: criticSummary.urgentIssues.length > 0 ? 'high' : 'medium',
        tags: ['build-analysis', 'code-quality', 'criticism'],
        confidence: criticSummary.confidence,
        critiqueScore: criticSummary.codeQuality.score
      }
    });

    // Store in regular memory for context
    useMemoryStore.getState().addMemory(
      `Claude Critic Analysis: Build quality ${criticSummary.codeQuality.score}/10. ${criticSummary.urgentIssues.length} urgent issues identified.`,
      'claude_response',
      {
        importance: 'high',
        tags: ['criticism', 'build-analysis', 'ai-feedback'],
        filePath: `analysis-${Date.now()}`
      }
    );

    addLog({
      level: 'info',
      source: 'Critic Agent',
      message: `✅ Analysis complete - Quality: ${criticSummary.codeQuality.score}/10, Issues: ${criticSummary.urgentIssues.length}`
    });

    // Generate improvement suggestions based on the analysis
    await generateImprovementSuggestions(criticSummary, files);

    return criticSummary;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    addLog({
      level: 'error',
      source: 'Critic Agent',
      message: `Failed to generate criticism: ${errorMsg}`
    });

    // Return fallback summary
    return {
      buildProgress: `Criticism failed due to error: ${errorMsg}`,
      codeQuality: {
        score: 5,
        strengths: [],
        weaknesses: ['Analysis system error'],
        recommendations: ['Debug critic agent']
      },
      projectStatus: {
        completedFeatures: [],
        workingComponents: [],
        brokenComponents: ['Critic analysis system'],
        missingFeatures: ['Functional criticism']
      },
      nextSteps: ['Fix critic agent error'],
      urgentIssues: ['Critic system failure'],
      confidence: 0.1,
      timestamp: Date.now()
    };
  }
}

function gatherAnalysisData(files: any, logs: any[], messages: any[], memories: any[], taskMemories: any[]) {
  // Recent activity analysis
  const recentLogs = logs.slice(-30).map(log => 
    `[${log.level}] ${log.source}: ${log.message}`
  );

  // File summary
  const fileList = Object.values(files).map((file: any) => ({
    path: file.path,
    size: file.content?.length || 0,
    language: file.language,
    lastUpdated: file.lastUpdatedBy
  }));

  // Error tracking
  const errorLogs = logs.filter(log => log.level === 'error' || log.level === 'warn').slice(-10);
  
  // Agent activity
  const agentActivity = messages.slice(-15).map(msg => 
    `${msg.sender} → ${msg.receiver}: ${msg.type} - ${msg.content?.substring(0, 100) || 'No content'}`
  );

  // Recent task memory
  const recentTasks = taskMemories.slice(-8).map(task => 
    `${task.type}: ${task.title} (${task.status})`
  );

  return {
    fileCount: fileList.length,
    totalSize: fileList.reduce((sum, f) => sum + f.size, 0),
    languages: [...new Set(fileList.map(f => f.language))],
    recentLogs: recentLogs.slice(-20),
    errorLogs,
    agentActivity,
    recentTasks,
    fileList: fileList.slice(0, 15) // Top 15 files
  };
}

async function generateCriticAnalysis(data: any): Promise<CriticSummary> {
  const prompt = `You are a senior software architect and build critic. Analyze this development session and provide intelligent feedback.

PROJECT DATA:
- Files: ${data.fileCount} (${data.totalSize} total chars)
- Languages: ${data.languages.join(', ')}
- Recent Errors: ${data.errorLogs.length}

RECENT BUILD ACTIVITY:
${data.recentLogs.join('\n')}

ERROR LOGS:
${data.errorLogs.map(log => `• ${log.message}`).join('\n')}

AGENT ACTIVITY:
${data.agentActivity.join('\n')}

RECENT TASKS:
${data.recentTasks.join('\n')}

FILES:
${data.fileList.map(f => `• ${f.path} (${f.size} chars, ${f.language})`).join('\n')}

Provide a comprehensive analysis in this exact JSON format:

{
  "buildProgress": "High-level summary of what's been built and current state",
  "codeQuality": {
    "score": 7.5,
    "strengths": ["List of code quality strengths"],
    "weaknesses": ["List of areas needing improvement"],
    "recommendations": ["Specific actionable recommendations"]
  },
  "projectStatus": {
    "completedFeatures": ["Working features"],
    "workingComponents": ["Functional components"],
    "brokenComponents": ["Components with issues"],
    "missingFeatures": ["Key missing functionality"]
  },
  "nextSteps": ["Prioritized action items"],
  "urgentIssues": ["Critical problems requiring immediate attention"],
  "confidence": 0.85
}

Be thorough, practical, and focus on actionable insights that help improve the development process.

Return ONLY the JSON, no additional text.`;

  const response = await callClaudeWithContext(prompt, [], {
    includeMemory: false,
    includeFiles: false,
    includeProjectState: false,
    includeTaskMemory: false
  });

  try {
    const analysis = JSON.parse(response);
    
    return {
      buildProgress: analysis.buildProgress || 'No build progress summary available',
      codeQuality: {
        score: Math.min(Math.max(analysis.codeQuality?.score || 5, 1), 10),
        strengths: analysis.codeQuality?.strengths || [],
        weaknesses: analysis.codeQuality?.weaknesses || [],
        recommendations: analysis.codeQuality?.recommendations || []
      },
      projectStatus: {
        completedFeatures: analysis.projectStatus?.completedFeatures || [],
        workingComponents: analysis.projectStatus?.workingComponents || [],
        brokenComponents: analysis.projectStatus?.brokenComponents || [],
        missingFeatures: analysis.projectStatus?.missingFeatures || []
      },
      nextSteps: analysis.nextSteps || [],
      urgentIssues: analysis.urgentIssues || [],
      confidence: Math.min(Math.max(analysis.confidence || 0.5, 0), 1),
      timestamp: Date.now()
    };
  } catch (parseError) {
    console.error('Failed to parse critic analysis:', parseError);
    
    // Fallback analysis based on available data
    return {
      buildProgress: `Analysis of ${data.fileCount} files with ${data.errorLogs.length} recent errors. ${response.content.substring(0, 200)}...`,
      codeQuality: {
        score: Math.max(1, 8 - data.errorLogs.length), // Simple scoring based on errors
        strengths: data.fileCount > 0 ? ['Files present'] : [],
        weaknesses: data.errorLogs.length > 0 ? ['Recent errors detected'] : [],
        recommendations: ['Fix parsing issues in critic analysis']
      },
      projectStatus: {
        completedFeatures: data.fileCount > 5 ? ['File system'] : [],
        workingComponents: data.languages,
        brokenComponents: data.errorLogs.length > 0 ? ['Error-prone components'] : [],
        missingFeatures: ['Critic analysis parsing']
      },
      nextSteps: ['Debug critic response parsing', 'Continue development'],
      urgentIssues: data.errorLogs.length > 3 ? ['Multiple errors detected'] : [],
      confidence: 0.3,
      timestamp: Date.now()
    };
  }
}

function formatCriticSummary(summary: CriticSummary): string {
  return `🧠 CLAUDE CRITIC ANALYSIS

📊 BUILD PROGRESS:
${summary.buildProgress}

🎯 CODE QUALITY: ${summary.codeQuality.score}/10 (${Math.round(summary.confidence * 100)}% confidence)

✅ STRENGTHS:
${summary.codeQuality.strengths.map(s => `• ${s}`).join('\n')}

⚠️ WEAKNESSES:
${summary.codeQuality.weaknesses.map(w => `• ${w}`).join('\n')}

💡 RECOMMENDATIONS:
${summary.codeQuality.recommendations.slice(0, 3).map(r => `• ${r}`).join('\n')}

🚨 URGENT ISSUES (${summary.urgentIssues.length}):
${summary.urgentIssues.slice(0, 3).map(issue => `• ${issue}`).join('\n')}

🎯 NEXT STEPS:
${summary.nextSteps.slice(0, 3).map(step => `• ${step}`).join('\n')}

📋 PROJECT STATUS:
✅ Working: ${summary.projectStatus.workingComponents.length} components
❌ Broken: ${summary.projectStatus.brokenComponents.length} components
🔄 Missing: ${summary.projectStatus.missingFeatures.length} features`;
}

// Utility function for periodic criticism
export function setupPeriodicCriticism(intervalMinutes: number = 3): () => void {
  const interval = setInterval(async () => {
    try {
      await runCriticAgent();
    } catch (error) {
      console.warn('Periodic criticism failed:', error);
    }
  }, intervalMinutes * 60 * 1000);

  // Return cleanup function
  return () => clearInterval(interval);
}

// Generate improvement suggestions based on critic analysis
async function generateImprovementSuggestions(summary: CriticSummary, files: any): Promise<void> {
  try {
    const { addLog } = useLogStore.getState();
    const { sendMessage } = useMessageBus.getState();
    const { addTaskMemory } = useTaskMemoryStore.getState();

    addLog({
      level: 'info',
      source: 'Critic Agent',
      message: '💡 Generating improvement suggestions based on analysis...'
    });

    // Build context from analysis and current files
    const fileContext = Object.values(files).slice(0, 5).map((file: any) => 
      `### ${file.path}\n${file.content?.substring(0, 1000) || 'No content'}${file.content?.length > 1000 ? '...' : ''}`
    ).join('\n\n');

    const improvementPrompt = `Based on the following build analysis and current file structure, suggest 3 specific, actionable improvements that would enhance the codebase.

ANALYSIS SUMMARY:
Build Progress: ${summary.buildProgress}
Code Quality Score: ${summary.codeQuality.score}/10
Confidence: ${Math.round(summary.confidence * 100)}%

IDENTIFIED WEAKNESSES:
${summary.codeQuality.weaknesses.map(w => `• ${w}`).join('\n')}

URGENT ISSUES:
${summary.urgentIssues.map(i => `• ${i}`).join('\n')}

CURRENT RECOMMENDATIONS:
${summary.codeQuality.recommendations.map(r => `• ${r}`).join('\n')}

TOP FILES:
${fileContext}

Please provide 3 concrete improvement suggestions in JSON format:

{
  "suggestions": [
    {
      "id": "unique-id",
      "title": "Brief descriptive title",
      "description": "Detailed explanation of the improvement",
      "priority": "high|medium|low",
      "estimatedEffort": "small|medium|large",
      "category": "performance|security|maintainability|features|refactoring",
      "targetFiles": ["file1.tsx", "file2.ts"],
      "implementation": "Step-by-step implementation guide"
    }
  ]
}

Focus on practical improvements that address the identified weaknesses and urgent issues. Make suggestions specific and actionable.

Return ONLY the JSON, no additional text.`;

    const response = await callClaudeWithContext(improvementPrompt, [], {
      includeMemory: false,
      includeFiles: false,
      includeProjectState: false,
      includeTaskMemory: false
    });

    try {
      const suggestions = JSON.parse(response);
      
      if (suggestions.suggestions && Array.isArray(suggestions.suggestions)) {
        // Send suggestions to message bus
        sendMessage({
          sender: 'CRITIC',
          receiver: 'ALL',
          type: 'suggestions',
          content: JSON.stringify(suggestions.suggestions, null, 2),
          priority: 'medium',
          metadata: {
            tags: ['improvements', 'suggestions', 'actionable'],
            analysisScore: summary.codeQuality.score,
            suggestionCount: suggestions.suggestions.length,
            confidence: summary.confidence
          }
        });

        // Log each suggestion
        suggestions.suggestions.forEach((suggestion: any, index: number) => {
          addLog({
            level: 'info',
            source: 'Critic Agent',
            message: `💡 Suggestion ${index + 1}: ${suggestion.title} (${suggestion.priority} priority, ${suggestion.category})`
          });
        });

        // Store in task memory
        addTaskMemory({
          agent: 'CRITIC',
          taskId: `suggestions-${Date.now()}`,
          title: `${suggestions.suggestions.length} Improvement Suggestions`,
          content: `Generated ${suggestions.suggestions.length} actionable improvements:\n\n${suggestions.suggestions.map((s: any, i: number) => `${i + 1}. ${s.title} (${s.priority})\n   ${s.description}`).join('\n\n')}`,
          type: 'planning',
          status: 'completed',
          metadata: {
            importance: 'high',
            tags: ['suggestions', 'improvements', 'critic-generated'],
            suggestionCount: suggestions.suggestions.length,
            qualityScore: summary.codeQuality.score
          }
        });

        addLog({
          level: 'success',
          source: 'Critic Agent',
          message: `✅ Generated ${suggestions.suggestions.length} improvement suggestions - check CriticPanel for details`
        });
      } else {
        throw new Error('Invalid suggestion format received');
      }
    } catch (parseError) {
      addLog({
        level: 'warn',
        source: 'Critic Agent',
        message: `⚠️ Failed to parse improvement suggestions: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
      });
      
      // Send raw response as fallback
      sendMessage({
        sender: 'CRITIC',
        receiver: 'ALL',
        type: 'suggestions',
        content: `Raw suggestions (parsing failed):\n\n${response.content}`,
        priority: 'low',
        metadata: {
          tags: ['improvements', 'suggestions', 'parse-error'],
          analysisScore: summary.codeQuality.score
        }
      });
    }
  } catch (error) {
    const { addLog } = useLogStore.getState();
    addLog({
      level: 'error',
      source: 'Critic Agent',
      message: `❌ Failed to generate improvement suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

// Quick criticism for immediate feedback
export async function quickCriticism(): Promise<string> {
  try {
    const summary = await runCriticAgent();
    return `Quick Analysis: Quality ${summary.codeQuality.score}/10, ${summary.urgentIssues.length} urgent issues, ${summary.nextSteps.length} recommended actions.`;
  } catch (error) {
    return `Quick criticism failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}