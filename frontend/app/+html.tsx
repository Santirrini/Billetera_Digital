import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0A0A0A" />
        <title>Billetera Digital</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <style dangerouslySetInnerHTML={{ __html: a11yStyles }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
        {children}
      </body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #0A0A0A;
  color: #F0EDE8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: light) {
  body {
    background-color: #F0EDE8;
    color: #0A0A0A;
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;

const a11yStyles = `
.skip-link {
  position: absolute;
  top: -100px;
  left: 8px;
  padding: 12px 16px;
  background: #F5A623;
  color: #0A0A0A;
  font-weight: 700;
  border-radius: 8px;
  z-index: 9999;
  text-decoration: none;
}
.skip-link:focus {
  top: 8px;
  outline: 3px solid #FFD470;
  outline-offset: 2px;
}
:focus-visible {
  outline: 2px solid #F5A623;
  outline-offset: 2px;
  border-radius: 4px;
}
@media (prefers-contrast: more) {
  body { background-color: #000; color: #fff; }
  a { text-decoration: underline; }
}
`;
