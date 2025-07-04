import { useMessageBus } from '../stores/messageBus';
import { useLogStore } from '../stores/logStore';

/**
 * Visual notification types for file updates
 */
export type FileUpdateNotificationType = 
  | 'created'     // New file created
  | 'modified'    // Existing file modified
  | 'deleted'     // File deleted
  | 'batch'       // Multiple files updated
  | 'generated';  // AI generated file(s)

/**
 * Configuration for file update notifications
 */
export interface FileUpdateNotificationConfig {
  showToast: boolean;
  flashDuration: number; // milliseconds
  highlightColor: string;
  soundEnabled: boolean;
  batchDelay: number; // delay between batch notifications
}

export const defaultNotificationConfig: FileUpdateNotificationConfig = {
  showToast: true,
  flashDuration: 2000,
  highlightColor: '#3b82f6', // blue-500
  soundEnabled: false,
  batchDelay: 100
};

/**
 * File update notification data
 */
export interface FileUpdateNotification {
  id: string;
  type: FileUpdateNotificationType;
  filePath: string;
  source: string; // Who made the change
  timestamp: number;
  size?: number;
  content?: string; // Preview of content
  metadata?: Record<string, any>;
}

/**
 * File update notification manager
 */
export class FileUpdateNotificationManager {
  private config: FileUpdateNotificationConfig;
  private activeFlashes: Map<string, NodeJS.Timeout> = new Map();
  private notificationQueue: FileUpdateNotification[] = [];
  private isProcessingQueue = false;

  constructor(config: Partial<FileUpdateNotificationConfig> = {}) {
    this.config = { ...defaultNotificationConfig, ...config };
  }

  /**
   * Notify about a single file update
   */
  notifyFileUpdate(
    filePath: string,
    type: FileUpdateNotificationType,
    source: string,
    options: {
      size?: number;
      content?: string;
      metadata?: Record<string, any>;
      immediate?: boolean;
    } = {}
  ): void {
    const notification: FileUpdateNotification = {
      id: crypto.randomUUID(),
      type,
      filePath,
      source,
      timestamp: Date.now(),
      size: options.size,
      content: options.content,
      metadata: options.metadata
    };

    if (options.immediate) {
      this.processNotification(notification);
    } else {
      this.notificationQueue.push(notification);
      this.processQueue();
    }
  }

  /**
   * Notify about multiple file updates (batch)
   */
  notifyBatchFileUpdate(
    files: Array<{
      path: string;
      type: FileUpdateNotificationType;
      size?: number;
      content?: string;
    }>,
    source: string,
    metadata?: Record<string, any>
  ): void {
    // Create individual notifications
    const notifications = files.map(file => ({
      id: crypto.randomUUID(),
      type: file.type,
      filePath: file.path,
      source,
      timestamp: Date.now(),
      size: file.size,
      content: file.content,
      metadata
    }));

    // Add to queue
    this.notificationQueue.push(...notifications);

    // Create a batch summary notification
    this.notifyFileUpdate(
      `${files.length} files`,
      'batch',
      source,
      {
        metadata: {
          ...metadata,
          fileCount: files.length,
          filePaths: files.map(f => f.path),
          totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
        },
        immediate: true
      }
    );

    this.processQueue();
  }

  /**
   * Process notification queue with delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      if (notification) {
        this.processNotification(notification);
        
        // Add delay between notifications to avoid overwhelming UI
        if (this.notificationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.batchDelay));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Process a single notification
   */
  private processNotification(notification: FileUpdateNotification): void {
    // Send to message bus
    this.sendMessageBusNotification(notification);

    // Add to logs
    this.addLogEntry(notification);

    // Visual flash effect (if supported)
    this.triggerFlashEffect(notification);

    // Sound notification (if enabled)
    if (this.config.soundEnabled) {
      this.playNotificationSound(notification.type);
    }
  }

  /**
   * Send notification to message bus
   */
  private sendMessageBusNotification(notification: FileUpdateNotification): void {
    const emoji = this.getTypeEmoji(notification.type);
    const actionText = this.getActionText(notification.type);
    
    useMessageBus.getState().sendMessage({
      sender: notification.source,
      receiver: 'ALL',
      type: 'file_update_notification',
      content: `${emoji} ${actionText}: ${notification.filePath}${notification.size ? ` (${this.formatFileSize(notification.size)})` : ''}`,
      priority: notification.type === 'batch' ? 'high' : 'medium',
      metadata: {
        tags: ['file-update', 'notification', notification.type],
        filePath: notification.filePath,
        updateType: notification.type,
        fileSize: notification.size,
        source: notification.source,
        notificationId: notification.id,
        ...notification.metadata
      }
    });
  }

  /**
   * Add log entry for file update
   */
  private addLogEntry(notification: FileUpdateNotification): void {
    const emoji = this.getTypeEmoji(notification.type);
    const actionText = this.getActionText(notification.type);
    const sizeText = notification.size ? ` (${this.formatFileSize(notification.size)})` : '';
    
    useLogStore.getState().addLog({
      level: 'info',
      source: notification.source,
      message: `${emoji} ${actionText}: ${notification.filePath}${sizeText}`
    });
  }

  /**
   * Trigger visual flash effect
   */
  private triggerFlashEffect(notification: FileUpdateNotification): void {
    // Clear any existing flash for this file
    const existingTimeout = this.activeFlashes.get(notification.filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Add flash class to file elements (if they exist in DOM)
    this.addFlashToFileElements(notification.filePath, notification.type);

    // Set timeout to remove flash
    const timeout = setTimeout(() => {
      this.removeFlashFromFileElements(notification.filePath);
      this.activeFlashes.delete(notification.filePath);
    }, this.config.flashDuration);

    this.activeFlashes.set(notification.filePath, timeout);
  }

  /**
   * Add flash effect to file elements in DOM
   */
  private addFlashToFileElements(filePath: string, type: FileUpdateNotificationType): void {
    try {
      // Find file elements by data attributes or class names
      const selectors = [
        `[data-file-path="${filePath}"]`,
        `[data-file="${filePath}"]`,
        `.file-item[title*="${filePath}"]`,
        `.tab[data-path="${filePath}"]`
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const htmlElement = element as HTMLElement;
          
          // Add flash class
          htmlElement.classList.add('file-update-flash', `flash-${type}`);
          
          // Add CSS custom properties for animation
          htmlElement.style.setProperty('--flash-color', this.getFlashColor(type));
          htmlElement.style.setProperty('--flash-duration', `${this.config.flashDuration}ms`);
        });
      }
    } catch (error) {
      // Silently fail if DOM manipulation fails
      console.debug('Failed to add flash effect:', error);
    }
  }

  /**
   * Remove flash effect from file elements
   */
  private removeFlashFromFileElements(filePath: string): void {
    try {
      const flashElements = document.querySelectorAll('.file-update-flash');
      flashElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        if (htmlElement.dataset.filePath === filePath || 
            htmlElement.dataset.file === filePath ||
            htmlElement.title?.includes(filePath)) {
          
          htmlElement.classList.remove('file-update-flash', 'flash-created', 'flash-modified', 'flash-deleted', 'flash-batch', 'flash-generated');
          htmlElement.style.removeProperty('--flash-color');
          htmlElement.style.removeProperty('--flash-duration');
        }
      });
    } catch (error) {
      console.debug('Failed to remove flash effect:', error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: FileUpdateNotificationType): void {
    try {
      // Create audio context if supported
      if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
        const audioContext = new (AudioContext || (window as any).webkitAudioContext)();
        
        // Create simple beep sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different frequencies for different types
        const frequency = this.getSoundFrequency(type);
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        // Short beep
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      }
    } catch (error) {
      console.debug('Failed to play notification sound:', error);
    }
  }

  /**
   * Get emoji for notification type
   */
  private getTypeEmoji(type: FileUpdateNotificationType): string {
    const emojiMap = {
      created: '📄',
      modified: '✏️',
      deleted: '🗑️',
      batch: '📁',
      generated: '🤖'
    };
    return emojiMap[type] || '📄';
  }

  /**
   * Get action text for notification type
   */
  private getActionText(type: FileUpdateNotificationType): string {
    const actionMap = {
      created: 'Created',
      modified: 'Modified',
      deleted: 'Deleted',
      batch: 'Updated',
      generated: 'Generated'
    };
    return actionMap[type] || 'Updated';
  }

  /**
   * Get flash color for notification type
   */
  private getFlashColor(type: FileUpdateNotificationType): string {
    const colorMap = {
      created: '#10b981', // green-500
      modified: '#3b82f6', // blue-500
      deleted: '#ef4444',  // red-500
      batch: '#8b5cf6',    // violet-500
      generated: '#f59e0b' // amber-500
    };
    return colorMap[type] || this.config.highlightColor;
  }

  /**
   * Get sound frequency for notification type
   */
  private getSoundFrequency(type: FileUpdateNotificationType): number {
    const frequencyMap = {
      created: 800,
      modified: 600,
      deleted: 400,
      batch: 1000,
      generated: 700
    };
    return frequencyMap[type] || 600;
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FileUpdateNotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear all active flashes
   */
  clearAllFlashes(): void {
    // Clear all timeouts
    for (const timeout of this.activeFlashes.values()) {
      clearTimeout(timeout);
    }
    this.activeFlashes.clear();

    // Remove all flash classes from DOM
    try {
      const flashElements = document.querySelectorAll('.file-update-flash');
      flashElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.classList.remove('file-update-flash', 'flash-created', 'flash-modified', 'flash-deleted', 'flash-batch', 'flash-generated');
        htmlElement.style.removeProperty('--flash-color');
        htmlElement.style.removeProperty('--flash-duration');
      });
    } catch (error) {
      console.debug('Failed to clear flash effects:', error);
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    queueLength: number;
    isProcessing: boolean;
    activeFlashes: number;
    config: FileUpdateNotificationConfig;
  } {
    return {
      queueLength: this.notificationQueue.length,
      isProcessing: this.isProcessingQueue,
      activeFlashes: this.activeFlashes.size,
      config: this.config
    };
  }
}

// Global notification manager instance
export const fileUpdateNotifications = new FileUpdateNotificationManager();

/**
 * Convenience functions for common notifications
 */
export const FileNotifications = {
  /**
   * Notify file created
   */
  created: (filePath: string, source: string, size?: number, content?: string) => {
    fileUpdateNotifications.notifyFileUpdate(filePath, 'created', source, { size, content });
  },

  /**
   * Notify file modified
   */
  modified: (filePath: string, source: string, size?: number, content?: string) => {
    fileUpdateNotifications.notifyFileUpdate(filePath, 'modified', source, { size, content });
  },

  /**
   * Notify file deleted
   */
  deleted: (filePath: string, source: string) => {
    fileUpdateNotifications.notifyFileUpdate(filePath, 'deleted', source);
  },

  /**
   * Notify AI generated file(s)
   */
  generated: (filePath: string, source: string, size?: number, content?: string, metadata?: Record<string, any>) => {
    fileUpdateNotifications.notifyFileUpdate(filePath, 'generated', source, { size, content, metadata });
  },

  /**
   * Notify batch file updates
   */
  batch: (files: Array<{ path: string; size?: number; content?: string }>, source: string, metadata?: Record<string, any>) => {
    fileUpdateNotifications.notifyBatchFileUpdate(
      files.map(file => ({ ...file, type: 'generated' as const })),
      source,
      metadata
    );
  }
};

/**
 * CSS for flash animations (to be added to global styles)
 */
export const getFlashAnimationCSS = (): string => `
.file-update-flash {
  animation: file-flash var(--flash-duration, 2000ms) ease-out;
  position: relative;
}

@keyframes file-flash {
  0% {
    background-color: var(--flash-color, #3b82f6);
    box-shadow: 0 0 10px var(--flash-color, #3b82f6);
    transform: scale(1.02);
  }
  50% {
    background-color: var(--flash-color, #3b82f6);
    box-shadow: 0 0 15px var(--flash-color, #3b82f6);
    transform: scale(1.02);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
    transform: scale(1);
  }
}

.file-update-flash::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, var(--flash-color, #3b82f6), transparent);
  border-radius: inherit;
  z-index: -1;
  animation: file-flash-border var(--flash-duration, 2000ms) ease-out;
}

@keyframes file-flash-border {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}
`;