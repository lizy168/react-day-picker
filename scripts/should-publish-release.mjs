import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * @typedef {object} AssociatedPullRequest
 * @property {{ login?: string } | null} user
 * @property {{ ref?: string } | null} base
 * @property {{ ref?: string } | null} head
 * @property {string | null} merged_at
 */

/**
 * Fetches pull requests associated with a commit.
 *
 * @param {{
 *   owner: string;
 *   repo: string;
 *   commitSha: string;
 *   token: string;
 * }} request
 *   - Commit lookup request.
 *
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation used for the
 *   API request. Default is `fetch`
 * @returns {Promise<AssociatedPullRequest[]>} Pull requests associated with the
 *   commit.
 */
async function fetchAssociatedPullRequests(request, fetchImpl = fetch) {
  const { owner, repo, commitSha, token } = request;
  const response = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(commitSha)}/pulls`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not read pull requests associated with commit ${commitSha} (HTTP ${response.status}).`,
    );
  }

  return response.json();
}

/**
 * Returns whether the push commit came from the Changesets release PR.
 *
 * @param {{
 *   repository: string;
 *   token: string;
 *   commitSha: string;
 *   expectedHeadBranch: string;
 *   expectedAuthor: string;
 *   expectedBaseBranch: string;
 * }} context
 *   - Normalized workflow context.
 *
 * @param {typeof fetchAssociatedPullRequests} [pullRequestFetcher=fetchAssociatedPullRequests]
 *   - Pull request lookup helper. Default is `fetchAssociatedPullRequests`
 *
 * @returns {Promise<boolean>} True when the commit was introduced by the
 *   expected release PR.
 */
export async function shouldPublishRelease(
  context,
  pullRequestFetcher = fetchAssociatedPullRequests,
) {
  const [owner, repo] = context.repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${context.repository}`);
  }

  const pullRequests = await pullRequestFetcher({
    owner,
    repo,
    commitSha: context.commitSha,
    token: context.token,
  });

  return pullRequests.some(function matchesReleasePullRequest(pullRequest) {
    return (
      pullRequest.head?.ref === context.expectedHeadBranch &&
      pullRequest.user?.login === context.expectedAuthor &&
      pullRequest.base?.ref === context.expectedBaseBranch &&
      Boolean(pullRequest.merged_at)
    );
  });
}

/**
 * Runs the release-merge check as a CLI program.
 *
 * @returns {Promise<void>} Resolves when the result has been printed.
 */
export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const commitSha = process.env.GITHUB_SHA;

  if (!repository) {
    throw new Error("Missing required environment variable: GITHUB_REPOSITORY");
  }
  if (!token) {
    throw new Error("Missing required environment variable: GITHUB_TOKEN");
  }
  if (!commitSha) {
    throw new Error("Missing required environment variable: GITHUB_SHA");
  }

  const context = {
    repository,
    token,
    commitSha,
    expectedHeadBranch:
      process.env.EXPECTED_PR_BRANCH || "changesets-release/main",
    expectedAuthor: process.env.EXPECTED_PR_AUTHOR || "github-actions[bot]",
    expectedBaseBranch: process.env.EXPECTED_BASE_BRANCH || "main",
  };
  const shouldPublish = await shouldPublishRelease(context);
  console.log(shouldPublish ? "true" : "false");
}

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  main().catch(function handleError(error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}
