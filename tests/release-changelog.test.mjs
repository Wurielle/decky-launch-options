import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { setTimeout } from "node:timers/promises"

const root = new URL("../", import.meta.url)
const workflow = readFileSync(
  new URL(".github/workflows/release.yml", root),
  "utf8",
)

function storeFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "dlo-store-merge-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const remote = join(directory, "remote.git")
  const source = join(directory, "source")
  const runner = join(directory, "runner")
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_AUTHOR_DATE: "2025-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2025-01-01T00:00:00Z",
  }
  const git = (cwd, ...args) =>
    execFileSync("git", args, {
      cwd,
      env,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 10000,
    }).trim()
  const commit = (name, contents, message) => {
    writeFileSync(join(source, name), contents)
    git(source, "add", name)
    git(source, "commit", "-m", message)
    return git(source, "rev-parse", "HEAD")
  }
  git(directory, "init", "--bare", "-b", "main", remote)
  git(directory, "init", "-b", "main", source)
  commit("regular.txt", "initial\n", "feat: initial")
  git(source, "tag", "v1.0.0")
  git(source, "checkout", "-b", "with-store")
  const pin = commit("store.txt", "pinned store\n", "feat: store feature")
  git(source, "checkout", "main")
  const release = commit("regular.txt", "released\n", "fix: regular fix")
  git(source, "tag", "v1.0.1")
  git(source, "remote", "add", "origin", remote)
  git(source, "push", "origin", "main", "with-store", "--tags")
  git(directory, "clone", remote, runner)
  const run = workflow.match(
    /      - name: Merge released main commit into store branch[\s\S]*?        run: \|\n([\s\S]*?)\n      - name:/,
  )?.[1]
  assert.ok(run, "store merge shell exists")
  const merge = (sha = pin, date = "2025-01-02T00:00:00Z") => {
    git(runner, "checkout", "--detach", sha)
    const result = spawnSync(
      "bash",
      [
        "--noprofile",
        "--norc",
        "-e",
        "-o",
        "pipefail",
        "-c",
        run.replace(/^          /gm, ""),
      ],
      {
        cwd: runner,
        env: {
          ...env,
          RELEASE_TAG: "v1.0.1",
          GIT_COMMITTER_DATE: date,
          GIT_TRACE: "1",
        },
        encoding: "utf8",
        timeout: 10000,
      },
    )
    assert.ifError(result.error)
    return result
  }
  const remoteHead = () => git(remote, "rev-parse", "refs/heads/with-store")
  const head = () => git(runner, "rev-parse", "HEAD")
  const assertSuccess = (result) =>
    assert.equal(result.status, 0, result.stdout + result.stderr)
  const assertReused = (result, sha) => {
    assertSuccess(result)
    assert.equal(
      head(),
      sha,
      "build must use the exact published release merge",
    )
    assert.equal(git(runner, "rev-parse", "--abbrev-ref", "HEAD"), "HEAD")
    assert.doesNotMatch(
      result.stderr,
      /built-in: git push /,
      "reuse must not push",
    )
  }
  return {
    git,
    source,
    runner,
    remote,
    pin,
    release,
    merge,
    remoteHead,
    head,
    assertSuccess,
    assertReused,
    commit,
  }
}

test("store merge publishes the first release from the exact pin", (t) => {
  const fixture = storeFixture(t)
  const result = fixture.merge()
  fixture.assertSuccess(result)
  const merged = fixture.head()
  assert.equal(fixture.remoteHead(), merged)
  assert.equal(fixture.git(fixture.runner, "rev-parse", "HEAD^1"), fixture.pin)
  assert.equal(
    fixture.git(fixture.runner, "rev-parse", "HEAD^2"),
    fixture.release,
  )
  assert.equal(
    fixture.git(fixture.runner, "log", "-1", "--format=%s"),
    "chore: merge v1.0.1 into with-store",
  )
  assert.match(result.stderr, /built-in: git push origin HEAD:with-store/)
  t.diagnostic(
    JSON.stringify({
      case: "first release",
      pin: fixture.pin,
      build: merged,
      remote: fixture.remoteHead(),
    }),
  )
})

test("store merge reuses the published merge on a delayed failed-job retry", async (t) => {
  const fixture = storeFixture(t)
  fixture.assertSuccess(fixture.merge())
  const published = fixture.remoteHead()
  await setTimeout(1100)
  const result = fixture.merge(fixture.pin, "2025-01-03T00:00:00Z")
  fixture.assertReused(result, published)
  assert.equal(
    fixture.remoteHead(),
    published,
    "retry must not rewrite the branch",
  )
  t.diagnostic(
    JSON.stringify({
      case: "delayed failed-job retry",
      pin: fixture.pin,
      build: fixture.head(),
      remote: fixture.remoteHead(),
      published,
    }),
  )
})

test("store merge builds the old completed release despite newer remote store work", (t) => {
  const fixture = storeFixture(t)
  fixture.assertSuccess(fixture.merge())
  const published = fixture.remoteHead()
  fixture.git(fixture.source, "fetch", "origin")
  fixture.git(
    fixture.source,
    "checkout",
    "-B",
    "with-store",
    "origin/with-store",
  )
  const newer = fixture.commit(
    "store.txt",
    "future store\n",
    "feat: future store work",
  )
  fixture.git(fixture.source, "push", "origin", "with-store")

  const result = fixture.merge(published, "2025-01-04T00:00:00Z")
  fixture.assertReused(result, published)
  assert.equal(
    fixture.remoteHead(),
    newer,
    "rerun must preserve newer remote work",
  )
  assert.equal(
    readFileSync(join(fixture.runner, "store.txt"), "utf8"),
    "pinned store\n",
  )
  assert.equal(
    readFileSync(join(fixture.runner, "regular.txt"), "utf8"),
    "released\n",
  )
  t.diagnostic(
    JSON.stringify({
      case: "old completed release with newer work",
      pin: published,
      build: fixture.head(),
      remote: fixture.remoteHead(),
      newer,
    }),
  )

  const retry = fixture.merge(fixture.pin, "2025-01-05T00:00:00Z")
  fixture.assertReused(retry, published)
  assert.equal(
    fixture.remoteHead(),
    newer,
    "failed-job retry must also preserve newer work",
  )
  t.diagnostic(
    JSON.stringify({
      case: "failed-job retry with newer work",
      pin: fixture.pin,
      build: fixture.head(),
      remote: fixture.remoteHead(),
      published,
      newer,
    }),
  )
})

test("store merge refuses branch movement before the initial merge without publishing", (t) => {
  const fixture = storeFixture(t)
  fixture.git(fixture.source, "checkout", "with-store")
  const newer = fixture.commit(
    "store.txt",
    "future store\n",
    "feat: concurrent store work",
  )
  fixture.git(fixture.source, "push", "origin", "with-store")

  const result = fixture.merge()
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.equal(
    fixture.remoteHead(),
    newer,
    "refusal must preserve newer remote work",
  )
  assert.equal(
    fixture.head(),
    fixture.pin,
    "refusal must not create a sibling merge",
  )
  assert.match(result.stderr, /with-store advanced.*rerun the whole workflow/i)
  assert.doesNotMatch(result.stderr, /built-in: git (merge --no-ff|push) /)
  t.diagnostic(
    JSON.stringify({
      case: "branch moved before initial merge",
      pin: fixture.pin,
      build: fixture.head(),
      remote: fixture.remoteHead(),
      newer,
      exit: result.status,
    }),
  )
})

test("store merge rejects a race after the freshness check with a non-force push", (t) => {
  const fixture = storeFixture(t)
  fixture.git(fixture.source, "checkout", "with-store")
  const newer = fixture.commit(
    "store.txt",
    "racing store\n",
    "feat: racing store work",
  )
  // Publish the object without moving with-store until the merge hook runs.
  fixture.git(fixture.source, "push", "origin", "HEAD:refs/heads/race-fixture")
  writeFileSync(
    join(fixture.runner, ".git/hooks/pre-merge-commit"),
    `#!/bin/sh\nexec git --git-dir="${fixture.remote}" update-ref refs/heads/with-store ${newer}\n`,
    { mode: 0o755 },
  )

  const result = fixture.merge()
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /\[rejected\].*HEAD -> with-store/)
  assert.equal(
    fixture.remoteHead(),
    newer,
    "non-force push must preserve the racing commit",
  )
  assert.equal(fixture.git(fixture.runner, "rev-parse", "HEAD^1"), fixture.pin)
  assert.match(result.stderr, /built-in: git push origin HEAD:with-store/)
  t.diagnostic(
    JSON.stringify({
      case: "race after freshness check",
      pin: fixture.pin,
      build: fixture.head(),
      remote: fixture.remoteHead(),
      newer,
      exit: result.status,
    }),
  )
})

test("store ranges use the previous store build and stay pinned on reruns", () => {
  const directory = mkdtempSync(join(tmpdir(), "dlo-changelog-"))
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim()
  try {
    git("init", "-b", "main")
    git("config", "user.name", "Test")
    git("config", "user.email", "test@example.invalid")
    git("commit", "--allow-empty", "-m", "feat: initial")
    git("tag", "v1.0.0")
    git("checkout", "-b", "with-store")
    git("commit", "--allow-empty", "-m", "feat: old store feature")
    git("checkout", "main")
    git("commit", "--allow-empty", "-m", "fix: regular fix")
    git("tag", "v1.0.1")
    git("checkout", "with-store")
    git(
      "merge",
      "--no-ff",
      "v1.0.1",
      "-m",
      "chore: merge v1.0.1 into with-store",
    )
    const previousStore = git("rev-parse", "HEAD")
    git("commit", "--allow-empty", "-m", "feat: new store feature")
    const storeHead = git("rev-parse", "HEAD")
    git("checkout", "main")
    git("commit", "--allow-empty", "-m", "chore: release")
    git("tag", "v1.1.0")
    git("update-ref", "refs/remotes/origin/with-store", storeHead)
    const prepare = () =>
      JSON.parse(
        execFileSync(
          "python3",
          [
            new URL(".github/scripts/changelog.py", root).pathname,
            "v1.1.0",
            "v1.0.1",
          ],
          { cwd: directory, encoding: "utf8" },
        ),
      )
    assert.deepEqual(prepare(), { from: previousStore, to: storeHead })
    mkdirSync(join(directory, ".github/scripts"), { recursive: true })
    for (const path of [
      ".github/scripts/changelog.py",
      "changelog.config.json",
    ]) {
      copyFileSync(new URL(path, root), join(directory, path))
    }
    const run = workflow.match(
      /      - name: Resolve changelog ranges[\s\S]*?        run: \|\n([\s\S]*?)\n      - name:/,
    )?.[1]
    assert.ok(run, "range preparation step exists")
    execFileSync("bash", ["-e", "-c", run.replace(/^          /gm, "")], {
      cwd: directory,
      env: {
        ...process.env,
        RELEASE_TAG: "v1.1.0",
        RUNNER_TEMP: directory,
        GITHUB_OUTPUT: join(directory, "outputs"),
      },
    })
    const outputs = Object.fromEntries(
      readFileSync(join(directory, "outputs"), "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    )
    assert.equal(outputs.from, previousStore)
    assert.equal(outputs.to, storeHead)
    const config = JSON.parse(readFileSync(outputs.configuration, "utf8"))
    const regular = JSON.parse(
      readFileSync(new URL("changelog.config.json", root), "utf8"),
    )
    assert.deepEqual(config, { ...regular, base_branches: ["^with-store$"] })
    assert.ok(regular.categories.every(({ title }) => title.startsWith("### ")))
    assert.ok(
      regular.base_branches.every(
        (branch) => !new RegExp(branch).test("with-store"),
      ),
    )
    git("checkout", "with-store")
    git(
      "merge",
      "--no-ff",
      "v1.1.0",
      "-m",
      "chore: merge v1.1.0 into with-store",
    )
    const releasedStore = git("rev-parse", "HEAD")
    git("commit", "--allow-empty", "-m", "feat: future store feature")
    git("update-ref", "refs/remotes/origin/with-store", "HEAD")
    assert.deepEqual(prepare(), { from: previousStore, to: releasedStore })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("release notes retain both ordered variant sections with empty regular notes", () => {
  const body = workflow.match(
    /          body: \|\n([\s\S]*?)          token:/,
  )?.[1]
  assert.ok(body)
  const rendered = body.replace(
    "${{ steps.github_release.outputs.changelog }}",
    "- No changes",
  )
  assert.match(rendered, /## Regular\n\n\s+- No changes[\s\S]*## With store/)
  assert.match(rendered, /\$\{\{ steps.store_changelog.outputs.changelog \}\}/)
})
