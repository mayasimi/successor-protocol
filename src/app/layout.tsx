import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Successor Protocol",
  description: "Decentralized digital inheritance protocol",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <ThemeProvider>
            {children}
            <Toaster position="top-right" />
          </ThemeProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
