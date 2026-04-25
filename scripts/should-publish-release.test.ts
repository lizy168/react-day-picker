export {};

type ShouldPublishModule = typeof import("./should-publish-release.mjs");
type PullRequestFetcher = NonNullable<
  Parameters<ShouldPublishModule["shouldPublishRelease"]>[1]
>;

let shouldPublishRelease: ShouldPublishModule["shouldPublishRelease"];
let context: ReturnType<typeof createContext>;
let pullRequestFetcher: jest.MockedFunction<PullRequestFetcher>;

beforeAll(async function loadModule() {
  ({ shouldPublishRelease } = await import("./should-publish-release.mjs"));
});

beforeEach(function setupTestState() {
  context = createContext();
  pullRequestFetcher = jest.fn(async function fetchAssociatedPullRequests(
    _request: Parameters<PullRequestFetcher>[0],
    _fetchImpl?: Parameters<PullRequestFetcher>[1],
  ) {
    return [createPullRequest()];
  }) as jest.MockedFunction<PullRequestFetcher>;
});

function createContext(
  overrides: Partial<{
    repository: string;
    token: string;
    commitSha: string;
    expectedTitle: string;
    expectedAuthor: string;
    expectedBaseBranch: string;
  }> = {},
) {
  return {
    repository: "gpbl/react-day-picker",
    token: "test-token",
    commitSha: "abc123",
    expectedTitle: "build: version packages",
    expectedAuthor: "github-actions[bot]",
    expectedBaseBranch: "main",
    ...overrides,
  };
}

function createPullRequest(
  overrides: Partial<{
    title: string;
    user: { login?: string } | null;
    base: { ref?: string } | null;
    merged_at: string | null;
  }> = {},
) {
  return {
    title: "build: version packages",
    user: { login: "github-actions[bot]" },
    base: { ref: "main" },
    merged_at: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

describe("shouldPublishRelease", function describeShouldPublishRelease() {
  test("it returns true for the expected merged release PR", async function testReleasePullRequest() {
    await expect(
      shouldPublishRelease(context, pullRequestFetcher),
    ).resolves.toBe(true);
  });

  test("it looks up pull requests for the pushed commit", async function testLookupRequest() {
    await shouldPublishRelease(context, pullRequestFetcher);

    expect(pullRequestFetcher).toHaveBeenCalledWith({
      owner: "gpbl",
      repo: "react-day-picker",
      commitSha: "abc123",
      token: "test-token",
    });
  });

  test("it returns false when no associated pull request matches", async function testNoMatch() {
    pullRequestFetcher.mockResolvedValue([
      createPullRequest({ title: "docs: tweak homepage copy" }),
    ]);

    await expect(
      shouldPublishRelease(context, pullRequestFetcher),
    ).resolves.toBe(false);
  });

  test("it rejects invalid repository values", async function testInvalidRepository() {
    context.repository = "react-day-picker";

    await expect(
      shouldPublishRelease(context, pullRequestFetcher),
    ).rejects.toThrow("Invalid GITHUB_REPOSITORY value: react-day-picker");
  });

  test("it rejects unmerged release pull requests", async function testUnmergedPullRequest() {
    pullRequestFetcher.mockResolvedValue([
      createPullRequest({ merged_at: null }),
    ]);

    await expect(
      shouldPublishRelease(context, pullRequestFetcher),
    ).resolves.toBe(false);
  });
});
