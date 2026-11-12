// Run against a local production server with a Playwright Page.
export default async function checkCssBrowser(
  page,
  baseURL = "http://localhost:3100",
) {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await page.emulateMedia({
    reducedMotion: "no-preference",
    contrast: "no-preference",
  });
  await page.goto(`${baseURL}/mobile-expenses-preview`);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Expenses overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .getByRole("button", { name: "Record money received:", exact: false })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const result = await dialog.evaluate((element) => {
      const input = element.querySelector("input");
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        right: rect.right,
        viewport: document.documentElement.clientWidth,
        scroll: element.scrollWidth,
        client: element.clientWidth,
        fontSize: parseFloat(getComputedStyle(input).fontSize),
      };
    });
    check(
      result.scroll <= result.client && result.right <= result.viewport + 1,
      `Repayment drawer overflows at ${width}px`,
    );
    check(
      result.fontSize === 60,
      `Repayment amount should be 60px, got ${result.fontSize}px at ${width}px`,
    );
    check(
      width >= 768
        ? Math.abs(result.width - 680) < 1
        : result.viewport - result.width >= 0 &&
            result.viewport - result.width <= 20,
      `Wrong drawer width at ${width}px`,
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
  const motion = await dialog.evaluate((element) => ({
    transition: getComputedStyle(element).transitionDuration,
    animation: getComputedStyle(element).animationDuration,
  }));
  check(
    motion.transition === "0s" && motion.animation === "0s",
    "Reduced motion must disable drawer transitions",
  );
  await page.keyboard.press("Tab");
  check(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
    "Keyboard focus escaped the drawer",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  const header = await page.locator(".app-topbar").evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    blur: getComputedStyle(element).backdropFilter,
  }));
  check(
    header.blur === "none" && header.background === "rgb(250, 252, 250)",
    "High contrast must use an opaque header",
  );
  await page.emulateMedia({
    reducedMotion: "no-preference",
    contrast: "no-preference",
  });
  await page.goto(baseURL);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Landing page overflows at ${width}px`,
    );
  }
  return "CSS browser checks passed: responsive layouts, repayment amount, drawer sizing, keyboard focus, reduced motion and high contrast.";
}
