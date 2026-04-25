export interface CreateReleaseContext {
  repository: string;
  token: string;
  commitSha: string;
  packageVersion: string;
}

export interface GitHubRelease {
  html_url: string;
}

export function createValidationError(message: string): Error;

export function isReleaseNotFoundError(error: unknown): boolean;

export function requireEnv(env: NodeJS.ProcessEnv, name: string): string;

export function readCreateReleaseContext(
  env?: NodeJS.ProcessEnv,
): CreateReleaseContext;

export function fetchReleaseByTag(
  request: {
    owner: string;
    repo: string;
    tag: string;
    token: string;
  },
  fetchImpl?: typeof fetch,
): Promise<GitHubRelease>;

export function createRelease(
  request: {
    owner: string;
    repo: string;
    tag: string;
    token: string;
    commitSha: string;
    prerelease: boolean;
  },
  fetchImpl?: typeof fetch,
): Promise<GitHubRelease>;

export function createGitHubRelease(
  context: CreateReleaseContext,
  options?: {
    fetchRelease?: typeof fetchReleaseByTag;
    createRelease?: typeof createRelease;
  },
): Promise<{ created: boolean; release: GitHubRelease; tag: string }>;

export function isEntrypoint(): boolean;

export function main(): Promise<void>;
