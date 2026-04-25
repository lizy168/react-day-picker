import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * @typedef {object} GitHubRelease
 * @property {string} html_url
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
 * Returns whether an error represents a not-found GitHub Release response.
 *
 * @param {unknown} error - Error thrown while looking up a GitHub Release.
 * @returns {boolean} True for release-not-found errors.
 */
export function isReleaseNotFoundError(error) {
  return error instanceof Error && "status" in error && error.status === 404;
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
 * Reads the GitHub release creation context from environment variables.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - Environment variables provided
 *   by the runner. Default is `process.env`
 * @returns {{
 *   repository: string;
 *   token: string;
 *   commitSha: string;
 *   packageVersion: string;
 * }}
 *   Normalized workflow context.
 */
export function readCreateReleaseContext(env = process.env) {
  return {
    repository: requireEnv(env, "GITHUB_REPOSITORY"),
    token: requireEnv(env, "GITHUB_TOKEN"),
    commitSha: requireEnv(env, "GITHUB_SHA"),
    packageVersion: requireEnv(env, "PACKAGE_VERSION"),
  };
}

/**
 * Fetches a GitHub Release by tag name.
 *
 * @param {{ owner: string; repo: string; tag: string; token: string }} request
 *   - Release lookup request.
 *
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation used for the
 *   API request. Default is `fetch`
 * @returns {Promise<GitHubRelease>} The matching GitHub Release payload.
 */
export async function fetchReleaseByTag(request, fetchImpl = fetch) {
  const { owner, repo, tag, token } = request;
  const response = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (response.status === 404) {
    throw Object.assign(
      createValidationError(`GitHub Release ${tag} was not found.`),
      {
        status: 404,
      },
    );
  }

  if (!response.ok) {
    throw createValidationError(
      `Could not read GitHub Release ${tag} (HTTP ${response.status}).`,
    );
  }

  return response.json();
}

/**
 * Creates a published GitHub Release for the given package version.
 *
 * @param {{
 *   owner: string;
 *   repo: string;
 *   tag: string;
 *   token: string;
 *   commitSha: string;
 *   prerelease: boolean;
 * }} request
 *   - Release creation request.
 *
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation used for the
 *   API request. Default is `fetch`
 * @returns {Promise<GitHubRelease>} The created GitHub Release payload.
 */
export async function createRelease(request, fetchImpl = fetch) {
  const { owner, repo, tag, token, commitSha, prerelease } = request;
  const response = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        tag_name: tag,
        target_commitish: commitSha,
        name: tag,
        draft: false,
        prerelease,
        generate_release_notes: true,
      }),
    },
  );

  if (!response.ok) {
    throw createValidationError(
      `Could not create GitHub Release ${tag} (HTTP ${response.status}).`,
    );
  }

  return response.json();
}

/**
 * Creates the repo GitHub Release for a published version unless it already
 * exists.
 *
 * @param {{
 *   repository: string;
 *   token: string;
 *   commitSha: string;
 *   packageVersion: string;
 * }} context
 *   - Normalized workflow context.
 *
 * @param {{
 *   fetchRelease?: typeof fetchReleaseByTag;
 *   createRelease?: typeof createRelease;
 * }} [options]
 *   - Test hooks for API requests.
 *
 * @returns {Promise<{
 *   created: boolean;
 *   release: GitHubRelease;
 *   tag: string;
 * }>}
 *   Result metadata for logging and tests.
 */
export async function createGitHubRelease(context, options = {}) {
  const [owner, repo] = context.repository.split("/");
  if (!owner || !repo) {
    throw createValidationError(
      `Invalid GITHUB_REPOSITORY value: ${context.repository}`,
    );
  }

  const tag = `v${context.packageVersion}`;
  const prerelease = context.packageVersion.includes("-next");
  const {
    fetchRelease = fetchReleaseByTag,
    createRelease: createReleaseRequest = createRelease,
  } = options;

  try {
    const existingRelease = await fetchRelease({
      owner,
      repo,
      tag,
      token: context.token,
    });
    return { created: false, release: existingRelease, tag };
  } catch (error) {
    if (!isReleaseNotFoundError(error)) {
      throw error;
    }
  }

  const createdRelease = await createReleaseRequest({
    owner,
    repo,
    tag,
    token: context.token,
    commitSha: context.commitSha,
    prerelease,
  });

  return { created: true, release: createdRelease, tag };
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
 * Runs the GitHub Release creation as a CLI program.
 *
 * @returns {Promise<void>} Resolves when the release has been created or
 *   reused.
 */
export async function main() {
  const context = readCreateReleaseContext();
  const result = await createGitHubRelease(context);
  if (result.created) {
    console.log(
      `Created GitHub release ${result.tag} at ${result.release.html_url}.`,
    );
  } else {
    console.log(
      `GitHub release ${result.tag} already exists at ${result.release.html_url}.`,
    );
  }
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
