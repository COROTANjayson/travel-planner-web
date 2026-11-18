/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const postcss = require("postcss");

const rootPath = path.resolve(__dirname, "..");
const cssPath = path.join(rootPath, "src/app/globals.css");
const root = postcss.parse(fs.readFileSync(cssPath, "utf8"));
const sources = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith(".tsx"))
      sources.set(file, fs.readFileSync(file, "utf8"));
  }
}
walk(path.join(rootPath, "src"));
const classes = new Map();
const removed = [];
for (const rule of root.nodes) {
  if (rule.type !== "rule") continue;
  const match = /^\.([a-z][\w-]*)\s+(>\s*)?([a-z.][\w.:-]*)$/.exec(
    rule.selector,
  );
  if (!match) continue;
  const [, anchor, child, target] = match;
  if (
    rule.nodes.some(
      (node) =>
        node.type !== "decl" ||
        node.important ||
        /[\[\]"'{}]/.test(node.value) ||
        node.value.includes("url("),
    )
  )
    continue;
  const inJSX = [...sources.values()].some((source) =>
    [...source.matchAll(/className="([^"]*)"/g)].some(([, value]) =>
      value.split(/\s+/).includes(anchor),
    ),
  );
  if (!inJSX) continue;
  const token = new RegExp(`(?<![\\w-])${anchor}(?![\\w-])`);
  if (
    [...sources.values()].some((source) =>
      source
        .split("\n")
        .some(
          (line) =>
            token.test(line) &&
            !line.includes("className=") &&
            !line.trimStart().startsWith("import "),
        ),
    )
  )
    continue;
  const variant = `[&${child ? ">" : "_"}${target}]:`;
  const group = classes.get(anchor) ?? new Map();
  for (const node of rule.nodes) {
    group.set(
      `${variant}${node.prop}`,
      `${variant}[${node.prop}:${node.value.replace(/\s+/g, "_")}]`,
    );
  }
  classes.set(anchor, group);
  removed.push(rule);
}

if (process.argv.includes("--complex")) {
  const breakpoint = new Map([
    ["640", "sm"],
    ["768", "md"],
    ["1024", "lg"],
    ["1280", "xl"],
  ]);

  function mediaVariant(rule) {
    if (rule.parent.type === "root") return "";
    if (rule.parent.type !== "atrule" || rule.parent.name !== "media")
      return null;
    const query = rule.parent.params.replace(/\s+/g, " ").trim();
    let match = /^\(width >= (\d+)px\)$/.exec(query);
    if (match) return `${breakpoint.get(match[1]) ?? `min-[${match[1]}px]`}:`;
    match = /^\(min-width: (\d+)px\)$/.exec(query);
    if (match) return `${breakpoint.get(match[1]) ?? `min-[${match[1]}px]`}:`;
    match = /^\(width < (\d+)px\)$/.exec(query);
    if (match)
      return `${breakpoint.get(match[1]) ? `max-${breakpoint.get(match[1])}` : `max-[${match[1]}px]`}:`;
    match = /^\(max-width: (\d+)px\)$/.exec(query);
    if (match) return `max-[${match[1]}px]:`;
    return null;
  }

  const complexRules = [];
  root.walkRules((rule) => {
    if (removed.includes(rule)) return;
    const media = mediaVariant(rule);
    if (media === null) return;
    if (
      rule.nodes.some(
        (node) =>
          node.type !== "decl" ||
          node.important ||
          node.value.includes("url(") ||
          node.prop === "content",
      )
    )
      return;

    const migrations = [];
    for (const rawSelector of rule.selectors) {
      const anchors = [...rawSelector.matchAll(/\.([a-z][\w-]*)/g)].map(
        (match) => match[1],
      );
      const anchor = anchors.find((name) =>
        [...sources.values()].some((source) =>
          [...source.matchAll(/className="([^"]*)"/g)].some(([, value]) =>
            value.split(/\s+/).includes(name),
          ),
        ),
      );
      if (!anchor) {
        migrations.length = 0;
        break;
      }
      const selector = rawSelector
        .replace(new RegExp(`\\.${anchor}(?![\\w-])`), "&")
        .replaceAll('"', "'")
        .replace(/\s+/g, "_");
      const group = classes.get(anchor) ?? new Map();
      for (const node of rule.nodes) {
        const value = node.value.replaceAll('"', "'").replace(/\s+/g, "_");
        const variant = `${media}[${selector}]:`;
        group.set(
          `${variant}${node.prop}`,
          `${variant}[${node.prop}:${value}]`,
        );
      }
      migrations.push([anchor, group]);
    }
    if (migrations.length !== rule.selectors.length) return;
    for (const [anchor, group] of migrations) classes.set(anchor, group);
    complexRules.push(rule);
  });
  removed.push(...complexRules);
}
if (process.argv.includes("--dry-run")) {
  console.log(removed.length, "rules", classes.size, "anchors");
  console.log(
    [...classes]
      .map(([name, group]) => `${name}: ${[...group.values()].join(" ")}`)
      .join("\n"),
  );
  process.exit(0);
}
for (const [file, source] of sources) {
  const changed = source.replace(/className="([^"]*)"/g, (whole, value) => {
    const tokens = value.split(/\s+/);
    const added = [...classes]
      .filter(([name]) => tokens.includes(name))
      .flatMap(([, group]) => [...group.values()]);
    return added.length ? `className="${value} ${added.join(" ")}"` : whole;
  });
  if (changed !== source) fs.writeFileSync(file, changed);
}
for (const rule of removed) rule.remove();
root.walkAtRules((rule) => {
  if (rule.nodes && !rule.nodes.length) rule.remove();
});
fs.writeFileSync(cssPath, root.toString());
console.log("Migrated", removed.length, "rules");
