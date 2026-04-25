type CreateGitHubReleaseModule = typeof import("./create-github-release.mjs");
type FetchRelease = NonNullable<
  Parameters<CreateGitHubReleaseModule["createGitHubRelease"]>[1]
>["fetchRelease"];
type CreateRelease = NonNullable<
  Parameters<CreateGitHubReleaseModule["createGitHubRelease"]>[1]
>["createRelease"];

let createGitHubRelease: CreateGitHubReleaseModule["createGitHubRelease"];
let releaseContext: ReturnType<typeof createReleaseContext>;
let fetchRelease: jest.MockedFunction<NonNullable<FetchRelease>>;
let createRelease: jest.MockedFunction<NonNullable<CreateRelease>>;

beforeAll(async function loadModule() {
  ({ createGitHubRelease } = await import("./create-github-release.mjs"));
});

beforeEach(function setupTestState() {
  releaseContext = createReleaseContext();
  fetchRelease = jest.fn(async function fetchExistingRelease(
    _request: Parameters<NonNullable<FetchRelease>>[0],
  ) {
    return createReleasePayload();
  }) as jest.MockedFunction<NonNullable<FetchRelease>>;
  createRelease = jest.fn(async function createNewRelease(
    _request: Parameters<NonNullable<CreateRelease>>[0],
  ) {
    return createReleasePayload({
      html_url:
        "https://github.com/gpbl/react-day-picker/releases/tag/v10.0.0-next.1",
    });
  }) as jest.MockedFunction<NonNullable<CreateRelease>>;
});

function createReleaseContext(
  overrides: Partial<{
    repository: string;
    token: string;
    commitSha: string;
    packageVersion: string;
  }> = {},
) {
  return {
    repository: "gpbl/react-day-picker",
    token: "test-token",
    commitSha: "abc123",
    packageVersion: "10.0.0-next.1",
    ...overrides,
  };
}

function createReleasePayload(
  overrides: Partial<{
    html_url: string;
  }> = {},
) {
  return {
    html_url:
      "https://github.com/gpbl/react-day-picker/releases/tag/v10.0.0-next.1",
    ...overrides,
  };
}

describe("createGitHubRelease", function describeCreateGitHubRelease() {
  test("it reuses an existing release for the repo version", async function testExistingRelease() {
    await expect(
      createGitHubRelease(releaseContext, { fetchRelease, createRelease }),
    ).resolves.toEqual({
      created: false,
      release: createReleasePayload(),
      tag: "v10.0.0-next.1",
    });

    expect(createRelease).not.toHaveBeenCalled();
  });

  test("it creates the release when the tag does not exist yet", async function testCreateReleaseOn404() {
    fetchRelease.mockRejectedValue(
      Object.assign(new Error("GitHub Release v10.0.0-next.1 was not found."), {
        status: 404,
      }),
    );

    await expect(
      createGitHubRelease(releaseContext, { fetchRelease, createRelease }),
    ).resolves.toEqual({
      created: true,
      release: createReleasePayload(),
      tag: "v10.0.0-next.1",
    });

    expect(createRelease).toHaveBeenCalledWith({
      owner: "gpbl",
      repo: "react-day-picker",
      tag: "v10.0.0-next.1",
      token: "test-token",
      commitSha: "abc123",
      prerelease: true,
    });
  });

  test("it creates stable releases without the prerelease flag", async function testStableReleaseFlag() {
    releaseContext.packageVersion = "10.0.0";
    fetchRelease.mockRejectedValue(
      Object.assign(new Error("GitHub Release v10.0.0 was not found."), {
        status: 404,
      }),
    );

    await createGitHubRelease(releaseContext, { fetchRelease, createRelease });

    expect(createRelease).toHaveBeenCalledWith({
      owner: "gpbl",
      repo: "react-day-picker",
      tag: "v10.0.0",
      token: "test-token",
      commitSha: "abc123",
      prerelease: false,
    });
  });

  test("it rejects invalid repository values", async function testInvalidRepository() {
    releaseContext.repository = "react-day-picker";

    await expect(
      createGitHubRelease(releaseContext, { fetchRelease, createRelease }),
    ).rejects.toThrow("Invalid GITHUB_REPOSITORY value: react-day-picker");
  });

  test("it rethrows unexpected lookup failures", async function testUnexpectedLookupFailure() {
    fetchRelease.mockRejectedValue(new Error("network timeout"));

    await expect(
      createGitHubRelease(releaseContext, { fetchRelease, createRelease }),
    ).rejects.toThrow("network timeout");
  });
});
