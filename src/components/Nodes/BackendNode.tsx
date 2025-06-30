import React, { useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { AgentNodeData } from '../../types/nodes';
import { 
  TaskExecution, 
  AgentTask, 
  GeneratedFile, 
  TaskStage,
  BACKEND_TASK_STAGES,
  generateBackendFiles,
  getFileTypeIcon,
  getStatusColor,
  formatDuration
} from '../../types/agent';
import { useNodesStore } from '../../stores/nodesStore';
import { getFileContent, generateAIContent } from '../../utils/fileContentGenerators';

interface BackendNodeData extends AgentNodeData {
  endpoints?: string[];
  database?: string;
  runtime?: string;
  serverStatus?: 'running' | 'stopped' | 'starting';
  port?: number;
  task?: AgentTask;
}

export const BackendNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const backendData = data as BackendNodeData;
  const [taskExecution, setTaskExecution] = useState<TaskExecution | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [serverPort, setServerPort] = useState(3001);
  const [apiPreviewReady, setApiPreviewReady] = useState(false);
  const { sendFileUpdate } = useNodesStore();

  // Initialize task execution when node is created - FIXED to prevent infinite loops
  useEffect(() => {
    if (backendData.description && !taskExecution) {
      // Create a task from the description
      const task: AgentTask = {
        id: `task-${id}`,
        title: `Backend Development`,
        description: backendData.description,
        assignedBy: 'manager',
        type: 'backend',
        priority: 'medium',
        status: 'pending',
        progress: 0,
        stages: BACKEND_TASK_STAGES.map(stage => ({ ...stage, status: 'pending' as const })),
        files: [],
        metadata: {
          runtime: backendData.runtime || 'Node.js',
          database: backendData.database || 'PostgreSQL',
          endpoints: backendData.endpoints || [],
          port: backendData.port || serverPort
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
      const files = generateBackendFiles({
        endpoints: backendData.endpoints || ['GET /api/notes', 'POST /api/notes', 'PUT /api/notes/:id', 'DELETE /api/notes/:id'],
        runtime: backendData.runtime || 'Node.js'
      });
      setGeneratedFiles(files);

      console.log(`⚙️ Backend Agent ${id} initialized with task:`, task.description);
      
      // Auto-start task execution after a brief delay
      const timeoutId = setTimeout(async () => {
        await startTaskExecution(task, execution);
      }, 1200);

      // Cleanup timeout
      return () => clearTimeout(timeoutId);
    }
  }, [id, backendData.description]); // REMOVED taskExecution and serverPort from dependencies

  const startTaskExecution = async (task: AgentTask, execution: TaskExecution) => {
    console.log(`🚀 Backend Agent ${id} starting task execution`);
    
    // Start executing stages
    await executeNextStage(execution, 0);
  };

  const executeNextStage = async (execution: TaskExecution, stageIndex: number) => {
    if (stageIndex >= BACKEND_TASK_STAGES.length) {
      // Task completed
      setTaskExecution(prev => prev ? {
        ...prev,
        status: 'completed'
      } : null);
      
      // Try AI generation first for backend
      console.log(`🤖 Backend Agent ${id} attempting AI generation for task: ${backendData.description}`);
      
      try {
        // Attempt AI generation for backend
        const aiResult = await generateAIContent(
          'backend',
          backendData.description || 'Create an Express.js API',
          'Generated API',
          'Express.js with TypeScript'
        );

        if (aiResult && aiResult.files.length > 0) {
          console.log(`✨ AI generated ${aiResult.files.length} files for Backend agent`);
          
          // Send AI-generated files - ensure content is resolved
          for (const file of aiResult.files) {
            // Ensure file content is a string, not a Promise
            const content = typeof file.content === 'string' ? file.content : await Promise.resolve(file.content);
            console.log(`📁 Sending file: ${file.path} (${content.length} chars)`);
            sendFileUpdate(id, file.path, content);
          }
          
          // Update generated files list to show AI files
          setGeneratedFiles(prev => [
            ...prev.map(f => ({ ...f, status: 'completed' as const })),
            ...aiResult.files.map((file, index) => ({
              id: `ai-backend-${index}`,
              name: file.path,
              path: file.path,
              type: file.path.includes('route') ? 'component' as const : 'config' as const,
              size: `${Math.round(file.content.length / 1024)}kb`,
              status: 'completed' as const,
              language: file.path.endsWith('.ts') ? 'typescript' : 'javascript',
              lastModified: Date.now()
            }))
          ]);

          console.log(`✅ Backend Agent ${id} completed with AI generation - sent ${aiResult.files.length} AI files to sandbox`);
        } else {
          throw new Error('AI generation returned no files');
        }
      } catch (error) {
        console.log(`⚠️ Backend AI generation failed, falling back to templates:`, error);
        
        // Fallback to template generation
        const updatedFiles = [];
        for (const file of generatedFiles) {
          if (file.status !== 'completed') {
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated API',
              endpoints: backendData.endpoints || [],
              runtime: backendData.runtime || 'Node.js',
              database: backendData.database || 'PostgreSQL',
              taskDescription: backendData.description
            });
            
            sendFileUpdate(id, file.path, fileContent);
          }
          updatedFiles.push({ ...file, status: 'completed' as const });
        }
        setGeneratedFiles(updatedFiles);

        // Send package.json for backend with task context
        const packageContent = await getFileContent('package.json', {
          appName: 'Generated API',
          framework: 'Express',
          taskDescription: backendData.description
        });
        sendFileUpdate(id, 'package.json', packageContent);

        console.log(`✅ Backend Agent ${id} completed with template fallback - sent ${generatedFiles.length + 1} files to sandbox`);
      }

      // Server is ready
      setApiPreviewReady(true);
      return;
    }

    const currentStage = BACKEND_TASK_STAGES[stageIndex];
    setCurrentStageIndex(stageIndex);
    
    console.log(`🔄 Backend Agent ${id} executing stage: ${currentStage.name}`);
    
    // Update current stage
    setTaskExecution(prev => prev ? {
      ...prev,
      status: 'executing',
      currentStage: { ...currentStage, status: 'active' }
    } : null);

    // Complete some files during specific stages
    if (stageIndex === 1) { // Database stage
      setTimeout(async () => {
        const updatedFiles = [];
        for (const file of generatedFiles) {
          if (file.name.includes('models') || file.name.includes('schema')) {
            // Generate and send database files
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated API',
              runtime: backendData.runtime || 'Node.js',
              database: backendData.database || 'PostgreSQL'
            });
            
            sendFileUpdate(id, file.path, fileContent);
            updatedFiles.push({ ...file, status: 'completed' as const });
          } else {
            updatedFiles.push(file);
          }
        }
        setGeneratedFiles(updatedFiles);
      }, currentStage.duration / 2);
    } else if (stageIndex === 2) { // API stage
      setTimeout(async () => {
        const updatedFiles = [];
        for (const file of generatedFiles) {
          if (file.name.includes('route') || file.name.includes('server')) {
            // Generate route or server files
            const fileContent = await getFileContent(file.name, {
              appName: 'Generated API',
              endpoints: backendData.endpoints || [],
              runtime: backendData.runtime || 'Node.js'
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
    setTimeout(() => {
      // Mark current stage as completed
      setTaskExecution(prev => prev ? {
        ...prev,
        currentStage: { ...currentStage, status: 'completed' },
        completedStages: [...prev.completedStages, { ...currentStage, status: 'completed' }]
      } : null);

      // Update progress
      const progressPercentage = Math.round(((stageIndex + 1) / BACKEND_TASK_STAGES.length) * 100);
      
      // Execute next stage - REMOVED nested timeout to prevent accumulation
      executeNextStage(execution, stageIndex + 1);
      
    }, currentStage.duration);
  };

  return (
    <BaseNode
      id={id}
      type="backend"
      data={backendData}
      selected={selected}
    >
      {/* Backend Agent-specific content */}
      <div className="space-y-3">
        {/* Task Information */}
        {taskExecution && (
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <h4 className="text-xs font-medium text-orange-800 mb-2">Current Task</h4>
            <div className="text-xs text-orange-700 mb-2">{backendData.description}</div>
            
            {/* Current Stage */}
            {taskExecution.currentStage && (
              <div className="bg-orange-50 rounded p-2">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span className="font-medium text-orange-800 text-xs">
                    {taskExecution.currentStage.name}
                  </span>
                </div>
                <div className="text-xs text-orange-600">
                  {taskExecution.currentStage.description}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Stages */}
        {taskExecution && (
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="text-xs font-medium text-orange-800 mb-2">
              Progress ({currentStageIndex + 1}/{BACKEND_TASK_STAGES.length})
            </div>
            <div className="space-y-1">
              {BACKEND_TASK_STAGES.map((stage, index) => (
                <div key={stage.id} className="flex items-center space-x-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    index < currentStageIndex ? 'bg-orange-500' :
                    index === currentStageIndex ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-300'
                  }`}></div>
                  <span className={`${
                    index < currentStageIndex ? 'text-orange-700 line-through' :
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
          <div className="bg-white rounded-lg p-2 border border-orange-100">
            <div className="text-xs font-medium text-orange-800 mb-2">
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
                    <div className="w-1 h-1 bg-orange-500 rounded-full"></div>
                  )}
                </div>
              ))}
              {generatedFiles.length > 4 && (
                <div className="text-xs text-orange-600 pl-2">
                  +{generatedFiles.length - 4} more files...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Server Status */}
        <div className="bg-orange-50 rounded-lg p-2">
          <div className="text-xs font-medium text-orange-800 mb-2">Server Status</div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                apiPreviewReady ? 'bg-green-500 animate-pulse' :
                taskExecution?.status === 'executing' ? 'bg-yellow-500 animate-pulse' :
                'bg-gray-400'
              }`}></div>
              <span className="text-orange-700">
                {apiPreviewReady ? 'Running' : 
                 taskExecution?.status === 'executing' ? 'Starting' : 'Stopped'}
              </span>
            </div>
            <span className="text-orange-600 font-mono">:{serverPort}</span>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-lg p-2 border border-orange-100">
          <div className="text-xs font-medium text-orange-800 mb-2">Tech Stack</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="font-medium text-orange-700">
                {backendData.runtime || 'Node.js'}
              </div>
              <div className="text-gray-600">Runtime</div>
            </div>
            <div>
              <div className="font-medium text-orange-700">
                {backendData.database || 'PostgreSQL'}
              </div>
              <div className="text-gray-600">Database</div>
            </div>
          </div>
        </div>

        {/* API Endpoints */}
        {(backendData.endpoints || generatedFiles.filter(f => f.type === 'component').length > 0) && (
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="text-xs font-medium text-orange-800 mb-2">
              API Endpoints
            </div>
            <div className="space-y-1">
              {(backendData.endpoints || ['GET /api/notes', 'POST /api/notes', 'PUT /api/notes/:id']).slice(0, 3).map((endpoint, index) => (
                <div key={index} className="flex items-center space-x-2 text-xs">
                  <div className="px-1 bg-orange-100 text-orange-700 rounded text-xs font-mono">
                    {endpoint.split(' ')[0] || 'GET'}
                  </div>
                  <span className="text-orange-700 font-mono text-xs">
                    {endpoint.split(' ').slice(1).join(' ') || endpoint}
                  </span>
                  {apiPreviewReady && (
                    <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Preview */}
        <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-orange-100">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              apiPreviewReady ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`}></div>
            <span className="text-xs text-orange-800">
              API Preview {apiPreviewReady ? 'Ready' : 'Preparing'}
            </span>
          </div>
          
          {apiPreviewReady && (
            <button className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs rounded transition-colors">
              Test API
            </button>
          )}
        </div>

        {/* System Metrics - Only show when running */}
        {apiPreviewReady && (
          <div className="text-xs bg-orange-50 rounded-lg p-2">
            <div className="font-medium text-orange-800 mb-1">Performance</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-orange-600 font-bold">18ms</div>
                <div className="text-gray-600">Response</div>
              </div>
              <div>
                <div className="text-orange-600 font-bold">100%</div>
                <div className="text-gray-600">Uptime</div>
              </div>
              <div>
                <div className="text-orange-600 font-bold">32MB</div>
                <div className="text-gray-600">Memory</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};