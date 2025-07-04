import React, { useState } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useMessageBus, MessagePatterns } from '../../stores/messageBus';
import { useFileContext } from '../../stores/fileContextStore';
import { useMemoryStore } from '../../stores/memoryStore';
import { 
  gatherProjectFiles, 
  getReviewSummary, 
  analyzeFileChanges,
  ReviewResult 
} from '../../utils/selfReviewHelper';
import { 
  askClaudeToReviewAndFix, 
  askClaudeToAnalyzeQuality 
} from '../../utils/claudeApi';

interface SelfReviewPanelProps {
  className?: string;
}

export function SelfReviewPanel({ className = '' }: SelfReviewPanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewResults, setReviewResults] = useState<ReviewResult[]>([]);
  const [qualityReport, setQualityReport] = useState<string>('');
  const [applyingFixes, setApplyingFixes] = useState<Set<string>>(new Set());
  
  const { addLog } = useLogStore();
  const { sendMessage } = useMessageBus();
  const { updateFile, getFile } = useFileContext();
  const { addMemory } = useMemoryStore();

  const reviewSummary = getReviewSummary();

  const handleStartSelfReview = async () => {
    if (isReviewing) return;
    
    setIsReviewing(true);
    setReviewResults([]);
    
    try {
      addLog({
        level: 'info',
        source: 'Self Review',
        message: '🧠 Starting Claude self-review of project files...'
      });

      sendMessage(MessagePatterns.log(
        'SELF_REVIEW',
        `Starting self-review of ${reviewSummary.totalFiles} files (${reviewSummary.totalLines} lines)`,
        ['self-review', 'claude', 'quality']
      ));

      const files = gatherProjectFiles();
      const results = await askClaudeToReviewAndFix(files);
      
      setReviewResults(results);
      
      addLog({
        level: 'info',
        source: 'Self Review',
        message: `✅ Review completed: ${results.length} files need improvements`
      });

      sendMessage(MessagePatterns.log(
        'SELF_REVIEW',
        `Review completed: ${results.length} files identified for improvement`,
        ['self-review', 'completed', 'improvements']
      ));

      // Add to memory
      addMemory(
        `Claude self-review completed: ${results.length} files need improvements out of ${files.length} reviewed`,
        'self_review',
        {
          filesReviewed: files.length,
          filesNeedingFixes: results.length,
          languages: reviewSummary.languages,
          timestamp: Date.now(),
          tags: ['self-review', 'quality-improvement']
        }
      );

    } catch (error) {
      addLog({
        level: 'error',
        source: 'Self Review',
        message: `❌ Self-review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      sendMessage(MessagePatterns.log(
        'SELF_REVIEW',
        `Self-review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ['self-review', 'error', 'failed']
      ));
    } finally {
      setIsReviewing(false);
    }
  };

  const handleQualityAnalysis = async () => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setQualityReport('');
    
    try {
      addLog({
        level: 'info',
        source: 'Self Review',
        message: '📊 Analyzing code quality...'
      });

      const files = gatherProjectFiles();
      const report = await askClaudeToAnalyzeQuality(files);
      
      setQualityReport(report);
      
      addLog({
        level: 'info',
        source: 'Self Review',
        message: '✅ Quality analysis completed'
      });

    } catch (error) {
      addLog({
        level: 'error',
        source: 'Self Review',
        message: `❌ Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFix = async (result: ReviewResult) => {
    if (!result.suggestedContent || applyingFixes.has(result.path)) return;
    
    setApplyingFixes(prev => new Set([...prev, result.path]));
    
    try {
      // Get original content for comparison
      const originalFile = getFile(result.path);
      const originalContent = originalFile?.content || '';
      
      // Apply the fix
      updateFile(result.path, result.suggestedContent, 'CLAUDE_SELF_REVIEW');
      
      // Analyze changes
      const changes = analyzeFileChanges(originalContent, result.suggestedContent);
      
      addLog({
        level: 'info',
        source: 'Self Review',
        message: `✅ Applied fix to ${result.path}: ${changes.join(', ')}`
      });

      sendMessage(MessagePatterns.fileUpdate(
        'SELF_REVIEW',
        result.path,
        `Applied Claude self-review fix: ${changes.join(', ')}`,
        'ALL',
        {
          changeType: 'self_review_fix',
          confidence: result.confidence,
          changes,
          tags: ['self-review', 'auto-fix', 'quality-improvement']
        }
      ));

      // Add to memory
      addMemory(
        `Applied Claude self-review fix to ${result.path}: ${changes.join(', ')}`,
        'self_review_fix',
        {
          filePath: result.path,
          confidence: result.confidence,
          changes,
          timestamp: Date.now(),
          tags: ['self-review', 'auto-fix', 'applied']
        }
      );

      // Remove from results after successful application
      setReviewResults(prev => prev.filter(r => r.path !== result.path));

    } catch (error) {
      addLog({
        level: 'error',
        source: 'Self Review',
        message: `❌ Failed to apply fix to ${result.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setApplyingFixes(prev => {
        const newSet = new Set(prev);
        newSet.delete(result.path);
        return newSet;
      });
    }
  };

  const handleApplyAllFixes = async () => {
    if (reviewResults.length === 0) return;
    
    addLog({
      level: 'info',
      source: 'Self Review',
      message: `🚀 Applying all ${reviewResults.length} fixes...`
    });

    const promises = reviewResults.map(result => handleApplyFix(result));
    await Promise.allSettled(promises);
    
    addLog({
      level: 'info',
      source: 'Self Review',
      message: '✅ All fixes applied successfully'
    });
  };

  const handleClearResults = () => {
    setReviewResults([]);
    setQualityReport('');
    addLog({
      level: 'info',
      source: 'Self Review',
      message: 'Results cleared'
    });
  };

  return (
    <div className={`bg-gray-900 text-white rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          🧠 Claude Self-Review
        </h3>
        
        {/* Project Summary */}
        <div className="bg-gray-800 p-3 rounded mb-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-gray-400">Files to review:</span>
              <span className="ml-2 font-semibold text-blue-400">{reviewSummary.totalFiles}</span>
            </div>
            <div>
              <span className="text-gray-400">High priority:</span>
              <span className="ml-2 font-semibold text-red-400">{reviewSummary.highPriorityFiles}</span>
            </div>
            <div>
              <span className="text-gray-400">Total lines:</span>
              <span className="ml-2 font-semibold text-green-400">{reviewSummary.totalLines.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-400">Est. time:</span>
              <span className="ml-2 font-semibold text-yellow-400">{reviewSummary.estimatedReviewTime}</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-gray-400">Languages:</span>
            <span className="ml-2 text-purple-400">{reviewSummary.languages.join(', ')}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleStartSelfReview}
            disabled={isReviewing || reviewSummary.totalFiles === 0}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              isReviewing || reviewSummary.totalFiles === 0
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {isReviewing ? '⏳ Reviewing...' : '🧠 Start Self-Review'}
          </button>
          
          <button
            onClick={handleQualityAnalysis}
            disabled={isAnalyzing || reviewSummary.totalFiles === 0}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              isAnalyzing || reviewSummary.totalFiles === 0
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isAnalyzing ? '⏳ Analyzing...' : '📊 Quality Analysis'}
          </button>

          {reviewResults.length > 0 && (
            <>
              <button
                onClick={handleApplyAllFixes}
                className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 rounded transition-colors"
              >
                🚀 Apply All Fixes
              </button>
              <button
                onClick={handleClearResults}
                className="px-4 py-2 text-sm font-medium bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              >
                🗑️ Clear Results
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {/* Quality Report */}
        {qualityReport && (
          <div className="p-4 border-b border-gray-700">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              📊 Quality Analysis Report
            </h4>
            <div className="bg-gray-800 p-3 rounded">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                {qualityReport}
              </pre>
            </div>
          </div>
        )}

        {/* Review Results */}
        {reviewResults.length > 0 ? (
          <div className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              🔧 Suggested Fixes ({reviewResults.length})
            </h4>
            <div className="space-y-3">
              {reviewResults.map((result, index) => (
                <div key={result.path} className="bg-gray-800 p-3 rounded border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <code className="text-blue-300 text-sm">{result.path}</code>
                      <span className={`text-xs px-2 py-1 rounded ${
                        result.confidence >= 0.9 ? 'bg-green-600' :
                        result.confidence >= 0.7 ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}>
                        {Math.round(result.confidence * 100)}% confidence
                      </span>
                    </div>
                    <button
                      onClick={() => handleApplyFix(result)}
                      disabled={applyingFixes.has(result.path)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        applyingFixes.has(result.path)
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {applyingFixes.has(result.path) ? '⏳ Applying...' : '✅ Apply Fix'}
                    </button>
                  </div>
                  
                  {result.issues.length > 0 && (
                    <div className="text-sm text-gray-400">
                      <strong>Issues found:</strong>
                      <ul className="ml-4 mt-1">
                        {result.issues.map((issue, i) => (
                          <li key={i} className="text-xs">
                            • {issue.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !isReviewing && !qualityReport && (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">🧠</div>
            <p className="font-medium mb-1">Ready for Self-Review</p>
            <p className="text-sm">
              Claude will analyze your code and suggest quality improvements.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}