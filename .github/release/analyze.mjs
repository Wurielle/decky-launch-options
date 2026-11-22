import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { analyzeCommits as conventionalAnalyzer } from "@semantic-release/commit-analyzer"

export async function analyzeCommits(config, context) {
  let commits = context.commits
  // Only stable releases ship both variants; prereleases retain regular analysis.
  if (context.branch.name === "main") {
    const options = {
      cwd: context.cwd,
      env: context.env,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 30000,
      maxBuffer: 16 * 1024 * 1024,
    }
    const lastTag = context.lastRelease.gitTag
    const refs = lastTag
      ? JSON.parse(
          execFileSync(
            "python3",
            [
              fileURLToPath(
                new URL("../scripts/changelog.py", import.meta.url),
              ),
              "HEAD",
              lastTag,
            ],
            options,
          ),
        )
      : { to: "origin/with-store" }
    // Exclude regular history and store commits included in the previous build.
    const fields = execFileSync(
      "git",
      [
        "log",
        "-z",
        "--format=%H%x00%B",
        refs.from ? `${refs.from}..${refs.to}` : refs.to,
        "--not",
        "HEAD",
      ],
      options,
    ).split("\0")
    const storeCommits = []
    for (let i = 0; i + 1 < fields.length; i += 2) {
      storeCommits.push({ hash: fields[i], message: fields[i + 1] })
    }
    context.logger.log(
      "Analyze %d unshipped store commits",
      storeCommits.length,
    )
    commits = [...commits, ...storeCommits]
  }
  return conventionalAnalyzer(config, { ...context, commits })
}
