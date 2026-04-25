import { execFileSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createGitHubRelease } from "./create-github-release.mjs";
import {
  getUnpublishedPackages,
  publishPackages,
  readPackageInfo,
} from "./publish-packages.mjs";
import { shouldPublishRelease } from "./should-publish-release.mjs";

const repoRoot = new URL("../", import.meta.url);
const mainPackageDir = "packages/react-day-picker";

const validationCommands = [
  ["typecheck"],
  ["lint", "ci", ".", "--reporter=github"],
  ["test"],
  ["test:tz"],
  ["build"],
  ["check:versions"],
  ["pack:dry-run"],
  ["test:build"],
];

/**
 * Runs the release automation for a merged Changesets release PR.
 *
 * @param {object} [options] - Test hooks for release automation.
 * @param {NodeJS.ProcessEnv} [options.env=process.env] - Environment variables.
 *   Default is `process.env`
 * @param {typeof execFileSync} [options.execFile=execFileSync] - Command
 *   runner. Default is `execFileSync`
 * @param {typeof readPackageInfo} [options.readPackage=readPackageInfo] -
 *   Package metadata reader. Default is `readPackageInfo`
 * @param {typeof getUnpublishedPackages} [options.getUnpublished=getUnpublishedPackages]
 *   - Registry lookup helper. Default is `getUnpublishedPackages`
 *
 * @param {typeof publishPackages} [options.publish=publishPackages] - Publish
 *   helper. Default is `publishPackages`
 * @param {typeof shouldPublishRelease} [options.shouldPublish=shouldPublishRelease]
 *   - Release PR matcher. Default is `shouldPublishRelease`
 *
 * @param {typeof createGitHubRelease} [options.createRelease=createGitHubRelease]
 *   - GitHub Release helper. Default is `createGitHubRelease`
 *
 * @returns {Promise<{
 *   shouldPublish: boolean;
 *   publishedPackages: boolean;
 *   releaseCreated: boolean;
 * }>}
 *   Result metadata for workflow logging and tests.
 */
export async function releaseCi(options = {}) {
  const {
    env = process.env,
    execFile = execFileSync,
    readPackage = readPackageInfo,
    getUnpublished = getUnpublishedPackages,
    publish = publishPackages,
    shouldPublish = shouldPublishRelease,
    createRelease = createGitHubRelease,
  } = options;

  const repository = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  if (!repository) {
    throw new Error("Missing required environment variable: GITHUB_REPOSITORY");
  }
  if (!token) {
    throw new Error("Missing required environment variable: GITHUB_TOKEN");
  }

  const commitSha = String(
    execFile("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  ).trim();
  const packageInfo = readPackage(mainPackageDir);

  const publishAllowed = await shouldPublish({
    repository,
    token,
    commitSha,
    expectedHeadBranch: env.EXPECTED_PR_BRANCH || "changesets-release/main",
    expectedAuthor: env.EXPECTED_PR_AUTHOR || "github-actions[bot]",
    expectedBaseBranch: env.EXPECTED_BASE_BRANCH || "main",
  });

  if (!publishAllowed) {
    console.log(
      "This commit did not come from the merged Changesets release PR. Skipping release automation.",
    );
    return {
      shouldPublish: false,
      publishedPackages: false,
      releaseCreated: false,
    };
  }

  const unpublishedPackages = getUnpublished({
    execFile,
    readPackage,
  });
  let publishedPackages = false;

  if (unpublishedPackages.length > 0) {
    for (const commandArgs of validationCommands) {
      execFile("pnpm", commandArgs, {
        cwd: repoRoot,
        stdio: "inherit",
      });
    }

    const npmTag = packageInfo.version.includes("-next") ? "next" : "latest";
    console.log(`Publishing ${packageInfo.version} with dist-tag ${npmTag}.`);
    publish(npmTag, { execFile, readPackage });
    publishedPackages = true;
  } else {
    console.log("All publishable package versions are already on npm.");
  }

  const releaseResult = await createRelease({
    repository,
    token,
    commitSha,
    packageVersion: packageInfo.version,
  });

  return {
    shouldPublish: true,
    publishedPackages,
    releaseCreated: releaseResult.created,
  };
}

/**
 * Runs release automation as a CLI program.
 *
 * @returns {Promise<void>} Resolves when release automation has finished.
 */
export async function main() {
  const result = await releaseCi();
  if (!result.shouldPublish) {
    return;
  }

  if (result.publishedPackages) {
    console.log("Published package versions to npm.");
  }

  if (result.releaseCreated) {
    console.log("Created the repo GitHub Release.");
  } else {
    console.log("The repo GitHub Release already exists.");
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
