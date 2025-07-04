import { diffLines, Change } from 'diff';

export interface DiffLine {
  text: string;
  added: boolean;
  removed: boolean;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiff {
  path: string;
  lines: DiffLine[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export function generateFileDiff(oldContent: string, newContent: string, path: string = ''): FileDiff {
  const diffs: Change[] = diffLines(oldContent, newContent);
  const lines: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;
  let additions = 0;
  let deletions = 0;

  diffs.forEach(part => {
    const text = part.value;
    const textLines = text.split('\n');
    
    // Remove the last empty line if it exists (artifact of split)
    if (textLines[textLines.length - 1] === '') {
      textLines.pop();
    }

    textLines.forEach((line, index) => {
      const diffLine: DiffLine = {
        text: line,
        added: part.added || false,
        removed: part.removed || false,
        oldLineNumber: !part.added ? oldLineNum : undefined,
        newLineNumber: !part.removed ? newLineNum : undefined
      };

      lines.push(diffLine);

      // Update line numbers
      if (!part.added) oldLineNum++;
      if (!part.removed) newLineNum++;

      // Update stats
      if (part.added) additions++;
      if (part.removed) deletions++;
    });
  });

  return {
    path,
    lines,
    stats: {
      additions,
      deletions,
      total: additions + deletions
    }
  };
}

export function generateUnifiedDiff(oldContent: string, newContent: string, oldPath: string = 'a/file', newPath: string = 'b/file'): string {
  const diffs = diffLines(oldContent, newContent);
  let result = `--- ${oldPath}\n+++ ${newPath}\n`;
  
  let oldLineNum = 1;
  let newLineNum = 1;
  
  for (const part of diffs) {
    const lines = part.value.split('\n');
    // Remove last empty line
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    for (const line of lines) {
      if (part.added) {
        result += `+${line}\n`;
        newLineNum++;
      } else if (part.removed) {
        result += `-${line}\n`;
        oldLineNum++;
      } else {
        result += ` ${line}\n`;
        oldLineNum++;
        newLineNum++;
      }
    }
  }
  
  return result;
}

export function getDiffSummary(diff: FileDiff): string {
  const { additions, deletions } = diff.stats;
  
  if (additions === 0 && deletions === 0) {
    return 'No changes';
  }
  
  const parts = [];
  if (additions > 0) {
    parts.push(`+${additions} addition${additions !== 1 ? 's' : ''}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions} deletion${deletions !== 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
}

export function hasDifferences(oldContent: string, newContent: string): boolean {
  return oldContent.trim() !== newContent.trim();
}