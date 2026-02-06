import { useAuth } from "./AuthProvider";

type SessionExpiryBannerProps = {
  onSignIn?: () => void;
};

export function SessionExpiryBanner({ onSignIn }: SessionExpiryBannerProps) {
  const { sessionExpired, dismissSessionExpired } = useAuth();

  if (!sessionExpired) {
    return null;
  }

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
      return;
    }
    const target = document.getElementById("google-login-area");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        background: "rgba(20, 20, 20, 0.92)",
        color: "#f5f5f5",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        padding: "8px 12px",
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "auto"
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 12 }}>
        Session expired. Please sign in again.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSignIn}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            cursor: "pointer"
          }}
        >
          Sign In
        </button>
        <button
          onClick={dismissSessionExpired}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#ddd",
            cursor: "pointer"
          }}
        >
          dismiss
        </button>
      </div>
    </div>
  );
}
