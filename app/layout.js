import Script from 'next/script';

export const metadata = {
  title: 'Megadeals Imports',
  description: 'Live Preorder Store',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '16px',
          paddingBottom: '90px',
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <Script
          src="https://js.paystack.co/v1/inline.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
