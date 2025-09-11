import { execSync } from 'child_process';

export function readGitCommitShort(): string | null {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return hash || null;
  } catch {
    return process.env.BUILD_COMMIT || null;
  }
}


