export interface SavedFile {
  path: string;
  content: string;
}

export interface SavedAgent {
  id: string;
  type: string;
  state: any;
  task: string;
  files: SavedFile[];
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: number;
  agents: SavedAgent[];
  connections: {
    source: string;
    target: string;
  }[];
}