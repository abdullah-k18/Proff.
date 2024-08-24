import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
          <title>Proff.</title>
          <link rel="shortcut icon" href="https://cdn-icons-png.flaticon.com/512/2956/2956794.png" type="image/x-icon" />
        </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
