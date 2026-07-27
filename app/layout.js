import Script from 'next/script';

export const metadata = {
  title: 'Megadeals Store',
  description: 'Preorder Storefront',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://js.paystack.co/v1/inline.js"
          strategy="beforeInteractive"
        />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#09090b' }}>
        {children}
      </body>
    </html>
  );
}
