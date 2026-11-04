import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACRN Studios | Creator Dashboard",
  description: "Private game operations dashboard for ACRN Studios."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}