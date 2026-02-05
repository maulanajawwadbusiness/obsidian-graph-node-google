import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function GoogleLoginButton() {
  const [status, setStatus] = useState<string>("not logged in yet");
  const [userJson, setUserJson] = useState<string>("");

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <GoogleLogin
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
              setUserJson(JSON.stringify(data, null, 2));
              return;
            }

            setStatus("ok: logged in");
            setUserJson(JSON.stringify(data.user, null, 2));
          } catch (e) {
            setStatus(`error: ${String(e)}`);
          }
        }}
        onError={() => {
          setStatus("google login failed");
        }}
      />

      <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{status}</div>

      {userJson ? <pre style={{ whiteSpace: "pre-wrap" }}>{userJson}</pre> : null}
    </div>
  );
}
