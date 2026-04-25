import type { readPackageInfo } from "./publish-packages.mjs";
import type { createGitHubRelease } from "./create-github-release.mjs";
import type {
  getUnpublishedPackages,
  publishPackages,
} from "./publish-packages.mjs";
import type { shouldPublishRelease } from "./should-publish-release.mjs";

export function readCurrentCommitSha(
  execFile?: (
    command: string,
    args: string[],
    options?: object,
  ) => Buffer | string,
): string;

export function resolveNpmTag(version: string): "latest" | "next";

export function runRepoCommand(
  args: string[],
  execFile?: (
    command: string,
    args: string[],
    options?: object,
  ) => Buffer | string,
): void;

export function releaseCi(options?: {
  env?: NodeJS.ProcessEnv;
  execFile?: (
    command: string,
    args: string[],
    options?: object,
  ) => Buffer | string;
  readPackage?: typeof readPackageInfo;
  getUnpublished?: typeof getUnpublishedPackages;
  publish?: typeof publishPackages;
  shouldPublish?: typeof shouldPublishRelease;
  createRelease?: typeof createGitHubRelease;
}): Promise<{
  shouldPublish: boolean;
  publishedPackages: boolean;
  releaseCreated: boolean;
}>;

export function isEntrypoint(): boolean;

export function main(): Promise<void>;
