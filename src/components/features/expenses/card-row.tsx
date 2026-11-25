// One row of the activity expense card (Figma: infoRow). The card owns the
// border and dividers; callers render a ghost Button with `cardRowClass` and
// this content inside it.
export const cardRowClass =
  "h-auto min-h-11 w-full justify-between gap-3 rounded-none px-3.5 py-3 text-left font-normal whitespace-normal hover:text-foreground focus-visible:border-transparent focus-visible:ring-inset active:not-focus-visible:scale-100 sm:p-4";

// Title and detail text shared by the expense rows.
export const rowTitle =
  "text-[15px] leading-5 font-semibold sm:text-base sm:leading-[22px]";
export const rowDetail =
  "text-xs leading-4 text-muted-foreground sm:text-[13px] sm:leading-5";

export function CardRowContent({
  title,
  detail,
  value,
  status,
}: {
  title: string;
  detail: string;
  value?: string;
  status?: string;
}) {
  return (
    <>
      <span className="grid min-w-0 gap-0.5 [overflow-wrap:anywhere]">
        <span className={rowTitle}>{title}</span>
        <span className={rowDetail}>{detail}</span>
      </span>
      {value && (
        <span className="grid max-w-[50%] shrink-0 justify-items-end gap-0.5 text-right [overflow-wrap:anywhere]">
          <span className={`tabular-nums ${rowTitle}`}>{value}</span>
          {status && (
            <span className="text-[13px] leading-[21px] font-semibold text-muted-foreground">
              {status}
            </span>
          )}
        </span>
      )}
    </>
  );
}
