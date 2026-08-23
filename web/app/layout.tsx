import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";
import { QueryProvider } from "../components/providers/query-provider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Docsy — turn your docs into a support agent",
  description:
    "Upload your documentation and get a chatbot that answers your customers — in your app and as an embeddable widget.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={plusJakartaSans.variable}>
        <body>
          <QueryProvider>{children}</QueryProvider>
          <Toaster
            theme="light"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "app-toast",
                success: "app-toast-success",
                error: "app-toast-error",
                loading: "app-toast-loading",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
