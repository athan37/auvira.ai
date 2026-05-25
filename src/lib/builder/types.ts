import type { SiteSpec } from '../agent/schemas';

export interface GeneratedFile {
  filePath: string;
  content: string;
}

export interface GenerateWebsiteFilesResult {
  files: GeneratedFile[];
  summary: {
    fileCount: number;
    sections: string[];
  };
}