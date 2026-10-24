// Run with: node scripts/check-ui-contrast.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("src/app/globals.css", "utf8");
const lightTheme = css.match(/:root\s*\{([^}]+)\}/)[1];
const token = (name) => {
  const value = lightTheme.match(
    new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"),
  );
  assert.ok(value, `Expected a hex color for ${name}`);
  return value[1];
};
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function check(foreground, background, minimum = 4.5) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => a - b,
  );
  const ratio = (values[1] + 0.05) / (values[0] + 0.05);
  assert.ok(
    ratio >= minimum,
    `${foreground} on ${background}: ${ratio.toFixed(2)} < ${minimum}`,
  );
}
for (const background of [
  token("background"),
  "#ffffff",
  token("muted"),
  token("secondary"),
  token("accent"),
]) {
  check(token("foreground"), background);
  check(token("muted-foreground"), background);
  check(token("primary"), background);
  check(token("destructive"), background);
  check(token("ring"), background, 3);
  check(token("input"), background, 3);
}
check(token("primary-foreground"), token("primary"));
check(token("secondary-foreground"), token("secondary"));
check(token("accent-foreground"), token("accent"));
check(token("primary"), token("secondary"));
// Primary hover darkens toward the foreground rather than fading into the page.
const mix = (a, b, weight) =>
  "#" +
  a
    .slice(1)
    .match(/../g)
    .map((channel, index) =>
      Math.round(
        parseInt(channel, 16) * (1 - weight) +
          parseInt(b.slice(1 + index * 2, 3 + index * 2), 16) * weight,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
check(
  token("primary-foreground"),
  mix(token("primary"), token("foreground"), 0.12),
);
check(
  token("destructive"),
  mix(token("background"), token("destructive"), 0.1),
);
check(
  token("destructive"),
  mix(token("background"), token("destructive"), 0.2),
);
// The dock's 94% card material must stay readable even over black page content.
const dockMaterial = mix(token("card"), "#000000", 0.06);
check(token("muted-foreground"), dockMaterial);
check(token("primary"), dockMaterial);
check(token("ring"), dockMaterial, 3);
const ongoing = css.match(
  /\.trip-status\[data-status="Ongoing"\]\s*\{\s*background:\s*(#[0-9a-f]{6});\s*color:\s*(#[0-9a-f]{6})/i,
);
assert.ok(ongoing, "Expected explicit ongoing status colors");
check(ongoing[2], ongoing[1]);
const categoryBadges = [
  ...css.matchAll(
    /\.activity-category\[data-category="([^"]+)"\]\s*\{\s*background:\s*(#[0-9a-f]{6});\s*color:\s*(#[0-9a-f]{6})/gi,
  ),
];
assert.deepEqual(
  categoryBadges.map((badge) => badge[1]),
  ["Rest", "Eating", "Travel", "Activity"],
);
for (const badge of categoryBadges) check(badge[3], badge[2]);
console.log(
  "Light-theme text, input boundaries, and focus color contrast passed.",
);
