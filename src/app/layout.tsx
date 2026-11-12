import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import localFont from "next/font/local";

const manrope = localFont({
  src: "./fonts/Manrope.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#FAFCFA",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: "Travel Planner",
  description: "Plan trips together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased font-sans [-webkit-text-size-adjust:100%] [-webkit-tap-highlight-color:transparent] scroll-pt-32 [:where(&_summary)]:min-h-11 [:where(&_button)]:[touch-action:manipulation] [:where(&_a)]:[touch-action:manipulation] [:where(&_summary)]:[touch-action:manipulation] [:where(&_[role="button"])]:[touch-action:manipulation] [:where(&_button)]:[-webkit-user-select:none] [:where(&_button)]:[user-select:none] [:where(&_summary)]:[-webkit-user-select:none] [:where(&_summary)]:[user-select:none] [:where(&_[role="button"])]:[-webkit-user-select:none] [:where(&_[role="button"])]:[user-select:none] [:where(&_input)]:[font-size:1rem] [:where(&_textarea)]:[font-size:1rem] [:where(&_select)]:[font-size:1rem] [:where(&_input)]:[caret-color:var(--primary)] [:where(&_textarea)]:[caret-color:var(--primary)] [:where(&_::selection)]:[background:var(--secondary)] [:where(&_::selection)]:[color:var(--foreground)] [:where(&_a)]:[text-underline-offset:0.2em] [:where(&_h1)]:[overflow-wrap:anywhere] [:where(&_h2)]:[overflow-wrap:anywhere] [:where(&_h3)]:[overflow-wrap:anywhere] [:where(&_h4)]:[overflow-wrap:anywhere] [:where(&_p)]:[overflow-wrap:anywhere] [:where(&_label)]:[overflow-wrap:anywhere] [&_summary:focus-visible]:[outline:2px_solid_var(--ring)] [&_summary:focus-visible]:[outline-offset:2px] [&_summary:focus-visible]:[border-radius:0.5rem] [&_.maplibregl-popup-content]:[color:#24272b] [&_.maplibregl-popup-content]:[font:0.875rem/1.5_system-ui,sans-serif] [&_.maplibregl-popup-content]:[border-radius:0.75rem] [&_.maplibregl-popup-close-button]:[min-width:44px] [&_.maplibregl-popup-close-button]:[min-height:44px] [&_.maplibregl-popup-content:has(.maplibregl-popup-close-button)]:[padding-right:44px] [&_.maplibregl-popup-close-button:focus-visible]:[outline:2px_solid_var(--ring)] [&_.maplibregl-popup-close-button:focus-visible]:[outline-offset:-2px] [@supports(backdrop-filter:_blur(12px))]:[&_.app-topbar]:[background:color-mix(in_srgb,_var(--background)_94%,_transparent)] [@supports(backdrop-filter:_blur(12px))]:[&_.app-topbar]:[backdrop-filter:blur(12px)] [@supports(backdrop-filter:_blur(12px))]:[&_.mobile-trip-header]:[background:color-mix(in_srgb,_var(--background)_94%,_transparent)] [@supports(backdrop-filter:_blur(12px))]:[&_.mobile-trip-header]:[backdrop-filter:blur(12px)] [@media(prefers-reduced-transparency:_reduce),_(prefers-contrast:_more)]:[&_.app-topbar]:[background:var(--background)]! [@media(prefers-reduced-transparency:_reduce),_(prefers-contrast:_more)]:[&_.app-topbar]:[backdrop-filter:none]! [@media(prefers-reduced-transparency:_reduce),_(prefers-contrast:_more)]:[&_.mobile-bottom-nav]:[backdrop-filter:none]! [@media(prefers-reduced-transparency:_reduce),_(prefers-contrast:_more)]:[&_.mobile-trip-header]:[background:var(--background)]! [@media(prefers-reduced-transparency:_reduce),_(prefers-contrast:_more)]:[&_.mobile-trip-header]:[backdrop-filter:none]! [@media(prefers-reduced-transparency:_reduce),_(prefers-contrast:_more)]:[&_.mobile-bottom-nav]:[background:var(--ocean)]! [@media(prefers-reduced-motion:_reduce)]:[&_*]:[scroll-behavior:auto]! [@media(prefers-reduced-motion:_reduce)]:[&_*]:[animation-duration:0s]! [@media(prefers-reduced-motion:_reduce)]:[&_*]:[transition-duration:0s]! [@media(prefers-reduced-motion:_reduce)]:[&_*::before]:[scroll-behavior:auto]! [@media(prefers-reduced-motion:_reduce)]:[&_*::before]:[animation-duration:0s]! [@media(prefers-reduced-motion:_reduce)]:[&_*::before]:[transition-duration:0s]! [@media(prefers-reduced-motion:_reduce)]:[&_*::after]:[scroll-behavior:auto]! [@media(prefers-reduced-motion:_reduce)]:[&_*::after]:[animation-duration:0s]! [@media(prefers-reduced-motion:_reduce)]:[&_*::after]:[transition-duration:0s]!`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground text-base leading-6">
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          offset={24}
          mobileOffset={{
            top: "calc(env(safe-area-inset-top, 0px) + 64px)",
            left: 16,
            right: 16,
          }}
          toastOptions={{
            style: {
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            },
          }}
        />
      </body>
    </html>
  );
}
