import "./globals.css";

export const metadata = {
  title: "Kehoes Voting",
  description: "Live voting + TV display"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
