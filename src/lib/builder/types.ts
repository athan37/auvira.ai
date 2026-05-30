import type { SiteSpec } from '../agent/schemas';

export interface GeneratedFile {
  filePath: string;
  content: string;
}

export interface GenerateWebsiteFilesResult {
  files: GeneratedFile[];
  analytics?: {
    publicSiteKey: string;
  };
  summary: {
    fileCount: number;
    sections: string[];
  };
}