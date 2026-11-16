import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "پلک — استودیو خوشنویسی ایرانی",
  description:
    "استودیو خوشنویسی پلک: ویرایش واژه/حرف، کشیده، علامت‌ها و تاریخچهٔ کامل — با فونت‌های خوشنویسی فارسی و عربی.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-vazir">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
