// Shared loader for the regression scripts. Each source file runs in its own VM
// context. Imports listed in `mocks` win; any other local import (`@/...`, `./...`)
// is loaded from disk with the same mocks, so splitting a component needs no new
// mock entry.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const autoLoaded = new WeakSet();

function localFile(id, importer) {
  const base = id.startsWith("@/")
    ? path.join("src", id.slice(2))
    : id.startsWith(".")
      ? path.join(path.dirname(importer), id)
      : null;
  if (!base) return null;
  return [`${base}.tsx`, `${base}.ts`].find((file) => fs.existsSync(file));
}

// Tree walkers step into these so a control extracted into a child stays findable.
// A file passed directly to load() is not included: tests treat that as a unit and
// often hand its exports back in as mocks.
export const isAutoLoaded = (type) =>
  typeof type === "function" && autoLoaded.has(type);

export function createLoader({
  compilerOptions = {},
  globals = {},
  mocks: sharedMocks = {},
} = {}) {
  return function load(file, mocks = {}, extraGlobals = {}) {
    const allMocks = { ...sharedMocks, ...mocks };
    const loaded = new Map();
    function run(current, auto) {
      if (loaded.has(current)) return loaded.get(current);
      const exports = {};
      loaded.set(current, exports);
      const { outputText } = ts.transpileModule(
        fs.readFileSync(current, "utf8"),
        {
          fileName: current,
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.CommonJS,
            ...compilerOptions,
          },
        },
      );
      vm.runInNewContext(outputText, {
        exports,
        require: (id) => {
          if (allMocks[id]) return allMocks[id];
          const local = localFile(id, current);
          return local ? run(path.normalize(local), true) : nodeRequire(id);
        },
        ...globals,
        ...extraGlobals,
      });
      if (auto)
        for (const value of Object.values(exports))
          if (typeof value === "function") autoLoaded.add(value);
      return exports;
    }
    return run(path.normalize(file), false);
  };
}
