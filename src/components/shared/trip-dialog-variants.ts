export type TripDialogVariant = "reference" | "planning" | "expense";

// Class names are written out in full: Tailwind only generates classes it can
// find as literal strings in the source.
const nav =
  "relative m-0 min-h-[60px] overflow-hidden border-b-0 px-6 py-2 [scrollbar-gutter:stable] after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-border after:content-[''] **:data-[slot=button]:min-h-11 **:data-[slot=button]:rounded-none **:data-[slot=button]:border-0 **:data-[slot=button]:bg-transparent **:data-[slot=button]:p-0 **:data-[slot=button]:text-sm **:data-[slot=button]:font-bold **:data-[slot=button]:text-primary **:data-[slot=button]:shadow-none **:data-[slot=button]:hover:bg-transparent **:data-[slot=button]:hover:text-primary **:data-[slot=button]:focus-visible:ring-0";
const referenceHeader =
  "pt-[30px] pb-[18px] [&_h2+button]:mt-2.5 [&_h2]:mx-0 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:max-w-[20ch] [&_h2]:text-[30px] [&_h2]:leading-10 [&_h2]:font-bold [&_h2]:tracking-normal [&_h2]:text-balance";
const referenceFooter =
  "overflow-hidden bg-background px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-gutter:stable] **:data-[slot=button]:min-h-11 **:data-[slot=button]:px-3.5 **:data-[slot=button]:py-2";
const detailBody =
  "overflow-visible px-6 pt-0 pb-6 has-[>.activity-form]:pb-6 has-[>.ledger-form]:pb-6";

export const tripDialogVariants: Record<
  TripDialogVariant,
  { nav: string; header: string; body: string; reader: string; footer: string }
> = {
  reference: {
    nav,
    header: referenceHeader,
    body: detailBody,
    reader: "[scrollbar-gutter:stable]",
    footer: referenceFooter,
  },
  planning: {
    nav,
    header:
      "pt-[30px] pb-[18px] [&_h2+button]:mt-2.5 [&_h2]:mx-0 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:max-w-[20ch] [&_h2]:text-[30px] [&_h2]:leading-10 [&_h2]:font-bold [&_h2]:tracking-normal [&_h2]:text-balance pt-4 [&_h2]:mt-0",
    body: "flex flex-1 flex-col overflow-visible px-6 pt-0 pb-0 has-[>.activity-form]:pb-0 has-[>.ledger-form]:pb-0",
    reader: "flex flex-col [scrollbar-gutter:stable]",
    footer: referenceFooter,
  },
  expense: {
    nav,
    header:
      "pt-6 pb-[22px] not-has-[p]:pb-4 has-[p]:[&_h2]:mb-1.5 [&_h2]:m-0 [&_h2]:max-w-none [&_h2]:text-[25px] [&_h2]:leading-8 [&_h2]:font-bold [&_h2]:tracking-normal [&_h2]:text-balance",
    body: detailBody,
    reader: "[scrollbar-gutter:stable]",
    footer:
      "overflow-hidden border-0 bg-background px-6 pt-3 pb-[22px] [scrollbar-gutter:stable] **:data-[slot=button]:min-h-12 **:data-[slot=button]:justify-start **:data-[slot=button]:px-4 **:data-[slot=button]:py-3 **:data-[slot=button]:text-sm **:data-[slot=button]:font-bold",
  },
};

// Sticky fade above the pinned footer (reference and planning only).
export const readerFooterFade =
  "after:pointer-events-none after:sticky after:bottom-0 after:-mt-6 after:block after:h-6 after:bg-[linear-gradient(to_bottom,transparent,var(--background))] after:content-['']";

// Finance sub-views restyle the activity drawer header (pass as headerClassName).
export const financeTabsHeader =
  "pt-6 pb-4 [&_h2]:mt-0 [&_h2]:mb-1 [&_h2]:text-[26px] [&_h2]:leading-[34px]";
export const financeLoansHeader =
  "pt-5 pb-3 [&>div]:grid [&>div]:gap-1 [&>div>*]:m-0 [&_h2]:m-0 [&_h2]:text-[26px] [&_h2]:leading-[34px] [&_p]:leading-[22px]";

// Repayment drawer overrides on top of the expense variant.
export const repaymentSlots = {
  header:
    "not-has-[p]:pb-2 [&>div]:mx-auto [&>div]:max-w-lg [&_h2]:text-2xl [&_h2]:leading-[1.3] [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] max-md:not-has-[p]:px-4 max-md:not-has-[p]:pt-4 max-md:not-has-[p]:pb-2 max-md:[&_h2]:text-[1.375rem]",
  body: "pt-3 max-md:px-4 max-md:pb-0 max-md:has-[>.activity-form]:pb-0 max-md:has-[>.ledger-form]:pb-0",
  nav: "max-md:px-4 max-md:after:inset-x-4",
};
