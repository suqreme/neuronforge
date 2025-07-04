import React, { useRef, useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useToast } from '../ui/Toast';
import type { ProjectData } from '../../types/project';
import type { LLMProvider } from '../../utils/claudeApi';
import { getCurrentProvider, setCurrentProvider, getAvailableProviders } from '../../utils/providerManager';
import { generateFallbackApp } from '../../utils/fallbackGenerator';
import { runSummarizerAgent } from '../../agents/SummarizerAgent';
import { runCriticAgent } from '../../agents/CriticAgent';
import { runClaudeReflection } from '../../agents/ClaudeReflectionAgent';
import { exportProjectAsZip, ExportPresets } from '../../utils/exportProjectAsZip';
import { usePreview } from '../../stores/previewStore';

export function ControlBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { saveProject, loadProject, exportProject } = useProjectStore();
  const { addToast } = useToast();
  const [selectedProvider, setSelectedProviderState] = useState<LLMProvider>(getCurrentProvider());
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const preview = usePreview();
  const availableProviders = getAvailableProviders();

  useEffect(() => {
    setSelectedProviderState(getCurrentProvider());
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };

    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportDropdownOpen]);

  const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string) as ProjectData;
        loadProject(json);
        addToast({
          message: `Project "${json.name}" loaded successfully!`,
          type: 'success'
        });
      } catch (error) {
        console.error('❌ Failed to load project:', error);
        addToast({
          message: 'Failed to load project file. Please check the file format.',
          type: 'error'
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input value so same file can be loaded again
    event.target.value = '';
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSaveClick = () => {
    saveProject();
    addToast({
      message: 'Project saved successfully!',
      type: 'success'
    });
  };

  const handleExportClick = async () => {
    try {
      addToast({
        message: '📦 Preparing project export...',
        type: 'info'
      });

      const success = await exportProjectAsZip();
      
      if (success) {
        addToast({
          message: '📦 Project exported as ZIP file!',
          type: 'success'
        });
      } else {
        addToast({
          message: 'Export failed. Check logs for details.',
          type: 'error'
        });
      }
    } catch (error) {
      addToast({
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  };

  const handleAdvancedExport = async (preset: keyof typeof ExportPresets) => {
    try {
      setExportDropdownOpen(false);
      
      addToast({
        message: `📦 Preparing ${preset} export...`,
        type: 'info'
      });

      const success = await ExportPresets[preset]();
      
      if (success) {
        addToast({
          message: `📦 ${preset.charAt(0).toUpperCase() + preset.slice(1)} export completed!`,
          type: 'success'
        });
      } else {
        addToast({
          message: 'Export failed. Check logs for details.',
          type: 'error'
        });
      }
    } catch (error) {
      addToast({
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  };

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as LLMProvider;
    setSelectedProviderState(newProvider);
    setCurrentProvider(newProvider);
    
    const providerInfo = availableProviders.find(p => p.provider === newProvider);
    
    addToast({
      message: `LLM provider switched to ${providerInfo?.name || newProvider.toUpperCase()}`,
      type: 'success'
    });
  };

  const handleQuickPreview = async () => {
    try {
      await generateFallbackApp({
        appName: 'Quick Preview App',
        includeTailwind: true,
        includeTypeScript: true
      });
      
      addToast({
        message: '🚀 Quick preview app generated!',
        type: 'success'
      });
    } catch (error) {
      addToast({
        message: 'Failed to generate preview app',
        type: 'error'
      });
    }
  };

  const handleSummarizerClick = async () => {
    try {
      addToast({
        message: '🧠 Analyzing project progress...',
        type: 'info'
      });

      const analysis = await runSummarizerAgent();
      
      addToast({
        message: `📊 Summary complete! Quality: ${analysis.summary.codeQuality.score}/10`,
        type: 'success'
      });
    } catch (error) {
      addToast({
        message: 'Failed to generate project summary',
        type: 'error'
      });
    }
  };

  const handleCriticClick = async () => {
    try {
      addToast({
        message: '🧠 Running build criticism analysis...',
        type: 'info'
      });

      const criticism = await runCriticAgent();
      
      addToast({
        message: `🎯 Criticism complete! Quality: ${criticism.codeQuality.score}/10, ${criticism.urgentIssues.length} urgent issues`,
        type: criticism.urgentIssues.length > 0 ? 'warning' : 'success'
      });
    } catch (error) {
      addToast({
        message: 'Failed to generate build criticism',
        type: 'error'
      });
    }
  };

  const handleReflectionClick = async () => {
    try {
      addToast({
        message: '🧹 Starting file reflection and cleanup analysis...',
        type: 'info'
      });

      const reflection = await runClaudeReflection();
      
      addToast({
        message: `🧹 Reflection complete! Quality: ${reflection.overallAssessment.codeQuality}/10, ${reflection.redundantFiles.length} redundant files, ${reflection.unusedFiles.length} unused files`,
        type: 'success'
      });
    } catch (error) {
      addToast({
        message: 'Failed to generate reflection analysis',
        type: 'error'
      });
    }
  };

  const handlePreviewClick = async () => {
    if (!preview.getPreviewUrl()) {
      // Try to auto-detect if no URL is set
      addToast({
        message: '🔍 Auto-detecting development server...',
        type: 'info'
      });

      const detectedUrl = await preview.autoDetectLocal();
      
      if (detectedUrl) {
        addToast({
          message: `🌐 Connected to ${detectedUrl}`,
          type: 'success'
        });
      } else {
        addToast({
          message: 'No development server found. Start your dev server and try again.',
          type: 'warning'
        });
      }
    } else {
      // Show preview (will be handled by WorkbenchLayout tab switching)
      addToast({
        message: `🌐 Preview available at: ${preview.getPreviewUrl()}`,
        type: 'info'
      });
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-900 border-b border-gray-700">
      <div className="flex items-center gap-2">
        {/* Save Project */}
        <button
          onClick={handleSaveClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          title="Save project as JSON file"
        >
          <span className="text-base">💾</span>
          Save
        </button>

        {/* Load Project */}
        <button
          onClick={handleLoadClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors"
          title="Load project from JSON file"
        >
          <span className="text-base">📂</span>
          Load
        </button>

        {/* Export Project */}
        <div className="relative flex" ref={exportDropdownRef}>
          <button
            onClick={handleExportClick}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-l-md transition-colors"
            title="Export full project as downloadable ZIP file"
          >
            <span className="text-base">📦</span>
            Export ZIP
          </button>
          
          <button
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-r-md border-l border-purple-500 transition-colors"
            title="Export options"
          >
            ▼
          </button>

          {/* Export Dropdown */}
          {exportDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-600 rounded shadow-lg z-50">
              <div className="p-2 border-b border-gray-600">
                <div className="text-xs text-gray-400">Export Presets</div>
              </div>
              
              <button
                onClick={() => handleAdvancedExport('production')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
              >
                🚀 Production Build
              </button>
              
              <button
                onClick={() => handleAdvancedExport('development')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
              >
                🔧 Development
              </button>
              
              <button
                onClick={() => handleAdvancedExport('minimal')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
              >
                📄 Source Only
              </button>
              
              <button
                onClick={() => handleAdvancedExport('timestamped')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors border-t border-gray-600"
              >
                🕐 Timestamped
              </button>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <button
          onClick={handlePreviewClick}
          className={`flex items-center gap-2 px-3 py-1.5 text-white text-sm rounded-md transition-colors ${
            preview.getPreviewUrl() && preview.config.connectionStatus === 'connected'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
          title={preview.getPreviewUrl() ? `Connected to ${preview.getPreviewUrl()}` : "Connect to development server"}
        >
          <span className="text-base">🌐</span>
          {preview.getPreviewUrl() ? 'Preview' : 'Connect'}
        </button>

        {/* Quick Preview (Fallback App) */}
        <button
          onClick={handleQuickPreview}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md transition-colors"
          title="Generate quick preview app"
        >
          <span className="text-base">🪟</span>
          Quick App
        </button>

        {/* Summarizer Agent */}
        <button
          onClick={handleSummarizerClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition-colors"
          title="Analyze project progress and generate summary"
        >
          <span className="text-base">🧠</span>
          Summarize
        </button>

        {/* Critic Agent */}
        <button
          onClick={handleCriticClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
          title="Run intelligent build criticism and feedback"
        >
          <span className="text-base">🎯</span>
          Critic
        </button>

        {/* Reflection Agent */}
        <button
          onClick={handleReflectionClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-md transition-colors"
          title="Analyze files for cleanup and refactor opportunities"
        >
          <span className="text-base">🧹</span>
          Reflect
        </button>

        {/* Hidden file input */}
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileLoad}
        />
      </div>
      
      <div className="flex-1" />

      {/* LLM Provider Selection */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">LLM:</span>
        <select
          value={selectedProvider}
          onChange={handleProviderChange}
          className="bg-gray-800 text-white text-sm border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          {availableProviders.map(({ provider, available, name }) => (
            <option key={provider} value={provider} disabled={!available}>
              {name} {!available && '(No API Key)'}
            </option>
          ))}
        </select>
        
        {/* Status Indicator */}
        <div className={`w-2 h-2 rounded-full ${
          availableProviders.find(p => p.provider === selectedProvider)?.available ? 'bg-green-500' : 'bg-red-500'
        }`} title={
          availableProviders.find(p => p.provider === selectedProvider)?.available ? 'API Key Configured' : 'API Key Missing'
        } />
      </div>
      
      <div className="text-sm text-gray-400">
        NeuronForge v1.0
      </div>
    </div>
  );
}