import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth/AuthProvider";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function GoogleLoginButton() {
  const [status, setStatus] = useState<string>("");
  const { user, loading, refreshMe, logout } = useAuth();

  return (
    <div
      id="google-login-area"
      style={{ display: "grid", gap: 8, justifyItems: "center" }}
    >
      {loading ? <div>Checking session...</div> : null}

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
            Signed in as {user.name || user.email || "unknown"}
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
            Logout
          </button>
        </div>
      ) : null}

      {!loading && !user ? (
        <div style={LOGIN_BUTTON_WRAP_STYLE}>
          <GoogleLogin
            text="signin_with"
            shape="pill"
            logo_alignment="left"
            width={240}
            click_listener={() => {}}
            onSuccess={async (cred) => {
              try {
                if (!API_BASE || !API_BASE.trim()) {
                  setStatus("VITE_API_BASE_URL is missing");
                  return;
                }

                setStatus("Got Google token... sending to backend...");
                const idToken = cred.credential;
                if (!idToken) {
                  setStatus("No credential from Google");
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
                  setStatus(`Backend rejected status=${r.status}`);
                  return;
                }

                setStatus("Ok: logged in");
                await refreshMe();
              } catch (e) {
                setStatus(`Error: ${String(e)}`);
              }
            }}
            onError={() => {
              setStatus("Google login failed");
            }}
          />
        </div>
      ) : null}

      {status ? (
        <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
          {status}
        </div>
      ) : null}
    </div>
  );
}

const LOGIN_BUTTON_WRAP_STYLE = {
  borderRadius: 15,
  overflow: "hidden"
};
