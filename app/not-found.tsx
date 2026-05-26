import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
        <p className="eyebrow">404</p>
        <h1>Case not found</h1>
        <p className="lede" style={{ margin: "0 auto" }}>
          The page or case id you requested does not exist. It may have been
          archived per the data retention policy or never created.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link className="button" href="/">Back to queue</Link>
          <Link className="ghost-button" href="/audit">View audit log</Link>
        </div>
      </div>
    </main>
  );
}
