export const metadata = {
  title: 'Megadeals Imports',
  description: 'Live Preorder Store',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
