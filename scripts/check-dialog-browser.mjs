// Run with a Playwright Page against a running web app; no login or API writes.
export default async function checkDialogBrowser(
  page,
  baseURL = "http://localhost:3000",
) {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await page.goto(`${baseURL}/mobile-expenses-preview`);
  for (const [width, reduced] of [
    [1440, false],
    [390, false],
    [320, true],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.evaluate(() => {
      window.dialogMotion = [];
      window.recordDialogMotion = (event) => {
        if (!event.target.matches(".trip-dialog")) return;
        window.dialogMotion.push({
          ending: event.target.hasAttribute("data-ending-style"),
          property: event.propertyName,
          transforms: event.target
            .getAnimations()
            .flatMap((animation) =>
              animation.effect
                .getKeyframes()
                .flatMap((frame) => (frame.transform ? [frame.transform] : [])),
            ),
        });
      };
      document.addEventListener("transitionrun", window.recordDialogMotion);
    });
    const opener = page.getByRole("button", {
      name: "Balances and history",
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".trip-dialog")?.getAnimations().length === 0,
    );
    const sample = await dialog.evaluate((element) => ({
      rect: element.getBoundingClientRect().toJSON(),
      viewport: document.documentElement.clientWidth,
      transform: getComputedStyle(element).transform,
      duration: getComputedStyle(element).transitionDuration,
    }));
    check(sample.rect.right <= sample.viewport + 1, "Drawer overflows");
    check(
      sample.transform === "none",
      "Drawer never reached its resting place",
    );
    if (reduced) {
      check(
        sample.duration === "0.12s",
        "Reduced motion should keep a brief fade",
      );
      await page.keyboard.press("Escape");
    } else {
      await dialog.getByRole("button", { name: "Back to expenses" }).click();
    }
    await dialog.waitFor({ state: "detached" });
    const events = await page.evaluate(() => {
      document.removeEventListener("transitionrun", window.recordDialogMotion);
      return window.dialogMotion;
    });
    check(
      events.some((event) => !event.ending),
      "Missing entrance animation",
    );
    check(
      events.some((event) => event.ending),
      "Exit was cut off by unmounting",
    );
    if (reduced) {
      check(
        events.every((event) => event.property === "opacity"),
        "Reduced motion still slides",
      );
    } else {
      const path = width >= 768 ? "translateX(100%)" : "translateY(100%)";
      check(
        events.some((event) => event.transforms.includes(path)),
        "Wrong drawer direction",
      );
    }
    check(
      await opener.evaluate((element) => element === document.activeElement),
      "Focus did not return to the opener",
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Close dialog" }).click();
  await sheet.waitFor({ state: "detached" });
  check(
    await page
      .getByRole("button", { name: "Add", exact: true })
      .evaluate((element) => element === document.activeElement),
    "Menu sheet lost focus on close",
  );
  return "Drawer and menu-sheet motion, exit lifetime, reduced motion and focus passed.";
}
