import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth/AuthProvider";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function GoogleLoginButton() {
  const [status, setStatus] = useState<string>("not logged in yet");
  const { user, loading, refreshMe, logout } = useAuth();

  return (
    <div id="google-login-area" style={{ display: "grid", gap: 8 }}>
      {loading ? <div>checking session...</div> : null}

      {!loading && user ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user.picture ? (
            <img
              src={user.picture}
              alt="avatar"
              style={{ width: 24, height: 24, borderRadius: 12 }}
            />
          ) : null}
          <div>
            signed in as {user.name || user.email || "unknown"}
          </div>
          <button
            onClick={() => void logout()}
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
            logout
          </button>
        </div>
      ) : null}

      {!loading && !user ? (
      <GoogleLogin
        text="signin_with"
        shape="rectangular"
        logo_alignment="left"
        width={240}
        click_listener={() => {}}
        onSuccess={async (cred) => {
          try {
            if (!API_BASE || !API_BASE.trim()) {
              setStatus("VITE_API_BASE_URL is missing");
              return;
            }

            setStatus("got google token... sending to backend...");
            const idToken = cred.credential;
            if (!idToken) {
              setStatus("no credential from google");
              return;
            }

            const r = await fetch(`${API_BASE}/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ idToken })
            });

            const data = await r.json().catch(() => null);
            if (!r.ok || !data?.ok) {
              setStatus(`backend rejected status=${r.status}`);
              return;
            }

            setStatus("ok: logged in");
            await refreshMe();
          } catch (e) {
            setStatus(`error: ${String(e)}`);
          }
        }}
        onError={() => {
          setStatus("google login failed");
        }}
      />
      ) : null}

      <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{status}</div>
    </div>
  );
}
