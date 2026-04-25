import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * @typedef {object} GitHubRelease
 * @property {string} html_url
 */

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
async function fetchReleaseByTag(request, fetchImpl = fetch) {
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
    throw Object.assign(new Error(`GitHub Release ${tag} was not found.`), {
      status: 404,
    });
  }

  if (!response.ok) {
    throw new Error(
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
async function createRelease(request, fetchImpl = fetch) {
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
    throw new Error(
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
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${context.repository}`);
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
    if (
      !(error instanceof Error && "status" in error && error.status === 404)
    ) {
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
 * Runs the GitHub Release creation as a CLI program.
 *
 * @returns {Promise<void>} Resolves when the release has been created or
 *   reused.
 */
export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const commitSha = process.env.GITHUB_SHA;
  const packageVersion = process.env.PACKAGE_VERSION;

  if (!repository) {
    throw new Error("Missing required environment variable: GITHUB_REPOSITORY");
  }
  if (!token) {
    throw new Error("Missing required environment variable: GITHUB_TOKEN");
  }
  if (!commitSha) {
    throw new Error("Missing required environment variable: GITHUB_SHA");
  }
  if (!packageVersion) {
    throw new Error("Missing required environment variable: PACKAGE_VERSION");
  }

  const context = {
    repository,
    token,
    commitSha,
    packageVersion,
  };
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
