import { readFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

export const dataURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`

// Execute current production TypeScript with explicit host/rendering boundaries.
export async function sourceModule(name, boundaries = {}, cache = new Map()) {
  const file = path.resolve(name)
  if (cache.has(file)) return cache.get(file)
  let source = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  )
  const imports = parsed.statements
    .filter(ts.isImportDeclaration)
    .map((declaration) => declaration.moduleSpecifier.text)
  for (const from of new Set(imports)) {
    let to = boundaries[from]
    if (!to && from.startsWith(".")) {
      const base = path.resolve(path.dirname(file), from)
      for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
      ]) {
        try {
          await readFile(candidate)
          to = await sourceModule(candidate, boundaries, cache)
          break
        } catch (error) {
          if (!["ENOENT", "EISDIR"].includes(error.code)) throw error
        }
      }
      if (!to)
        throw new Error(`Unresolved production import ${from} in ${name}`)
    }
    to ??= import.meta.resolve(from)
    source = source.replaceAll(`"${from}"`, JSON.stringify(to))
  }
  const url = dataURL(source)
  cache.set(file, url)
  return url
}
