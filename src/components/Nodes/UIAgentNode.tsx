import React, { useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { AgentNodeData } from '../../types/nodes';
import { 
  TaskExecution, 
  AgentTask, 
  GeneratedFile, 
  TaskStage,
  UI_TASK_STAGES,
  generateUIFiles,
  getFileTypeIcon,
  getStatusColor,
  formatDuration
} from '../../types/agent';
import { useNodesStore } from '../../stores/nodesStore';
import { getFileContent, generateAIContent } from '../../utils/fileContentGenerators';

interface UIAgentNodeData extends AgentNodeData {
  components?: string[];
  framework?: string;
  livePreview?: boolean;
  styleSystem?: string;
  task?: AgentTask;
}

export const UIAgentNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const uiData = data as UIAgentNodeData;
  const [taskExecution, setTaskExecution] = useState<TaskExecution | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const { sendFileUpdate } = useNodesStore();

  // Initialize task execution when node is created - FIXED to prevent infinite loops
  useEffect(() => {
    if (uiData.description && !taskExecution) {
      // Create a task from the description
      const task: AgentTask = {
        id: `task-${id}`,
        title: `UI Development`,
        description: uiData.description,
        assignedBy: 'manager',
        type: 'ui',
        priority: 'medium',
        status: 'pending',
        progress: 0,
        stages: UI_TASK_STAGES.map(stage => ({ ...stage, status: 'pending' as const })),
        files: [],
        metadata: {
          framework: uiData.framework || 'React',
          styleSystem: uiData.styleSystem || 'Tailwind CSS',
          components: uiData.components || []
        },
        startedAt: Date.now()
      };

      const execution: TaskExecution = {
        taskId: task.id,
        agentId: id,
        status: 'initializing',
        currentStage: null,
        remainingStages: [...task.stages],
        completedStages: [],
        logs: []
      };

      setTaskExecution(execution);
      
      // Generate files based on task data
      const files = generateUIFiles({
        components: uiData.components || ['App', 'Layout'],
        framework: uiData.framework || 'React'
      });
      setGeneratedFiles(files);

      console.log(`🎨 UI Agent ${id} initialized with task:`, task.description);
      
      // Auto-start task execution after a brief delay  
      const timeoutId = setTimeout(async () => {
        console.log(`🚀 UI Agent ${id} starting task execution after delay`);
        await startTaskExecution(task, execution);
      }, 2000); // Increased delay to ensure sandbox is ready

      // Cleanup timeout
      return () => clearTimeout(timeoutId);
    }
  }, [id, uiData.description]); // REMOVED taskExecution from dependencies to prevent infinite loop

  const startTaskExecution = async (task: AgentTask, execution: TaskExecution) => {
    console.log(`🚀 UI Agent ${id} starting task execution`);
    
    // Start executing stages
    await executeNextStage(execution, 0);
  };

  const executeNextStage = async (execution: TaskExecution, stageIndex: number) => {
    if (stageIndex >= UI_TASK_STAGES.length) {
      // Task completed
      setTaskExecution(prev => prev ? {
        ...prev,
        status: 'completed'
      } : null);
      
      // Try AI generation first, then mark files as completed
      console.log(`🤖 UI Agent ${id} attempting AI generation for task: ${uiData.description}`);
      
      try {
        // Attempt AI generation
        const aiResult = await generateAIContent(
          'ui',
          uiData.description || 'Create a React application',
          'Generated App',
          uiData.framework || 'React'
        );

        if (aiResult && aiResult.files.length > 0) {
          console.log(`✨ AI generated ${aiResult.files.length} files for UI agent`);
          
          // Send AI-generated files - ensure content is resolved
          for (const file of aiResult.files) {
            // Ensure file content is a string, not a Promise
            const content = typeof file.content === 'string' ? file.content : await Promise.resolve(file.content);
            console.log(`📤 UI Agent ${id} sending file: ${file.path} (${content.length} chars)`);
            console.log(`📤 File content preview:`, content.slice(0, 100) + '...');
            sendFileUpdate(id, file.path, content);
          }
          
          // Update generated files list to show AI files
          setGeneratedFiles(prev => [
            ...prev.map(f => ({ ...f, status: 'completed' as const })),
            ...aiResult.files.map((file, index) => ({
              id: `ai-${index}`,
              name: file.path,
              path: `src/${file.path}`,
              type: file.path.includes('.tsx') ? 'component' as const : 'config' as const,
              size: `${Math.round(file.content.length / 1024)}kb`,
              status: 'completed' as const,
              language: file.path.endsWith('.tsx') ? 'typescript' : file.path.endsWith('.ts') ? 'typescript' : 'javascript',
              lastModified: Date.now()
            }))
          ]);

          console.log(`✅ UI Agent ${id} completed with AI generation - sent ${aiResult.files.length} AI files to sandbox`);
        } else {
          throw new Error('AI generation returned no files');
        }
      } catch (error) {
        console.log(`⚠️ AI generation failed, falling back to templates:`, error);
        
        // Fallback to template generation - ensure we always generate basic files
        const fallbackFiles = [
          { name: 'App.tsx', path: 'src/App.tsx' },
          { name: 'main.tsx', path: 'src/main.tsx' },
          { name: 'index.css', path: 'src/index.css' },
          { name: 'App.css', path: 'src/App.css' }
        ];

        // Add component files based on UI data
        if (uiData.components && uiData.components.length > 0) {
          uiData.components.forEach(componentName => {
            fallbackFiles.push({
              name: `${componentName}.tsx`,
              path: `src/components/${componentName}.tsx`
            });
          });
        }

        // Generate and send template files
        for (const file of fallbackFiles) {
          try {
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated App',
              components: uiData.components || [],
              framework: uiData.framework || 'React',
              taskDescription: uiData.description,
              description: `Generated ${file.name}`
            });
            
            console.log(`📤 UI Agent ${id} sending template file: ${file.path} (${fileContent.length} chars)`);
            console.log(`📤 Template content preview:`, fileContent.slice(0, 100) + '...');
            sendFileUpdate(id, file.path, fileContent);
          } catch (fileError) {
            console.error(`Failed to generate ${file.name}:`, fileError);
            // Send a basic fallback content
            const basicContent = `// Generated ${file.name}
export default function Component() {
  return <div>Generated content for ${file.name}</div>;
}`;
            sendFileUpdate(id, file.path, basicContent);
          }
        }

        // Update generated files list
        const templateFiles = fallbackFiles.map((file, index) => ({
          id: `template-${index}`,
          name: file.name,
          path: file.path,
          type: file.name.includes('.tsx') ? 'component' as const : 'config' as const,
          size: '1kb',
          status: 'completed' as const,
          language: file.name.endsWith('.tsx') ? 'typescript' : file.name.endsWith('.css') ? 'css' : 'javascript',
          lastModified: Date.now()
        }));

        setGeneratedFiles(prev => [
          ...prev.map(f => ({ ...f, status: 'completed' as const })),
          ...templateFiles
        ]);

        console.log(`✅ UI Agent ${id} completed with template fallback - sent ${fallbackFiles.length} files to sandbox`);
      }
      return;
    }

    const currentStage = UI_TASK_STAGES[stageIndex];
    setCurrentStageIndex(stageIndex);
    
    console.log(`🔄 UI Agent ${id} executing stage: ${currentStage.name}`);
    
    // Update current stage
    setTaskExecution(prev => prev ? {
      ...prev,
      status: 'executing',
      currentStage: { ...currentStage, status: 'active' }
    } : null);

    // Complete some files during this stage
    if (stageIndex === 1) { // Scaffolding stage
      setTimeout(async () => {
        const updatedFiles = [];
        for (let i = 0; i < generatedFiles.length; i++) {
          const file = generatedFiles[i];
          if (i < 2) {
            // Generate and send file content when completed
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated App',
              components: uiData.components || [],
              framework: uiData.framework || 'React',
              taskDescription: uiData.description,
              description: `Generated ${file.name} component`
            });
            
            // Send file to sandbox
            sendFileUpdate(id, file.path, fileContent);
            updatedFiles.push({ ...file, status: 'completed' as const });
          } else {
            updatedFiles.push(file);
          }
        }
        setGeneratedFiles(updatedFiles);
      }, currentStage.duration / 2);
    } else if (stageIndex === 2) { // Styling stage
      setTimeout(async () => {
        const updatedFiles = [];
        for (const file of generatedFiles) {
          if (file.type === 'style' && file.status !== 'completed') {
            // Generate CSS content
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated App',
              framework: uiData.framework || 'React',
              taskDescription: uiData.description
            });
            
            sendFileUpdate(id, file.path, fileContent);
            updatedFiles.push({ ...file, status: 'completed' as const });
          } else {
            updatedFiles.push(file);
          }
        }
        setGeneratedFiles(updatedFiles);
      }, currentStage.duration / 2);
    } else if (stageIndex === 3) { // Integration stage
      setTimeout(async () => {
        const updatedFiles = [];
        for (const file of generatedFiles) {
          if (file.type === 'component' && file.status !== 'completed') {
            // Generate remaining component files
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated App',
              components: uiData.components || [],
              framework: uiData.framework || 'React',
              taskDescription: uiData.description,
              description: `Generated ${file.name} component`
            });
            
            sendFileUpdate(id, file.path, fileContent);
            updatedFiles.push({ ...file, status: 'completed' as const });
          } else {
            updatedFiles.push(file);
          }
        }
        setGeneratedFiles(updatedFiles);
      }, currentStage.duration / 2);
    } else if (stageIndex === 4) { // Preview stage
      setTimeout(async () => {
        // Complete any remaining files
        const updatedFiles = [];
        for (const file of generatedFiles) {
          if (file.status !== 'completed') {
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated App',
              components: uiData.components || [],
              framework: uiData.framework || 'React',
              taskDescription: uiData.description,
              description: `Generated ${file.name}`
            });
            
            sendFileUpdate(id, file.path, fileContent);
            updatedFiles.push({ ...file, status: 'completed' as const });
          } else {
            updatedFiles.push(file);
          }
        }
        setGeneratedFiles(updatedFiles);
      }, currentStage.duration / 2);
    }

    // Move to next stage after duration - FIXED to prevent memory leaks
    const stageTimeoutId = setTimeout(() => {
      console.log(`✅ UI Agent ${id} completed stage ${stageIndex + 1}/${UI_TASK_STAGES.length}: ${currentStage.name}`);
      
      // Mark current stage as completed
      setTaskExecution(prev => prev ? {
        ...prev,
        currentStage: { ...currentStage, status: 'completed' },
        completedStages: [...prev.completedStages, { ...currentStage, status: 'completed' }]
      } : null);

      // Update progress
      const progressPercentage = Math.round(((stageIndex + 1) / UI_TASK_STAGES.length) * 100);
      
      // Execute next stage - REMOVED nested timeout to prevent accumulation
      executeNextStage(execution, stageIndex + 1);
      
    }, currentStage.duration);

    // Store timeout ID for potential cleanup (could be extended to track all timeouts)
    return stageTimeoutId;
  };

  return (
    <BaseNode
      id={id}
      type="ui"
      data={uiData}
      selected={selected}
    >
      {/* UI Agent-specific content */}
      <div className="space-y-3">
        {/* Task Information */}
        {taskExecution && (
          <div className="bg-white rounded-lg p-3 border border-green-100">
            <h4 className="text-xs font-medium text-green-800 mb-2">Current Task</h4>
            <div className="text-xs text-green-700 mb-2">{uiData.description}</div>
            
            {/* Current Stage */}
            {taskExecution.currentStage && (
              <div className="bg-green-50 rounded p-2">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium text-green-800 text-xs">
                    {taskExecution.currentStage.name}
                  </span>
                </div>
                <div className="text-xs text-green-600">
                  {taskExecution.currentStage.description}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Stages */}
        {taskExecution && (
          <div className="bg-green-50 rounded-lg p-2">
            <div className="text-xs font-medium text-green-800 mb-2">
              Progress ({currentStageIndex + 1}/{UI_TASK_STAGES.length})
            </div>
            <div className="space-y-1">
              {UI_TASK_STAGES.map((stage, index) => (
                <div key={stage.id} className="flex items-center space-x-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    index < currentStageIndex ? 'bg-green-500' :
                    index === currentStageIndex ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-300'
                  }`}></div>
                  <span className={`${
                    index < currentStageIndex ? 'text-green-700 line-through' :
                    index === currentStageIndex ? 'text-blue-700 font-medium' :
                    'text-gray-500'
                  }`}>
                    {stage.name}
                  </span>
                  {index === currentStageIndex && (
                    <span className="text-blue-600 text-xs">
                      ({formatDuration(stage.duration)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Files */}
        {generatedFiles.length > 0 && (
          <div className="bg-white rounded-lg p-2 border border-green-100">
            <div className="text-xs font-medium text-green-800 mb-2">
              Generated Files ({generatedFiles.filter(f => f.status === 'completed').length}/{generatedFiles.length})
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {generatedFiles.slice(0, 4).map((file, index) => (
                <div key={file.id} className="flex items-center space-x-2 text-xs">
                  <span className="text-sm">{getFileTypeIcon(file.type)}</span>
                  <span className={`flex-1 font-mono ${getStatusColor(file.status)}`}>
                    {file.name}
                  </span>
                  <span className="text-gray-500">{file.size}</span>
                  {file.status === 'generating' && (
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                  {file.status === 'completed' && (
                    <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                  )}
                </div>
              ))}
              {generatedFiles.length > 4 && (
                <div className="text-xs text-green-600 pl-2">
                  +{generatedFiles.length - 4} more files...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tech Stack */}
        <div className="bg-green-50 rounded-lg p-2">
          <div className="text-xs font-medium text-green-800 mb-2">Tech Stack</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="font-medium text-green-700">
                {uiData.framework || 'React'}
              </div>
              <div className="text-gray-600">Framework</div>
            </div>
            <div>
              <div className="font-medium text-green-700">
                {uiData.styleSystem || 'Tailwind'}
              </div>
              <div className="text-gray-600">Styling</div>
            </div>
          </div>
        </div>

        {/* Live Preview Status */}
        <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-green-100">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              taskExecution?.status === 'completed' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`}></div>
            <span className="text-xs text-green-800">
              Live Preview {taskExecution?.status === 'completed' ? 'Ready' : 'Preparing'}
            </span>
          </div>
          
          {taskExecution?.status === 'completed' && (
            <button className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 text-xs rounded transition-colors">
              View
            </button>
          )}
        </div>
      </div>
    </BaseNode>
  );
};