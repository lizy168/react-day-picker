export interface ShouldPublishContext {
  repository: string;
  token: string;
  commitSha: string;
  expectedHeadBranch: string;
  expectedAuthor: string;
  expectedBaseBranch: string;
}

export interface AssociatedPullRequest {
  user: { login?: string } | null;
  base: { ref?: string } | null;
  head: { ref?: string } | null;
  merged_at: string | null;
}

export function shouldPublishRelease(
  context: ShouldPublishContext,
  pullRequestFetcher?: (request: {
    owner: string;
    repo: string;
    commitSha: string;
    token: string;
  }) => Promise<AssociatedPullRequest[]>,
): Promise<boolean>;

export function main(): Promise<void>;
