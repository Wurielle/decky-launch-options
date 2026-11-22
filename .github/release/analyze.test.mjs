import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { analyzeCommits as conventionalAnalyzer } from "@semantic-release/commit-analyzer"

const root = new URL("../../", import.meta.url)
const config = JSON.parse(readFileSync(new URL(".releaserc.json", root)))
const customAnalyzer = config.plugins.find(
  (plugin) => plugin === "./.github/release/analyze.mjs",
)
const { analyzeCommits } = customAnalyzer
  ? await import(new URL(customAnalyzer, root))
  : { analyzeCommits: conventionalAnalyzer }

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "dlo-release-analysis-"))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const env = {
    PATH: process.env.PATH,
    HOME: cwd,
    TMPDIR: process.env.TMPDIR,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  }
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      env,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 10000,
    }).trim()
  const commit = (message) => {
    git("commit", "--allow-empty", "-m", message)
    return git("rev-parse", "HEAD")
  }
  git("init", "-b", "main")
  commit("feat: initial")
  git("tag", "v1.0.0")
  git("checkout", "-b", "with-store")
  commit("feat: already shipped store feature")
  git("checkout", "main")
  commit("fix: previous regular fix")
  git("tag", "v1.0.1")
  git("checkout", "with-store")
  git("merge", "--no-ff", "v1.0.1", "-m", "chore: merge v1.0.1 into with-store")
  const shipped = git("rev-parse", "HEAD")
  const analyze = async ({
    branch = "main",
    options = {},
    storeRef = true,
  } = {}) => {
    if (storeRef)
      git("update-ref", "refs/remotes/origin/with-store", "with-store")
    git("checkout", "main")
    const hashes = git("rev-list", "v1.0.1..HEAD").split("\n").filter(Boolean)
    const commits = hashes.map((hash) => ({
      hash,
      message: git("show", "-s", "--format=%B", hash),
    }))
    return analyzeCommits(options, {
      cwd,
      env,
      branch: { name: branch },
      lastRelease: { gitTag: "v1.0.1", gitHead: git("rev-parse", "v1.0.1") },
      commits,
      logger: { log() {} },
    })
  }
  return { cwd, env, git, commit, shipped, analyze }
}

test("store-only features trigger a shared minor release", async (t) => {
  const f = fixture(t)
  f.commit("feat(presets): add per-app presets")
  f.git("checkout", "main")
  f.commit("docs: update readme")
  assert.equal(await f.analyze(), "minor")
})

for (const [store, regular, expected] of [
  ["fix: store fix", "docs: regular notes", "patch"],
  ["feat: store feature", "fix: regular fix", "minor"],
  ["fix: store fix", "feat: regular feature", "minor"],
  [
    "feat: store feature",
    "feat: regular change\n\nBREAKING CHANGE: new format",
    "major",
  ],
  [
    "feat: store change\n\nBREAKING CHANGE: new format",
    "fix: regular fix",
    "major",
  ],
  ["docs: store notes", "ci: update checks", null],
]) {
  test(`shared analysis: ${store.split("\n")[0]} / ${regular.split("\n")[0]} => ${expected}`, async (t) => {
    const f = fixture(t)
    f.commit(store)
    f.git("checkout", "main")
    f.commit(regular)
    assert.equal(await f.analyze(), expected)
  })
}

test("already shipped store features do not cause another release", async (t) => {
  const f = fixture(t)
  assert.equal(await f.analyze(), null)
})

test("deleted release tags do not make store history unusable", async (t) => {
  const f = fixture(t)
  f.commit("feat: unshipped store feature")
  f.git("checkout", "main")
  f.commit("docs: regular notes")
  f.git("tag", "v1.1.0")
  f.git("checkout", "with-store")
  f.git(
    "merge",
    "--no-ff",
    "v1.1.0",
    "-m",
    "chore: merge v1.1.0 into with-store",
  )
  f.git("tag", "-d", "v1.1.0")
  assert.equal(await f.analyze(), "minor")
})

test("recreated tags cannot reuse a store merge for a different release commit", async (t) => {
  const f = fixture(t)
  f.commit("feat: unshipped store feature")
  f.git("checkout", "main")
  f.commit("docs: regular notes")
  f.git("tag", "v1.1.0")
  f.git("checkout", "with-store")
  f.git(
    "merge",
    "--no-ff",
    "v1.1.0",
    "-m",
    "chore: merge v1.1.0 into with-store",
  )
  const storeHead = f.commit("docs: later store notes")
  f.git("checkout", "main")
  f.commit("ci: repair release automation")
  f.git("tag", "-f", "v1.1.0")
  assert.equal(await f.analyze(), "minor")
  const refs = JSON.parse(
    execFileSync(
      "python3",
      [
        new URL(".github/scripts/changelog.py", root).pathname,
        "v1.1.0",
        "v1.0.1",
      ],
      {
        cwd: f.cwd,
        env: f.env,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 10000,
      },
    ),
  )
  assert.deepEqual(refs, { from: f.shipped, to: storeHead })
})

test("prereleases ignore store changes and do not require the store ref", async (t) => {
  const f = fixture(t)
  f.commit("feat: future store feature")
  f.git("checkout", "main")
  f.commit("fix: regular prerelease")
  for (const branch of ["alpha", "beta", "pre/rc"]) {
    assert.equal(await f.analyze({ branch, storeRef: false }), "patch")
  }
})

test("custom conventional release rules apply to both variants", async (t) => {
  const f = fixture(t)
  f.commit("chore: store maintenance")
  f.git("checkout", "main")
  f.commit("feat: ignored regular feature")
  assert.equal(
    await f.analyze({
      options: {
        releaseRules: [
          { type: "feat", release: false },
          { type: "chore", release: "patch" },
        ],
      },
    }),
    "patch",
  )
})

test("missing stable store history fails instead of silently releasing regular only", async (t) => {
  const f = fixture(t)
  f.git("checkout", "main")
  await f.analyze()
  f.git("update-ref", "-d", "refs/remotes/origin/with-store")
  await assert.rejects(() =>
    analyzeCommits(
      {},
      {
        cwd: f.cwd,
        env: f.env,
        branch: { name: "main" },
        lastRelease: { gitTag: "v1.0.1" },
        commits: [],
        logger: { log() {} },
      },
    ),
  )
})

const tagWorkflow = readFileSync(
  new URL(".github/workflows/tag-release.yml", root),
  "utf8",
)
function tagJobRuns(message) {
  const condition =
    tagWorkflow
      .split("  tag-release:\n")[1]
      .match(/^    if: (.+)$/m)?.[1]
      .replace(/^"|"$/g, "")
      .replace(/^\$\{\{\s*|\s*\}\}$/g, "") ?? "true"
  return new Function("github", "startsWith", `return (${condition})`)(
    { event: { head_commit: { message } } },
    (value, prefix) => value.startsWith(prefix),
  )
}

function versionCommit(version) {
  const template = tagWorkflow.match(/git commit -m "([^"]+)"/)?.[1]
  assert.ok(template, "generated version commit template exists")
  return template.replace(
    "${{ steps.semantic-release.outputs.new_release_version }}",
    version,
  )
}

test("the generated version push does not start another tag job", () => {
  assert.equal(tagJobRuns(versionCommit("1.18.0")), false)
})

test("ordinary release pushes remain eligible", () => {
  for (const message of [
    "Merge pull request #123 from Wurielle/dev\n\nrelease",
    "docs: update readme",
    "ci: repair release automation",
    "feat: regular feature",
    "fix: regular fix",
  ])
    assert.equal(tagJobRuns(message), true, message)
  assert.doesNotMatch(
    versionCommit("1.18.0"),
    /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]/i,
  )
})

test("real semantic-release reuses the shared version and stops after both variants ship", async (t) => {
  const f = fixture(t)
  f.commit("feat(presets): add per-app presets")
  f.git("checkout", "main")
  f.commit("docs: update readme")
  writeFileSync(
    join(f.cwd, "package.json"),
    JSON.stringify({
      name: "private-release-fixture",
      version: "1.0.1",
      private: true,
    }),
  )
  f.git("add", "package.json")
  f.git("commit", "-m", "chore: add package metadata")
  const remote = join(f.cwd, "remote.git")
  f.git("init", "--bare", "-b", "main", remote)
  f.git("remote", "add", "origin", remote)
  f.git("push", "origin", "main", "with-store", "--tags")
  const run = (dryRun) => {
    const plugins = config.plugins.map((plugin) => {
      if (typeof plugin === "string") return new URL(plugin, root).pathname
      return [new URL(import.meta.resolve(plugin[0])).pathname, plugin[1]]
    })
    const script = `
      import semanticRelease from ${JSON.stringify(import.meta.resolve("semantic-release"))};
      const result = await semanticRelease(${JSON.stringify({
        ...config,
        branches: ["main"],
        repositoryUrl: remote,
        plugins,
        dryRun,
        ci: false,
      })});
      console.log("RELEASE_RESULT=" + JSON.stringify(result ? result.nextRelease.version : null));
    `
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        cwd: f.cwd,
        env: f.env,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 30000,
      },
    )
    const match = output.match(/^RELEASE_RESULT=(.+)$/m)
    assert.ok(match, output)
    return JSON.parse(match[1])
  }
  const dispatchPush = () =>
    tagJobRuns(f.git("log", "-1", "--format=%B")) ? run(true) : null
  assert.equal(dispatchPush(), "1.1.0")
  assert.equal(f.git("tag", "--list", "v1.1.0"), "")
  writeFileSync(
    join(f.cwd, "package.json"),
    JSON.stringify({
      name: "private-release-fixture",
      version: "1.1.0",
      private: true,
    }),
  )
  f.git("add", "package.json")
  f.git("commit", "-m", versionCommit("1.1.0"))
  f.git("push", "origin", "main")
  // Deliver the new push while the parent run has not tagged or built yet.
  assert.equal(dispatchPush(), null)
  assert.equal(run(false), "1.1.0")
  // The store build is still pending even after the parent publishes its tag.
  assert.equal(dispatchPush(), null)
  assert.deepEqual(f.git("tag", "--list").split("\n"), [
    "v1.0.0",
    "v1.0.1",
    "v1.1.0",
  ])
  assert.equal(f.git("rev-parse", "v1.1.0"), f.git("rev-parse", "main"))
  f.git("checkout", "with-store")
  f.git(
    "merge",
    "--no-ff",
    "v1.1.0",
    "-m",
    "chore: merge v1.1.0 into with-store",
  )
  f.git("push", "origin", "with-store")
  f.git("checkout", "main")
  f.commit("docs: later documentation")
  f.git("push", "origin", "main")
  assert.equal(run(true), null)
})
