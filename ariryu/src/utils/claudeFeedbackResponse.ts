import { useFeedbackStore, FeedbackEntry } from '../stores/feedbackStore';
import { useLogStore } from '../stores/logStore';
import { useMessageBus, MessagePatterns } from '../stores/messageBus';
import { useMemoryStore } from '../stores/memoryStore';
import { useFileContext } from '../stores/fileContextStore';
import { callClaudeWithContext } from './claudeApi';

/**
 * Configuration for Claude's automatic feedback response system
 */
export interface FeedbackResponseConfig {
  enabled: boolean;
  responseThreshold: number; // Only respond to ratings below this threshold
  maxResponsesPerHour: number; // Rate limiting
  cooldownMinutes: number; // Cooldown between responses
  autoRegenerateThreshold: number; // Auto-regenerate files below this rating
  requireUserConfirmation: boolean; // Require user confirmation for actions
}

export const defaultFeedbackResponseConfig: FeedbackResponseConfig = {
  enabled: false, // Disabled by default for safety
  responseThreshold: 3, // Respond to ratings of 2 or below
  maxResponsesPerHour: 10,
  cooldownMinutes: 15,
  autoRegenerateThreshold: 2, // Auto-regenerate files rated 2 or below
  requireUserConfirmation: true
};

/**
 * Types of responses Claude can have to feedback
 */
export type FeedbackResponseType = 
  | 'acknowledge' // Simply acknowledge the feedback
  | 'plan_improvement' // Create a plan to address the feedback
  | 'regenerate_file' // Regenerate the file addressing the feedback
  | 'ask_clarification' // Ask user for more details
  | 'request_review'; // Request human review

export interface FeedbackResponse {
  id: string;
  feedbackId: string;
  responseType: FeedbackResponseType;
  content: string;
  confidence: number;
  actionPlan?: string[];
  timestamp: number;
  executed: boolean;
}

/**
 * Rate limiting for feedback responses
 */
interface ResponseHistory {
  lastResponseTime: number;
  responseCount: number;
  hourlyResponseCount: number;
  lastHourReset: number;
}

export class ClaudeFeedbackResponseEngine {
  private config: FeedbackResponseConfig = defaultFeedbackResponseConfig;
  private responseHistory: ResponseHistory = {
    lastResponseTime: 0,
    responseCount: 0,
    hourlyResponseCount: 0,
    lastHourReset: Date.now()
  };
  private processedFeedbacks: Set<string> = new Set();

  /**
   * Updates the feedback response configuration
   */
  updateConfig(newConfig: Partial<FeedbackResponseConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Feedback Response',
      message: `Configuration updated: ${this.config.enabled ? 'enabled' : 'disabled'}, threshold: ${this.config.responseThreshold}/5`
    });
  }

  /**
   * Processes new feedback and generates appropriate responses
   */
  async processFeedback(feedback: FeedbackEntry): Promise<FeedbackResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Skip if already processed
    if (this.processedFeedbacks.has(feedback.id)) {
      return null;
    }

    // Check if feedback warrants a response
    if (feedback.rating > this.config.responseThreshold) {
      this.processedFeedbacks.add(feedback.id);
      return null;
    }

    // Check rate limits
    if (!this.checkRateLimits()) {
      useLogStore.getState().addLog({
        level: 'warn',
        source: 'Claude Feedback Response',
        message: 'Rate limit exceeded for feedback responses'
      });
      return null;
    }

    try {
      useLogStore.getState().addLog({
        level: 'info',
        source: 'Claude Feedback Response',
        message: `🤖 Processing feedback for ${feedback.target} (${feedback.rating}/5)`
      });

      const response = await this.generateResponse(feedback);
      
      if (response) {
        this.processedFeedbacks.add(feedback.id);
        this.updateResponseHistory();
        
        // Store response in memory
        useMemoryStore.getState().addMemory(
          `Claude responded to user feedback: ${response.content.substring(0, 100)}...`,
          'feedback_response',
          {
            feedbackId: feedback.id,
            responseType: response.responseType,
            confidence: response.confidence,
            targetFile: feedback.target
          }
        );

        // Send notification
        useMessageBus.getState().sendMessage(MessagePatterns.log(
          'CLAUDE_FEEDBACK_RESPONSE',
          `Generated ${response.responseType} response to user feedback`,
          ['feedback', 'response', 'adaptation']
        ));

        // Execute response if appropriate
        if (this.shouldAutoExecute(response, feedback)) {
          await this.executeResponse(response, feedback);
        }

        return response;
      }

      return null;
    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Claude Feedback Response',
        message: `Failed to process feedback: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return null;
    }
  }

  /**
   * Generates a response to user feedback using Claude
   */
  private async generateResponse(feedback: FeedbackEntry): Promise<FeedbackResponse | null> {
    const prompt = `You are Claude, an AI assistant receiving user feedback on your work. Analyze this feedback and determine how to respond appropriately.

USER FEEDBACK:
- Target: ${feedback.target} (${feedback.type})
- Rating: ${feedback.rating}/5
- Category: ${feedback.category}
- Feedback: "${feedback.feedback}"
- Context: ${feedback.context || 'No additional context'}

Your task is to:
1. Acknowledge the feedback professionally
2. Determine the best response type
3. If the rating is very low (≤2), propose specific actions

Response types available:
- acknowledge: Simply acknowledge and thank for feedback
- plan_improvement: Create a specific plan to address the issues
- regenerate_file: Offer to regenerate/fix the file immediately
- ask_clarification: Request more specific details about the issues
- request_review: Suggest human review is needed

Respond in this EXACT JSON format:
{
  "responseType": "plan_improvement",
  "content": "Thank you for the feedback on the Button component. I understand the styling is too verbose and lacks accessibility. I'll address these issues by simplifying the CSS and adding proper ARIA attributes.",
  "confidence": 0.85,
  "actionPlan": [
    "Simplify CSS styles to reduce verbosity",
    "Add proper ARIA labels and roles",
    "Ensure keyboard navigation support",
    "Test with screen readers"
  ]
}

IMPORTANT: 
- Be professional and acknowledge the user's perspective
- For low ratings (≤2), always include an actionPlan
- Be specific about what you'll improve
- Don't make excuses - focus on solutions
- Return ONLY the JSON, no markdown or extra text`;

    try {
      const response = await callClaudeWithContext(prompt, [], {
        includeMemory: false,
        includeFiles: false,
        includeProjectState: false,
        includeTaskMemory: false
      });

      const responseData = JSON.parse(response);
      
      return {
        id: crypto.randomUUID(),
        feedbackId: feedback.id,
        responseType: responseData.responseType || 'acknowledge',
        content: responseData.content || 'Thank you for your feedback.',
        confidence: Math.max(0, Math.min(1, responseData.confidence || 0.7)),
        actionPlan: responseData.actionPlan || [],
        timestamp: Date.now(),
        executed: false
      };
    } catch (error) {
      console.error('Failed to generate feedback response:', error);
      
      // Fallback response
      return {
        id: crypto.randomUUID(),
        feedbackId: feedback.id,
        responseType: 'acknowledge',
        content: `Thank you for the ${feedback.rating}/5 rating on ${feedback.target}. I'll work on improving based on your feedback: "${feedback.feedback}"`,
        confidence: 0.5,
        actionPlan: feedback.rating <= 2 ? ['Review and improve based on user feedback'] : [],
        timestamp: Date.now(),
        executed: false
      };
    }
  }

  /**
   * Determines if a response should be automatically executed
   */
  private shouldAutoExecute(response: FeedbackResponse, feedback: FeedbackEntry): boolean {
    // Only auto-execute for very low ratings if auto-regeneration is enabled
    if (feedback.rating <= this.config.autoRegenerateThreshold && 
        response.responseType === 'regenerate_file') {
      return !this.config.requireUserConfirmation;
    }

    // For other response types, require user confirmation
    return false;
  }

  /**
   * Executes a feedback response
   */
  private async executeResponse(response: FeedbackResponse, feedback: FeedbackEntry): Promise<void> {
    try {
      switch (response.responseType) {
        case 'acknowledge':
          // Send acknowledgment message
          useMessageBus.getState().sendMessage({
            sender: 'CLAUDE_FEEDBACK_RESPONSE',
            receiver: 'USER',
            type: 'feedback_response',
            content: response.content,
            priority: 'medium',
            metadata: {
              tags: ['feedback-response', 'acknowledgment'],
              feedbackId: feedback.id,
              originalRating: feedback.rating
            }
          });
          break;

        case 'plan_improvement':
          // Send improvement plan
          const planMessage = `${response.content}\n\nAction Plan:\n${response.actionPlan?.map(action => `• ${action}`).join('\n')}`;
          
          useMessageBus.getState().sendMessage({
            sender: 'CLAUDE_FEEDBACK_RESPONSE',
            receiver: 'USER',
            type: 'improvement_plan',
            content: planMessage,
            priority: 'high',
            metadata: {
              tags: ['feedback-response', 'improvement-plan'],
              feedbackId: feedback.id,
              actionPlan: response.actionPlan
            }
          });
          break;

        case 'regenerate_file':
          // Trigger file regeneration
          useMessageBus.getState().sendMessage({
            sender: 'CLAUDE_FEEDBACK_RESPONSE',
            receiver: 'CLAUDE_AUTO_EXECUTOR',
            type: 'regenerate_request',
            content: `Regenerate ${feedback.target} based on user feedback: ${feedback.feedback}`,
            priority: 'high',
            metadata: {
              tags: ['feedback-response', 'regeneration'],
              feedbackId: feedback.id,
              targetFile: feedback.target,
              feedbackRating: feedback.rating
            }
          });
          break;

        case 'ask_clarification':
          // Ask for more details
          useMessageBus.getState().sendMessage({
            sender: 'CLAUDE_FEEDBACK_RESPONSE',
            receiver: 'USER',
            type: 'clarification_request',
            content: response.content,
            priority: 'medium',
            metadata: {
              tags: ['feedback-response', 'clarification'],
              feedbackId: feedback.id
            }
          });
          break;

        case 'request_review':
          // Request human review
          useMessageBus.getState().sendMessage({
            sender: 'CLAUDE_FEEDBACK_RESPONSE',
            receiver: 'ALL',
            type: 'review_request',
            content: `Human review requested for ${feedback.target}: ${response.content}`,
            priority: 'high',
            metadata: {
              tags: ['feedback-response', 'review-request'],
              feedbackId: feedback.id,
              targetFile: feedback.target
            }
          });
          break;
      }

      response.executed = true;
      
      useLogStore.getState().addLog({
        level: 'success',
        source: 'Claude Feedback Response',
        message: `✅ Executed ${response.responseType} response for ${feedback.target}`
      });

    } catch (error) {
      useLogStore.getState().addLog({
        level: 'error',
        source: 'Claude Feedback Response',
        message: `Failed to execute response: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Checks rate limits for feedback responses
   */
  private checkRateLimits(): boolean {
    const now = Date.now();
    
    // Reset hourly counter if needed
    if (now - this.responseHistory.lastHourReset > 60 * 60 * 1000) {
      this.responseHistory.hourlyResponseCount = 0;
      this.responseHistory.lastHourReset = now;
    }
    
    // Check hourly limit
    if (this.responseHistory.hourlyResponseCount >= this.config.maxResponsesPerHour) {
      return false;
    }
    
    // Check cooldown
    const timeSinceLastResponse = now - this.responseHistory.lastResponseTime;
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    
    return timeSinceLastResponse >= cooldownMs;
  }

  /**
   * Updates response history for rate limiting
   */
  private updateResponseHistory() {
    const now = Date.now();
    this.responseHistory.lastResponseTime = now;
    this.responseHistory.responseCount++;
    this.responseHistory.hourlyResponseCount++;
  }

  /**
   * Gets current engine status
   */
  getStatus(): {
    config: FeedbackResponseConfig;
    history: ResponseHistory;
    canRespond: boolean;
    nextAllowedTime: number;
    processedCount: number;
  } {
    const canRespond = this.config.enabled && this.checkRateLimits();
    const nextAllowedTime = this.responseHistory.lastResponseTime + 
      (this.config.cooldownMinutes * 60 * 1000);
    
    return {
      config: this.config,
      history: this.responseHistory,
      canRespond,
      nextAllowedTime,
      processedCount: this.processedFeedbacks.size
    };
  }

  /**
   * Processes all recent negative feedback
   */
  async processRecentNegativeFeedback(): Promise<FeedbackResponse[]> {
    const feedbackStore = useFeedbackStore.getState();
    const recentNegative = feedbackStore.getRecentNegativeFeedback(5);
    
    const responses: FeedbackResponse[] = [];
    
    for (const feedback of recentNegative) {
      const response = await this.processFeedback(feedback);
      if (response) {
        responses.push(response);
      }
    }
    
    return responses;
  }

  /**
   * Clears processed feedback history (for testing/reset)
   */
  clearProcessedHistory() {
    this.processedFeedbacks.clear();
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Claude Feedback Response',
      message: 'Processed feedback history cleared'
    });
  }
}

// Global feedback response engine instance
export const claudeFeedbackResponse = new ClaudeFeedbackResponseEngine();

/**
 * Hook for components to use the feedback response engine
 */
export function useFeedbackResponse() {
  return {
    engine: claudeFeedbackResponse,
    processFeedback: (feedback: FeedbackEntry) => claudeFeedbackResponse.processFeedback(feedback),
    updateConfig: (config: Partial<FeedbackResponseConfig>) => claudeFeedbackResponse.updateConfig(config),
    getStatus: () => claudeFeedbackResponse.getStatus(),
    processRecentNegative: () => claudeFeedbackResponse.processRecentNegativeFeedback(),
    clearHistory: () => claudeFeedbackResponse.clearProcessedHistory()
  };
}

/**
 * Utility function to automatically setup feedback response monitoring
 */
export function setupFeedbackResponseMonitoring() {
  const feedbackStore = useFeedbackStore.getState();
  
  // Monitor for new feedback and automatically respond
  const originalAddFeedback = feedbackStore.addFeedback;
  
  feedbackStore.addFeedback = (feedback: FeedbackEntry) => {
    // Call original add function
    originalAddFeedback(feedback);
    
    // Automatically process the feedback for response
    claudeFeedbackResponse.processFeedback(feedback);
  };
  
  useLogStore.getState().addLog({
    level: 'info',
    source: 'Claude Feedback Response',
    message: '🔄 Automatic feedback response monitoring enabled'
  });
}