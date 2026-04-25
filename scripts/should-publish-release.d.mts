export interface ShouldPublishContext {
  repository: string;
  token: string;
  commitSha: string;
  expectedTitle: string;
  expectedAuthor: string;
  expectedBaseBranch: string;
}

export interface AssociatedPullRequest {
  title: string;
  user: { login?: string } | null;
  base: { ref?: string } | null;
  merged_at: string | null;
}

export function createValidationError(message: string): Error;

export function requireEnv(env: NodeJS.ProcessEnv, name: string): string;

export function readShouldPublishContext(
  env?: NodeJS.ProcessEnv,
): ShouldPublishContext;

export function fetchAssociatedPullRequests(
  request: {
    owner: string;
    repo: string;
    commitSha: string;
    token: string;
  },
  fetchImpl?: typeof fetch,
): Promise<AssociatedPullRequest[]>;

export function shouldPublishRelease(
  context: ShouldPublishContext,
  pullRequestFetcher?: typeof fetchAssociatedPullRequests,
): Promise<boolean>;

export function isEntrypoint(): boolean;

export function main(): Promise<void>;
