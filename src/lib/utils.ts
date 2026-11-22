export { cn } from "cn";

/** "1 task", "2 tasks": English plurals that only add an s. */
export const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;
