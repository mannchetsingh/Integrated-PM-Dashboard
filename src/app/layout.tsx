import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Project Hub",
    template: "%s · Project Hub",
  },
  description:
    "One place for your projects, tasks, meeting minutes and writing — with an assistant that knows all of it.",
};

export const viewport: Viewport = {
  themeColor: "#090c13",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
