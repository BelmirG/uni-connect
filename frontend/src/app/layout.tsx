import type { Metadata } from "next";
import NavBar from "@/components/NavBar";

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
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", paddingBottom: 65 }}>
        {children}
        <NavBar />
      </body>
    </html>
  );
}
