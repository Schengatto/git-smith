export type FileType = "source" | "test" | "config" | "styles" | "docs" | "cicd" | "other";

export interface LanguageStat {
  language: string;
  lines: number;
  files: number;
  percentage: number;
  color: string;
}

export interface TypeStat {
  type: FileType;
  lines: number;
  files: number;
  color: string;
}

export interface TestRatio {
  sourceLines: number;
  testLines: number;
  ratio: number;
  percentage: number;
}

export interface CodebaseStats {
  totalLines: number;
  totalFiles: number;
  languageCount: number;
  byLanguage: LanguageStat[];
  byType: TypeStat[];
  testRatio: TestRatio;
}
