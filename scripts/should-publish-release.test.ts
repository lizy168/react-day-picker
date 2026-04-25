type ShouldPublishModule = typeof import("./should-publish-release");
type PullRequestFetcher = NonNullable<
  Parameters<ShouldPublishModule["shouldPublishRelease"]>[1]
>;

let shouldPublishRelease: ShouldPublishModule["shouldPublishRelease"];
let publishContext: ReturnType<typeof createShouldPublishContext>;
let pullRequestFetcher: jest.MockedFunction<PullRequestFetcher>;

beforeAll(async function loadModule() {
  ({ shouldPublishRelease } = await import("./should-publish-release"));
});

beforeEach(function setupTestState() {
  publishContext = createShouldPublishContext();
  pullRequestFetcher = jest.fn(async function fetchAssociatedPullRequests(
    _request: Parameters<PullRequestFetcher>[0],
  ) {
    return [createPullRequest()];
  }) as jest.MockedFunction<PullRequestFetcher>;
});

function createShouldPublishContext(
  overrides: Partial<{
    repository: string;
    token: string;
    commitSha: string;
    expectedHeadBranch: string;
    expectedAuthor: string;
    expectedBaseBranch: string;
  }> = {},
) {
  return {
    repository: "gpbl/react-day-picker",
    token: "test-token",
    commitSha: "abc123",
    expectedHeadBranch: "changesets-release/main",
    expectedAuthor: "github-actions[bot]",
    expectedBaseBranch: "main",
    ...overrides,
  };
}

function createPullRequest(
  overrides: Partial<{
    user: { login?: string } | null;
    base: { ref?: string } | null;
    head: { ref?: string } | null;
    merged_at: string | null;
  }> = {},
) {
  return {
    user: { login: "github-actions[bot]" },
    base: { ref: "main" },
    head: { ref: "changesets-release/main" },
    merged_at: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

describe("shouldPublishRelease", function describeShouldPublishRelease() {
  test("it returns true for the expected merged release PR", async function testReleasePullRequest() {
    await expect(
      shouldPublishRelease(publishContext, pullRequestFetcher),
    ).resolves.toBe(true);
  });

  test("it looks up pull requests for the pushed commit", async function testLookupRequest() {
    await shouldPublishRelease(publishContext, pullRequestFetcher);

    expect(pullRequestFetcher).toHaveBeenCalledWith({
      owner: "gpbl",
      repo: "react-day-picker",
      commitSha: "abc123",
      token: "test-token",
    });
  });

  test("it returns false when no associated pull request matches", async function testNoMatch() {
    pullRequestFetcher.mockResolvedValue([
      createPullRequest({ head: { ref: "docs/tweak-homepage-copy" } }),
    ]);

    await expect(
      shouldPublishRelease(publishContext, pullRequestFetcher),
    ).resolves.toBe(false);
  });

  test("it rejects invalid repository values", async function testInvalidRepository() {
    publishContext.repository = "react-day-picker";

    await expect(
      shouldPublishRelease(publishContext, pullRequestFetcher),
    ).rejects.toThrow("Invalid GITHUB_REPOSITORY value: react-day-picker");
  });

  test("it rejects unmerged release pull requests", async function testUnmergedPullRequest() {
    pullRequestFetcher.mockResolvedValue([
      createPullRequest({ merged_at: null }),
    ]);

    await expect(
      shouldPublishRelease(publishContext, pullRequestFetcher),
    ).resolves.toBe(false);
  });
});
