export default function AttestationsPage() {
  const attestations = [
    {
      icon: "🔗",
      label: "Successor Contract Deployed",
      hash: "0x8f3a...f2a",
    },
    { icon: "✅", label: "Next of Kin Confirmed", hash: "0xdef...789" },
    { icon: "📦", label: "Will Stored on 0G Storage", hash: "zg://will/0xabc" },
    { icon: "❤️", label: "Heartbeat Recorded", hash: "0x789...123" },
  ];

  return (
    <div>
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Attestation Ledger
        </h3>
        {attestations.map((a) => (
          <div
            key={a.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 0",
              borderBottom: "1px solid #1E1E24",
              fontSize: "0.85rem",
              color: "#ccc",
            }}
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
            <span
              style={{
                marginLeft: "auto",
                color: "#D4AF37",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {a.hash} 🔗
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
