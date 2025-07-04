import { useEditorStore } from '../stores/editorStore';
import { useLogStore } from '../stores/logStore';
import { useAgentMemoryStore } from '../stores/agentMemoryStore';
import { useFileContext } from '../stores/fileContextStore';
import { useTaskMemoryStore } from '../stores/taskMemoryStore';
import { reviewFile, autoImproveFile, CritiqueResult } from '../agents/ClaudeCritic';
import { EditorFile } from '../types';

// Toast notification function (will be set by the component)
let showToast: ((message: string, type: 'success' | 'error' | 'info' | 'warning') => void) | null = null;

export const setToastFunction = (fn: typeof showToast) => {
  showToast = fn;
};

// File system interface for writing agent-generated files
export async function writeAgentFile(path: string, content: string, language?: string, agentId: string = 'system', enableSelfCritique?: boolean): Promise<void> {
  // If self-critique is requested, use the enhanced version
  if (enableSelfCritique) {
    await writeAgentFileWithCritique(path, content, language, agentId, true);
    return;
  }
  const { openFile } = useEditorStore.getState();
  const { addLog } = useLogStore.getState();
  const { addMemory } = useAgentMemoryStore.getState();
  const { updateFile } = useFileContext.getState();
  const { addTaskMemory } = useTaskMemoryStore.getState();

  try {
    // Determine file language from extension if not provided
    const fileLanguage = language || getLanguageFromPath(path);
    
    // Create the file object
    const newFile: EditorFile = {
      path,
      content,
      language: fileLanguage,
      isDirty: false,
    };

    // Write the file to the editor store
    openFile(newFile);

    // Update file context store for agent visibility
    updateFile(path, content, agentId, fileLanguage);

    // Add memory entry for agent tracking
    addMemory(agentId, {
      type: 'file_generation',
      file: path,
      content: content.length > 500 ? content.substring(0, 500) + '...' : content,
      message: `Generated file: ${path} (${content.split('\n').length} lines)`,
      metadata: {
        language: fileLanguage,
        fileSize: content.length,
        lineCount: content.split('\n').length
      }
    });

    // Add task memory entry
    addTaskMemory({
      agent: agentId.toUpperCase(),
      taskId: `file-generation-${Date.now()}`,
      title: `Generated ${path}`,
      content: `Created file ${path} with ${content.split('\n').length} lines of ${fileLanguage} code.\n\nPreview:\n${content.substring(0, 300)}${content.length > 300 ? '...' : ''}`,
      type: 'file_generation',
      status: 'completed',
      metadata: {
        filePath: path,
        actionType: 'create_file',
        importance: 'medium',
        tags: ['file-creation', fileLanguage, 'code-generation'],
        relatedFiles: [path]
      }
    });

    // Log the file creation
    addLog({
      level: 'success',
      source: 'FileWriter',
      message: `Created file: ${path} (${content.split('\n').length} lines)`
    });

    // Show toast notification
    if (showToast) {
      const fileName = path.split('/').pop() || path;
      showToast(`Created ${fileName}`, 'success');
    }

    console.log('[Agent] Wrote file:', path);
  } catch (error) {
    // Add error memory entry
    addMemory(agentId, {
      type: 'error',
      file: path,
      message: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { attempted: true }
    });

    addLog({
      level: 'error',
      source: 'FileWriter',
      message: `Failed to write file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    throw error;
  }
}

// Write multiple files from a batch
export async function writeAgentFiles(files: Array<{ path: string; content: string; language?: string }>, agentId: string = 'system', enableSelfCritique?: boolean): Promise<void> {
  // If self-critique is requested, use the enhanced batch version
  if (enableSelfCritique) {
    await writeAgentFilesWithCritique(files, agentId, true);
    return;
  }
  const results = [];
  const { addMemory } = useAgentMemoryStore.getState();
  
  // Add batch start memory entry
  addMemory(agentId, {
    type: 'task_assignment',
    message: `Starting batch file generation: ${files.length} files`,
    metadata: { fileCount: files.length, fileList: files.map(f => f.path) }
  });
  
  for (const file of files) {
    try {
      await writeAgentFile(file.path, file.content, file.language, agentId);
      results.push({ path: file.path, success: true });
    } catch (error) {
      results.push({ 
        path: file.path, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Log batch results
  const { addLog } = useLogStore.getState();
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  // Add batch completion memory entry
  addMemory(agentId, {
    type: 'completion',
    message: `Batch generation complete: ${successful} successful, ${failed} failed`,
    metadata: { 
      successful, 
      failed, 
      successfulFiles: results.filter(r => r.success).map(r => r.path),
      failedFiles: results.filter(r => !r.success).map(r => r.path)
    }
  });
  
  addLog({
    level: successful > 0 && failed === 0 ? 'success' : failed > 0 ? 'warn' : 'error',
    source: 'FileWriter',
    message: `Batch write complete: ${successful} successful, ${failed} failed`
  });
}

// Update existing file content
export async function updateAgentFile(path: string, content: string, agentId: string = 'system'): Promise<void> {
  const { updateContent } = useEditorStore.getState();
  const { addLog } = useLogStore.getState();
  const { addMemory } = useAgentMemoryStore.getState();
  const { updateFile } = useFileContext.getState();

  try {
    updateContent(path, content);
    
    // Update file context store for agent visibility
    updateFile(path, content, agentId, getLanguageFromPath(path));
    
    // Add memory entry for file update
    addMemory(agentId, {
      type: 'file_update',
      file: path,
      content: content.length > 300 ? content.substring(0, 300) + '...' : content,
      message: `Updated file: ${path} (${content.split('\n').length} lines)`,
      metadata: {
        fileSize: content.length,
        lineCount: content.split('\n').length,
        action: 'update'
      }
    });
    
    addLog({
      level: 'info',
      source: 'FileWriter',
      message: `Updated file: ${path}`
    });

    console.log('[Agent] Updated file:', path);
  } catch (error) {
    // Add error memory entry
    addMemory(agentId, {
      type: 'error',
      file: path,
      message: `Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { attempted: true, action: 'update' }
    });

    addLog({
      level: 'error',
      source: 'FileWriter',
      message: `Failed to update file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    throw error;
  }
}

// Helper function to determine language from file path
function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'tsx':
    case 'ts':
      return 'typescript';
    case 'jsx':
    case 'js':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'vue':
      return 'vue';
    case 'svelte':
      return 'svelte';
    default:
      return 'plaintext';
  }
}

// Helper to check if file exists in editor
export function fileExists(path: string): boolean {
  const { openTabs } = useEditorStore.getState();
  const { getFile } = useFileContext.getState();
  return openTabs.some(tab => tab.path === path) || getFile(path) !== undefined;
}

// Helper to get current file content
export function getFileContent(path: string): string | null {
  const { openTabs } = useEditorStore.getState();
  const { getFile } = useFileContext.getState();
  
  // First check editor store
  const editorFile = openTabs.find(tab => tab.path === path);
  if (editorFile) {
    return editorFile.content;
  }
  
  // Then check file context store
  const contextFile = getFile(path);
  return contextFile ? contextFile.content : null;
}

// Write agent-generated file with self-critique
export async function writeAgentFileWithCritique(
  path: string, 
  content: string, 
  language?: string, 
  agentId: string = 'system',
  enableSelfCritique: boolean = true
): Promise<CritiqueResult | null> {
  const { addLog } = useLogStore.getState();
  const { addMemory } = useAgentMemoryStore.getState();
  const { addTaskMemory } = useTaskMemoryStore.getState();

  try {
    addLog({
      level: 'info',
      source: 'File Writer',
      message: `Writing ${path} with ${enableSelfCritique ? 'self-critique enabled' : 'self-critique disabled'}`
    });

    let finalContent = content;
    let critiqueResult: CritiqueResult | null = null;

    // Perform self-critique if enabled
    if (enableSelfCritique) {
      addLog({
        level: 'info',
        source: 'File Writer',
        message: `🔍 Running self-critique for ${path}...`
      });

      critiqueResult = await reviewFile(path, content, `Generated by ${agentId}`);
      
      // Handle critique results
      switch (critiqueResult.status) {
        case 'approved':
          addLog({
            level: 'success',
            source: 'File Writer',
            message: `✅ Code approved by self-critique: ${path}`
          });
          break;

        case 'needs_improvement':
          addLog({
            level: 'warn',
            source: 'File Writer',
            message: `🛠️ Code needs improvement, auto-fixing: ${path}`
          });
          
          if (critiqueResult.improvedContent) {
            finalContent = critiqueResult.improvedContent;
            addLog({
              level: 'info',
              source: 'File Writer',
              message: `✨ Applied auto-improvements to ${path}`
            });
          }
          break;

        case 'rejected':
          addLog({
            level: 'error',
            source: 'File Writer',
            message: `❌ Code rejected by self-critique: ${path}`
          });
          
          // Try to auto-improve rejected code
          try {
            finalContent = await autoImproveFile(path, content, critiqueResult);
            addLog({
              level: 'warn',
              source: 'File Writer',
              message: `🔧 Attempted to auto-fix rejected code: ${path}`
            });
          } catch (error) {
            addLog({
              level: 'error',
              source: 'File Writer',
              message: `Failed to auto-fix rejected code: ${path}`
            });
          }
          break;
      }

      // Add critique summary to memory
      addMemory(agentId, {
        type: 'self_critique',
        file: path,
        content: `Self-critique result: ${critiqueResult.status.toUpperCase()}`,
        message: `${critiqueResult.explanation.substring(0, 200)}...`,
        metadata: {
          originalLength: content.length,
          finalLength: finalContent.length,
          wasImproved: finalContent !== content,
          status: critiqueResult.status,
          confidence: critiqueResult.confidence
        }
      });

      // Add task memory for critique process
      addTaskMemory({
        agent: agentId.toUpperCase(),
        taskId: `critique-${Date.now()}`,
        title: `Self-Critique: ${path}`,
        content: `Reviewed and ${critiqueResult.status === 'approved' ? 'approved' : critiqueResult.status === 'rejected' ? 'fixed' : 'improved'} file ${path}.\n\nStatus: ${critiqueResult.status.toUpperCase()}\nConfidence: ${Math.round(critiqueResult.confidence * 100)}%\n\nAnalysis: ${critiqueResult.explanation}\n\n${critiqueResult.suggestions.length > 0 ? `Suggestions:\n${critiqueResult.suggestions.map(s => `• ${s}`).join('\n')}` : ''}`,
        type: 'critique',
        status: critiqueResult.status === 'approved' ? 'completed' : 'completed',
        metadata: {
          filePath: path,
          actionType: 'self_critique',
          importance: critiqueResult.status === 'rejected' ? 'high' : 'medium',
          tags: ['self-critique', 'code-review', critiqueResult.status],
          relatedFiles: [path],
          critiqueScore: critiqueResult.confidence,
          confidence: critiqueResult.confidence
        }
      });
    }

    // Write the final content using the standard function
    await writeAgentFile(path, finalContent, language, agentId);

    // Show appropriate toast notification
    if (showToast && critiqueResult) {
      const status = critiqueResult.status;
      const statusEmoji = { 'approved': '✅', 'needs_improvement': '🛠️', 'rejected': '❌' }[status];
      const fileName = path.split('/').pop() || path;
      
      showToast(
        `${statusEmoji} ${fileName} ${status === 'approved' ? 'approved' : status === 'rejected' ? 'fixed' : 'improved'}`,
        status === 'approved' ? 'success' : status === 'rejected' ? 'warning' : 'info'
      );
    }

    return critiqueResult;

  } catch (error) {
    addLog({
      level: 'error',
      source: 'File Writer',
      message: `Failed to write file with critique: ${path} - ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    
    // Fallback to standard file writing
    try {
      await writeAgentFile(path, content, language, agentId);
      return null;
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
}

// Batch write files with critique
export async function writeAgentFilesWithCritique(
  files: Array<{ path: string; content: string; language?: string }>, 
  agentId: string = 'system',
  enableSelfCritique: boolean = true
): Promise<Array<{ path: string; critiqueResult: CritiqueResult | null; success: boolean }>> {
  const results = [];
  const { addMemory } = useAgentMemoryStore.getState();
  
  addMemory(agentId, {
    type: 'task_assignment',
    message: `Starting batch file generation with ${enableSelfCritique ? 'self-critique' : 'standard writing'}: ${files.length} files`,
    metadata: { 
      fileCount: files.length, 
      fileList: files.map(f => f.path),
      selfCritiqueEnabled: enableSelfCritique
    }
  });
  
  for (const file of files) {
    try {
      const critiqueResult = await writeAgentFileWithCritique(
        file.path, 
        file.content, 
        file.language, 
        agentId,
        enableSelfCritique
      );
      
      results.push({ 
        path: file.path, 
        critiqueResult,
        success: true 
      });
    } catch (error) {
      results.push({ 
        path: file.path, 
        critiqueResult: null,
        success: false 
      });
    }
  }

  // Log batch results with critique summary
  const { addLog } = useLogStore.getState();
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  if (enableSelfCritique) {
    const approved = results.filter(r => r.critiqueResult?.status === 'approved').length;
    const improved = results.filter(r => r.critiqueResult?.status === 'needs_improvement').length;
    const rejected = results.filter(r => r.critiqueResult?.status === 'rejected').length;
    
    addLog({
      level: successful > 0 && failed === 0 ? 'success' : 'warn',
      source: 'File Writer',
      message: `Batch complete: ${successful} written, ${failed} failed | Critique: ${approved} approved, ${improved} improved, ${rejected} rejected`
    });
  }
  
  return results;
}