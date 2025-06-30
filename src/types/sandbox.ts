import { WebContainer } from '@webcontainer/api';

export interface SandboxFile {
  path: string;
  content: string;
  lastModified: number;
}

export interface SandboxState {
  container: WebContainer | null;
  files: Record<string, SandboxFile>;
  previewUrl: string | null;
  isBooting: boolean;
  isRunning: boolean;
  logs: string[];
  errors: string[];
  receivedFileCount: number;
  hasStartedProject: boolean;
}