import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "IUSConnect",
  description: "Campus social network for IUS students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="pb-16">
        {children}
        <NavBar />
      </body>
    </html>
  );
}
