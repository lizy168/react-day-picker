type ReleaseCiModule = typeof import("./release-ci");
type ReleaseCiOptions = Parameters<ReleaseCiModule["releaseCi"]>[0];
type ResolvedReleaseCiOptions = Required<NonNullable<ReleaseCiOptions>>;

type ReleaseCiExecCall = {
  args: string[];
  command: string;
  options?: unknown;
};

let releaseCi: ReleaseCiModule["releaseCi"];
let releaseCiExecCalls: ReleaseCiExecCall[];
let releaseEnv: NodeJS.ProcessEnv;
let execFile: jest.MockedFunction<ResolvedReleaseCiOptions["execFile"]>;
let readPackage: jest.MockedFunction<ResolvedReleaseCiOptions["readPackage"]>;
let getUnpublished: jest.MockedFunction<
  ResolvedReleaseCiOptions["getUnpublished"]
>;
let publish: jest.MockedFunction<ResolvedReleaseCiOptions["publish"]>;
let shouldPublish: jest.MockedFunction<
  ResolvedReleaseCiOptions["shouldPublish"]
>;
let createReleaseAutomation: jest.MockedFunction<
  ResolvedReleaseCiOptions["createRelease"]
>;

beforeAll(async function loadModule() {
  ({ releaseCi } = await import("./release-ci"));
});

beforeEach(function setupReleaseCiTestState() {
  releaseCiExecCalls = [];
  releaseEnv = {
    GITHUB_REPOSITORY: "gpbl/react-day-picker",
    GITHUB_TOKEN: "test-token",
    EXPECTED_PR_AUTHOR: "github-actions[bot]",
    EXPECTED_BASE_BRANCH: "main",
    EXPECTED_PR_BRANCH: "changesets-release/main",
  };

  execFile = jest.fn(function mockExecFile(
    command: string,
    args: string[],
    options?: unknown,
  ) {
    releaseCiExecCalls.push({ command, args, options });
    if (command === "git" && args[0] === "rev-parse") {
      return "abc123\n";
    }
    return "";
  }) as jest.MockedFunction<ResolvedReleaseCiOptions["execFile"]>;

  readPackage = jest.fn(function mockReadPackage(_packageDir: string) {
    return {
      name: "react-day-picker",
      version: "10.0.0-next.3",
    };
  }) as jest.MockedFunction<ResolvedReleaseCiOptions["readPackage"]>;

  getUnpublished = jest.fn(function mockGetUnpublished() {
    return [
      {
        packageDir: "packages/react-day-picker",
        packageInfo: {
          name: "react-day-picker",
          version: "10.0.0-next.3",
        },
      },
    ];
  }) as jest.MockedFunction<ResolvedReleaseCiOptions["getUnpublished"]>;

  publish = jest.fn(function mockPublish(
    _tag: string,
    _options?: Parameters<ResolvedReleaseCiOptions["publish"]>[1],
  ) {}) as jest.MockedFunction<ResolvedReleaseCiOptions["publish"]>;

  shouldPublish = jest.fn(async function mockShouldPublish(
    _context: Parameters<ResolvedReleaseCiOptions["shouldPublish"]>[0],
    _pullRequestFetcher?: Parameters<
      ResolvedReleaseCiOptions["shouldPublish"]
    >[1],
  ) {
    return true;
  }) as jest.MockedFunction<ResolvedReleaseCiOptions["shouldPublish"]>;

  createReleaseAutomation = jest.fn(async function mockCreateRelease(
    _context: Parameters<ResolvedReleaseCiOptions["createRelease"]>[0],
    _options?: Parameters<ResolvedReleaseCiOptions["createRelease"]>[1],
  ) {
    return {
      created: true,
      release: {
        html_url:
          "https://github.com/gpbl/react-day-picker/releases/tag/v10.0.0-next.3",
      },
      tag: "v10.0.0-next.3",
    };
  }) as jest.MockedFunction<ResolvedReleaseCiOptions["createRelease"]>;
});

describe("releaseCi", function describeReleaseCi() {
  test("it skips when the checked-out commit is not the merged release PR", async function testSkipNonReleaseCommit() {
    shouldPublish.mockResolvedValue(false);

    await expect(
      releaseCi({
        env: releaseEnv,
        execFile,
        readPackage,
        getUnpublished,
        publish,
        shouldPublish,
        createRelease: createReleaseAutomation,
      }),
    ).resolves.toEqual({
      shouldPublish: false,
      publishedPackages: false,
      releaseCreated: false,
    });

    expect(getUnpublished).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(createReleaseAutomation).not.toHaveBeenCalled();
  });

  test("it validates, publishes, and creates the repo release when versions are unpublished", async function testPublishPath() {
    await expect(
      releaseCi({
        env: releaseEnv,
        execFile,
        readPackage,
        getUnpublished,
        publish,
        shouldPublish,
        createRelease: createReleaseAutomation,
      }),
    ).resolves.toEqual({
      shouldPublish: true,
      publishedPackages: true,
      releaseCreated: true,
    });

    expect(shouldPublish).toHaveBeenCalledWith({
      repository: "gpbl/react-day-picker",
      token: "test-token",
      commitSha: "abc123",
      expectedHeadBranch: "changesets-release/main",
      expectedAuthor: "github-actions[bot]",
      expectedBaseBranch: "main",
    });
    expect(
      releaseCiExecCalls.map((call) => [call.command, ...call.args]),
    ).toEqual([
      ["git", "rev-parse", "HEAD"],
      ["pnpm", "typecheck"],
      ["pnpm", "lint", "ci", ".", "--reporter=github"],
      ["pnpm", "test"],
      ["pnpm", "test:tz"],
      ["pnpm", "build"],
      ["pnpm", "check:versions"],
      ["pnpm", "pack:dry-run"],
      ["pnpm", "test:build"],
    ]);
    expect(publish).toHaveBeenCalledWith("next", {
      execFile,
      readPackage,
    });
    expect(createReleaseAutomation).toHaveBeenCalledWith({
      repository: "gpbl/react-day-picker",
      token: "test-token",
      commitSha: "abc123",
      packageVersion: "10.0.0-next.3",
    });
  });

  test("it still creates the repo release when packages are already published", async function testCreateReleaseWithoutPublishing() {
    getUnpublished.mockReturnValue([]);

    await expect(
      releaseCi({
        env: releaseEnv,
        execFile,
        readPackage,
        getUnpublished,
        publish,
        shouldPublish,
        createRelease: createReleaseAutomation,
      }),
    ).resolves.toEqual({
      shouldPublish: true,
      publishedPackages: false,
      releaseCreated: true,
    });

    expect(
      releaseCiExecCalls.map((call) => [call.command, ...call.args]),
    ).toEqual([["git", "rev-parse", "HEAD"]]);
    expect(publish).not.toHaveBeenCalled();
    expect(createReleaseAutomation).toHaveBeenCalledTimes(1);
  });
});
