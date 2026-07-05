import './globals.css';

export const metadata = {
  title: 'WhatsApp Business Automation',
  description: 'Multi-device WhatsApp automation & chat platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
