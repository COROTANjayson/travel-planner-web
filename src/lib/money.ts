export const maxMinor = 9223372036854775807n;

export function parseMoney(text: string, decimals: number): string {
  const value = text.trim();
  // Only well-formed thousands groups, so "1,50" is rejected rather than read as 150.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?$/.test(value))
    throw new Error("Enter an amount using digits and a decimal point.");
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  if (fraction.length > decimals)
    throw new Error(`This currency allows ${decimals} decimal places.`);
  const minor =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (minor > maxMinor) throw new Error("This amount is too large.");
  return minor.toString();
}

export function moneyInput(minor: string, decimals: number): string {
  const value = BigInt(minor);
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value)
    .toString()
    .padStart(decimals + 1, "0");
  return decimals
    ? `${sign}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`
    : `${sign}${digits}`;
}

export function formatMoney(
  minor: string,
  currency: { code: string; decimals: number },
): string {
  const [whole, fraction] = moneyInput(minor, currency.decimals).split(".");
  const negative = whole.startsWith("-");
  const grouped = new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(BigInt(whole.replace("-", "")));
  return `${currency.code} ${negative ? "-" : ""}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

export function equalShares(amount: string, ids: number[]) {
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error("Choose travelers for the split.");
  const total = BigInt(amount),
    count = BigInt(ids.length);
  if (total <= 0n || total > maxMinor)
    throw new Error("Enter a positive expense amount.");
  return [...ids]
    .sort((a, b) => a - b)
    .map((user_id, index) => ({
      user_id,
      amount_minor: (
        total / count +
        (BigInt(index) < total % count ? 1n : 0n)
      ).toString(),
    }));
}

export function expenseMoney(
  minor: string,
  currency: { code: string; decimals: number },
) {
  const text = formatMoney(minor, currency);
  const trimmed =
    currency.decimals && BigInt(minor) % 10n ** BigInt(currency.decimals) === 0n
      ? text.slice(0, -currency.decimals - 1)
      : text;
  return currency.code === "PHP" ? trimmed.replace(/^PHP /, "₱") : trimmed;
}

/** Formats amounts in any of `currencies`; an unknown code falls back to 2 decimals. */
export const moneyIn =
  (currencies: { code: string; decimals: number }[]) =>
  (amount: string | bigint, code: string) =>
    expenseMoney(
      String(amount),
      currencies.find((c) => c.code === code) ?? { code, decimals: 2 },
    );
