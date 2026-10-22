import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  interactiveWidget: "resizes-content", themeColor: "#F7F7F2", colorScheme: "light",
};

export const metadata: Metadata = {
  title: "Travel Planner",
  description: "Plan trips together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
