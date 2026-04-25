export interface CreateReleaseContext {
  repository: string;
  token: string;
  commitSha: string;
  packageVersion: string;
}

export interface GitHubRelease {
  html_url: string;
}

export function createGitHubRelease(
  context: CreateReleaseContext,
  options?: {
    fetchRelease?: (request: {
      owner: string;
      repo: string;
      tag: string;
      token: string;
    }) => Promise<GitHubRelease>;
    createRelease?: (request: {
      owner: string;
      repo: string;
      tag: string;
      token: string;
      commitSha: string;
      prerelease: boolean;
    }) => Promise<GitHubRelease>;
  },
): Promise<{ created: boolean; release: GitHubRelease; tag: string }>;

export function main(): Promise<void>;
