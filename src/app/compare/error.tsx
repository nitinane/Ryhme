"use client";

export default function ComparisonError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="frame page"><h1>Comparison unavailable</h1>
    <p className="muted my-4" role="alert">The selected models could not be loaded.</p>
    <button className="button" type="button" onClick={reset}>Try again</button>
  </main>;
}
