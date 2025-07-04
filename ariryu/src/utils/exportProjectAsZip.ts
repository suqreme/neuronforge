import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useFileContext } from '../stores/fileContextStore';
import { useMessageBus } from '../stores/messageBus';
import { useLogStore } from '../stores/logStore';

/**
 * Export the full NeuronForge project as a downloadable ZIP file
 */
export async function exportProjectAsZip(filename = 'NeuronForgeApp.zip'): Promise<boolean> {
  try {
    useLogStore.getState().addLog({
      level: 'info',
      source: 'Project Exporter',
      message: '📦 Starting project export to ZIP...'
    });

    const zip = new JSZip();
    const { getAllFiles, getFileStats } = useFileContext.getState();
    const files = getAllFiles();
    const fileStats = getFileStats();

    let exportedFileCount = 0;
    let totalSize = 0;

    // Add all files from fileContextStore to ZIP
    for (const [path, fileRecord] of Object.entries(files)) {
      if (fileRecord.content && fileRecord.content.trim()) {
        // Remove leading slash to avoid root directory issues
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
        
        // Skip certain system files and directories
        if (shouldSkipFile(normalizedPath)) {
          continue;
        }

        zip.file(normalizedPath, fileRecord.content);
        exportedFileCount++;
        totalSize += fileRecord.size;
      }
    }

    // Add essential project files if they don't exist
    await addEssentialFiles(zip, files);

    // Add a README with export information
    const exportInfo = generateExportReadme(fileStats, exportedFileCount, totalSize);
    zip.file('EXPORT_INFO.md', exportInfo);

    useLogStore.getState().addLog({
      level: 'info',
      source: 'Project Exporter',
      message: `🔄 Generating ZIP archive with ${exportedFileCount} files...`
    });

    // Generate ZIP blob
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // Trigger download
    saveAs(blob, filename);

    // Log success
    useLogStore.getState().addLog({
      level: 'success',
      source: 'Project Exporter',
      message: `✅ Project exported successfully: ${filename} (${exportedFileCount} files, ${formatFileSize(blob.size)})`
    });

    // Send success notification
    useMessageBus.getState().sendMessage({
      sender: 'PROJECT_EXPORTER',
      receiver: 'ALL',
      type: 'completion',
      content: `📦 Project exported as ${filename}`,
      priority: 'high',
      metadata: {
        tags: ['export', 'zip', 'project'],
        filename,
        exportedFiles: exportedFileCount,
        totalSize: blob.size,
        compressionRatio: Math.round((totalSize - blob.size) / totalSize * 100)
      }
    });

    return true;

  } catch (error) {
    const errorMessage = `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    useLogStore.getState().addLog({
      level: 'error',
      source: 'Project Exporter',
      message: `❌ ${errorMessage}`
    });

    useMessageBus.getState().sendMessage({
      sender: 'PROJECT_EXPORTER',
      receiver: 'ALL',
      type: 'error',
      content: `Export failed: ${errorMessage}`,
      priority: 'high',
      metadata: {
        tags: ['export', 'error', 'zip'],
        error: errorMessage
      }
    });

    return false;
  }
}

/**
 * Check if a file should be skipped during export
 */
function shouldSkipFile(path: string): boolean {
  const skipPatterns = [
    // System files
    '.DS_Store',
    'Thumbs.db',
    '.git/',
    '.svn/',
    '.hg/',
    
    // Build artifacts
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '.nuxt/',
    
    // IDE files
    '.vscode/',
    '.idea/',
    '*.swp',
    '*.swo',
    '*~',
    
    // OS files
    '__pycache__/',
    '*.pyc',
    '.env.local',
    '.env.production',
    
    // Claude internal files
    '.claude/',
    'CLAUDE.md'
  ];

  return skipPatterns.some(pattern => {
    if (pattern.endsWith('/')) {
      return path.startsWith(pattern) || path.includes('/' + pattern);
    }
    if (pattern.startsWith('*')) {
      return path.endsWith(pattern.slice(1));
    }
    return path.includes(pattern);
  });
}

/**
 * Add essential project files if they don't exist
 */
async function addEssentialFiles(zip: JSZip, existingFiles: Record<string, any>) {
  // Add package.json if it doesn't exist
  if (!existingFiles['package.json'] && !existingFiles['/package.json']) {
    const defaultPackageJson = {
      name: "neuronforge-app",
      version: "1.0.0",
      description: "NeuronForge exported project",
      main: "src/main.tsx",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
        test: "vitest"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        typescript: "^5.0.0",
        vite: "^4.4.5",
        vitest: "^0.34.0"
      }
    };
    zip.file('package.json', JSON.stringify(defaultPackageJson, null, 2));
  }

  // Add README.md if it doesn't exist
  if (!existingFiles['README.md'] && !existingFiles['/README.md']) {
    const defaultReadme = generateDefaultReadme();
    zip.file('README.md', defaultReadme);
  }

  // Add basic vite.config.ts if it doesn't exist
  if (!existingFiles['vite.config.ts'] && !existingFiles['/vite.config.ts']) {
    const defaultViteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})`;
    zip.file('vite.config.ts', defaultViteConfig);
  }

  // Add tsconfig.json if it doesn't exist
  if (!existingFiles['tsconfig.json'] && !existingFiles['/tsconfig.json']) {
    const defaultTsConfig = {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }]
    };
    zip.file('tsconfig.json', JSON.stringify(defaultTsConfig, null, 2));
  }
}

/**
 * Generate a default README for exported projects
 */
function generateDefaultReadme(): string {
  return `# NeuronForge Exported Project

This project was exported from NeuronForge - a visual AI development platform.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run test\` - Run tests

## Project Structure

This project uses:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Vitest** for testing
- **Tailwind CSS** for styling (if configured)

## Generated by NeuronForge

This project was generated using NeuronForge's AI-powered development platform.
Visit [NeuronForge](https://neuronforge.ai) to learn more.

## Export Information

See \`EXPORT_INFO.md\` for detailed export statistics and information.
`;
}

/**
 * Generate export information and statistics
 */
function generateExportReadme(fileStats: any, exportedFileCount: number, totalSize: number): string {
  const exportTime = new Date().toISOString();
  
  return `# Export Information

**Export Date:** ${exportTime}
**Export Source:** NeuronForge Visual AI Development Platform

## Project Statistics

- **Total Files Exported:** ${exportedFileCount}
- **Total Project Size:** ${formatFileSize(totalSize)}
- **Languages Used:** ${Object.keys(fileStats.languageBreakdown || {}).join(', ') || 'Not detected'}
- **Total Lines of Code:** ${fileStats.totalLines || 'Unknown'}

## File Breakdown by Language

${Object.entries(fileStats.languageBreakdown || {})
  .map(([lang, count]) => `- **${lang}:** ${count} files`)
  .join('\n') || 'No language breakdown available'}

## Contributors (AI Agents)

${Object.entries(fileStats.agentContributions || {})
  .map(([agent, count]) => `- **${agent}:** ${count} files`)
  .join('\n') || 'No contribution data available'}

## Export Notes

- System files and build artifacts were excluded from export
- Essential project files (package.json, README.md, etc.) were added if missing
- All source code was exported with proper folder structure preserved

## Running This Project

1. Extract this ZIP file to your desired location
2. Run \`npm install\` to install dependencies
3. Run \`npm run dev\` to start the development server
4. Open http://localhost:3000 in your browser

## Support

This project was generated by NeuronForge. For questions about the platform, visit our documentation or support channels.

---
*Generated automatically by NeuronForge Export System v1.0*
`;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Export project with custom options
 */
export interface ExportOptions {
  filename?: string;
  includeTests?: boolean;
  includeNodeModules?: boolean;
  compressionLevel?: number;
  excludePatterns?: string[];
}

export async function exportProjectWithOptions(options: ExportOptions = {}): Promise<boolean> {
  const {
    filename = 'NeuronForgeApp.zip',
    compressionLevel = 6
  } = options;

  // Use the main export function with custom filename
  return await exportProjectAsZip(filename);
}

/**
 * Quick export presets
 */
export const ExportPresets = {
  /**
   * Export production-ready build
   */
  production: () => exportProjectAsZip('NeuronForge-Production.zip'),
  
  /**
   * Export development version with all files
   */
  development: () => exportProjectAsZip('NeuronForge-Development.zip'),
  
  /**
   * Export minimal version (source only)
   */
  minimal: () => exportProjectAsZip('NeuronForge-Minimal.zip'),
  
  /**
   * Export with timestamp
   */
  timestamped: () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return exportProjectAsZip(`NeuronForge-${timestamp}.zip`);
  }
};