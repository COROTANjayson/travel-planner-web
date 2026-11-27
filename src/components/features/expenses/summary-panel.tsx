/** Totals on the trip Expenses page: one set of cells per currency, never combined. */
export function SummaryPanel({
  label,
  tone,
  groups,
}: {
  label: string;
  tone: "sea" | "sand";
  groups: { currency: string; cells: [name: string, value: string][] }[];
}) {
  return (
    // Cells take a whole line rather than break a very large amount.
    <section
      aria-label={label}
      className={`grid gap-4 rounded-[16px] px-4 py-3.5 md:px-6 md:py-5 ${tone === "sea" ? "bg-[var(--trip-sea)]" : "bg-[var(--trip-sand)]"}`}
    >
      {groups.map(({ currency, cells }) => (
        <div key={currency} className="grid gap-2">
          {groups.length > 1 && (
            <p className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {currency}
            </p>
          )}
          <dl className="flex flex-wrap gap-x-4 gap-y-3">
            {cells.map(([name, value]) => (
              <div
                key={name}
                className="max-w-full flex-[1_1_calc(50%-0.5rem)] md:flex-[1_1_0]"
              >
                <dt className="text-xs leading-4 text-muted-foreground md:text-sm md:leading-5">
                  {name}
                </dt>
                <dd className="mt-0.5 text-[22px] leading-[30px] font-semibold tabular-nums [overflow-wrap:break-word]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
