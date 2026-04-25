import { execFileSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  type CreateReleaseContext,
  createGitHubRelease,
} from "./create-github-release";
import {
  type ExecFile,
  getUnpublishedPackages,
  type PublishPackagesOptions,
  publishPackages,
  readPackageInfo,
} from "./publish-packages";
import {
  type ShouldPublishContext,
  shouldPublishRelease,
} from "./should-publish-release";

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
] as const;

type ReleaseCiCreateRelease = (
  context: CreateReleaseContext,
  options?: {
    fetchRelease?: (request: {
      owner: string;
      repo: string;
      tag: string;
      token: string;
    }) => Promise<{ html_url: string }>;
    createRelease?: (request: {
      owner: string;
      repo: string;
      tag: string;
      token: string;
      commitSha: string;
      prerelease: boolean;
    }) => Promise<{ html_url: string }>;
  },
) => Promise<{
  created: boolean;
  release: { html_url: string };
  tag: string;
}>;

type ReleaseCiShouldPublish = (
  context: ShouldPublishContext,
  pullRequestFetcher?: (request: {
    owner: string;
    repo: string;
    commitSha: string;
    token: string;
  }) => Promise<
    {
      user: { login?: string } | null;
      base: { ref?: string } | null;
      head: { ref?: string } | null;
      merged_at: string | null;
    }[]
  >,
) => Promise<boolean>;

export interface ReleaseCiOptions {
  env?: NodeJS.ProcessEnv;
  execFile?: ExecFile;
  readPackage?: typeof readPackageInfo;
  getUnpublished?: typeof getUnpublishedPackages;
  publish?: typeof publishPackages;
  shouldPublish?: ReleaseCiShouldPublish;
  createRelease?: ReleaseCiCreateRelease;
}

export async function releaseCi(options: ReleaseCiOptions = {}): Promise<{
  shouldPublish: boolean;
  publishedPackages: boolean;
  releaseCreated: boolean;
}> {
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
  } satisfies PublishPackagesOptions);
  let publishedPackages = false;

  if (unpublishedPackages.length > 0) {
    for (const commandArgs of validationCommands) {
      execFile("pnpm", [...commandArgs], {
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

export async function main(): Promise<void> {
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
  main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}
