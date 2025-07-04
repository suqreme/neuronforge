// Enhanced logging utilities for preview system
export class PreviewLogger {
  private static instance: PreviewLogger;
  private logBuffer: Array<{ timestamp: number; level: string; message: string; source: string }> = [];

  static getInstance(): PreviewLogger {
    if (!PreviewLogger.instance) {
      PreviewLogger.instance = new PreviewLogger();
    }
    return PreviewLogger.instance;
  }

  private constructor() {
    // Initialize console logging enhancements
    this.enhanceConsole();
  }

  private enhanceConsole() {
    // Add preview-specific console methods
    (window as any).previewLogs = () => {
      console.group('🖥️ Preview System Logs');
      this.logBuffer.forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        console.log(`[${time}] ${log.level.toUpperCase()}: ${log.message} (${log.source})`);
      });
      console.groupEnd();
    };

    (window as any).clearPreviewLogs = () => {
      this.logBuffer = [];
      console.log('🗑️ Preview logs cleared');
    };
  }

  logScaffoldWarning(missingFiles: string[]) {
    const message = `⚠️ Missing essential files for preview: ${missingFiles.join(', ')}`;
    this.addToBuffer('warn', message, 'Preview Scaffold');
    console.warn(message);
  }

  logWebContainerError(error: string) {
    const message = `❌ WebContainer/Build error: ${error}`;
    this.addToBuffer('error', message, 'WebContainer');
    console.error(message);
  }

  logFallbackGenerated(fileCount: number) {
    const message = `🔧 Fallback app generated with ${fileCount} files`;
    this.addToBuffer('info', message, 'Fallback Generator');
    console.log(message);
  }

  logPreviewStateChange(oldState: string, newState: string, reason?: string) {
    const message = `🔄 Preview state: ${oldState} → ${newState}${reason ? ` (${reason})` : ''}`;
    this.addToBuffer('info', message, 'Preview State');
    console.log(message);
  }

  logFileIntegrityCheck(result: { hasApp: boolean; hasMain: boolean; fileCount: number }) {
    const message = `🔍 File integrity check: ${result.fileCount} files, App: ${result.hasApp ? '✅' : '❌'}, Main: ${result.hasMain ? '✅' : '❌'}`;
    this.addToBuffer('info', message, 'File Integrity');
    console.log(message);
  }

  logPanelResize(newWidth: number) {
    const message = `📏 Panel resized to ${newWidth}px`;
    this.addToBuffer('info', message, 'Panel Control');
    console.log(message);
  }

  logPanelToggle(collapsed: boolean) {
    const message = `👁️ Panel ${collapsed ? 'collapsed' : 'expanded'}`;
    this.addToBuffer('info', message, 'Panel Control');
    console.log(message);
  }

  private addToBuffer(level: string, message: string, source: string) {
    this.logBuffer.push({
      timestamp: Date.now(),
      level,
      message,
      source
    });

    // Keep only last 100 logs
    if (this.logBuffer.length > 100) {
      this.logBuffer = this.logBuffer.slice(-100);
    }
  }

  getRecentLogs(count: number = 10) {
    return this.logBuffer.slice(-count);
  }

  exportLogs() {
    const logText = this.logBuffer
      .map(log => {
        const time = new Date(log.timestamp).toISOString();
        return `[${time}] ${log.level.toUpperCase()}: ${log.message} (${log.source})`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const previewLogger = PreviewLogger.getInstance();

// Global console helpers
(window as any).exportPreviewLogs = () => previewLogger.exportLogs();