// Shown inside the app shell while a page's data loads, so a click on the
// navigation responds at once instead of leaving the old page up.
export default function Loading() {
  return (
    <div
      role="status"
      className="muted mono"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
      }}
    >
      Loading…
    </div>
  );
}
