import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * @typedef {object} AssociatedPullRequest
 * @property {string} title
 * @property {{ login?: string } | null} user
 * @property {{ ref?: string } | null} base
 * @property {string | null} merged_at
 */

/**
 * Throws a consistent validation error for missing or invalid input.
 *
 * @param {string} message - Human-readable failure message.
 * @returns {Error} A regular error that can be surfaced in tests or the CLI.
 */
export function createValidationError(message) {
  return new Error(message);
}

/**
 * Throws a validation error when a required environment variable is missing.
 *
 * @param {NodeJS.ProcessEnv} env - Environment variables to read from.
 * @param {string} name - Required environment variable name.
 * @returns {string} The environment variable value.
 */
export function requireEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw createValidationError(
      `Missing required environment variable: ${name}`,
    );
  }
  return value;
}

/**
 * Reads the release-merge detection context from environment variables.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - Environment variables provided
 *   by the runner. Default is `process.env`
 * @returns {{
 *   repository: string;
 *   token: string;
 *   commitSha: string;
 *   expectedTitle: string;
 *   expectedAuthor: string;
 *   expectedBaseBranch: string;
 * }}
 *   Normalized workflow context.
 */
export function readShouldPublishContext(env = process.env) {
  return {
    repository: requireEnv(env, "GITHUB_REPOSITORY"),
    token: requireEnv(env, "GITHUB_TOKEN"),
    commitSha: requireEnv(env, "GITHUB_SHA"),
    expectedTitle: env.EXPECTED_PR_TITLE || "build: version packages",
    expectedAuthor: env.EXPECTED_PR_AUTHOR || "github-actions[bot]",
    expectedBaseBranch: env.EXPECTED_BASE_BRANCH || "main",
  };
}

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
export async function fetchAssociatedPullRequests(request, fetchImpl = fetch) {
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
    throw createValidationError(
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
 *   expectedTitle: string;
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
    throw createValidationError(
      `Invalid GITHUB_REPOSITORY value: ${context.repository}`,
    );
  }

  const pullRequests = await pullRequestFetcher({
    owner,
    repo,
    commitSha: context.commitSha,
    token: context.token,
  });

  return pullRequests.some(function matchesReleasePullRequest(pullRequest) {
    return (
      pullRequest.title === context.expectedTitle &&
      pullRequest.user?.login === context.expectedAuthor &&
      pullRequest.base?.ref === context.expectedBaseBranch &&
      Boolean(pullRequest.merged_at)
    );
  });
}

/**
 * Returns whether this module is being executed directly by Node.js.
 *
 * @returns {boolean} True when the file is the active CLI entrypoint.
 */
export function isEntrypoint() {
  const scriptPath = process.argv[1];
  if (!scriptPath) {
    return false;
  }
  return import.meta.url === pathToFileURL(scriptPath).href;
}

/**
 * Runs the release-merge check as a CLI program.
 *
 * @returns {Promise<void>} Resolves when the result has been printed.
 */
export async function main() {
  const context = readShouldPublishContext();
  const shouldPublish = await shouldPublishRelease(context);
  console.log(shouldPublish ? "true" : "false");
}

if (isEntrypoint()) {
  main().catch(function handleError(error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}
