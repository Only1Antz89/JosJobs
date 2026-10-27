"use client";

import { useEffect } from "react";

// Last-resort screen when the root layout itself fails, so it carries its own <html> and styles.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f14",
          color: "#e8edf2",
          fontFamily: "system-ui, sans-serif",
          padding: "24px"
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.7 }}>Athena Pro</p>
          <h1 style={{ fontSize: 32, margin: "16px 0" }}>Athena Pro is having trouble</h1>
          <p style={{ fontSize: 14, opacity: 0.8 }}>
            Please try again in a moment. If it keeps happening, email us and quote
            {error.digest ? ` reference ${error.digest}` : " what you were doing"}.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 20px",
              borderRadius: 999,
              border: 0,
              background: "#e8edf2",
              color: "#0b0f14",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
