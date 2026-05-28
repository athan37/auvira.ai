import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Houston HVAC Pros',
  description: 'Fixture workspace for Website Agent V2 planner tests',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
