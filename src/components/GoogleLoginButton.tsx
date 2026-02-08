import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth/AuthProvider";
import { t } from "../i18n/t";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const SHOW_LOGIN_DEBUG_ERRORS =
  import.meta.env.VITE_SHOW_LOGIN_DEBUG_ERRORS === "1" || !import.meta.env.DEV;

export function GoogleLoginButton() {
  const [status, setStatus] = useState<string>("");
  const { user, loading, refreshMe, logout } = useAuth();

  return (
    <div
      id="google-login-area"
      style={{ display: "grid", gap: 8, justifyItems: "center" }}
    >
      {loading ? <div>{t("onboarding.enterprompt.login.status_checking")}</div> : null}

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
            {t("onboarding.enterprompt.login.google.signed_in_as")} {user.name || user.email || t("onboarding.enterprompt.login.user_unknown")}
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
            {t("onboarding.enterprompt.login.google.button_logout")}
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
                  setStatus(t("onboarding.enterprompt.login.google.status_missing_api_base"));
                  return;
                }

                setStatus(t("onboarding.enterprompt.login.google.status_got_token"));
                const idToken = cred.credential;
                if (!idToken) {
                  setStatus(t("onboarding.enterprompt.login.google.status_no_credential"));
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
                  setStatus(t("onboarding.enterprompt.login.google.status_backend_rejected", { status: r.status }));
                  return;
                }

                setStatus(t("onboarding.enterprompt.login.google.status_ok_logged_in"));
                await refreshMe();
              } catch (e) {
                setStatus(t("onboarding.enterprompt.login.google.status_error", { error: String(e) }));
              }
            }}
            onError={() => {
              setStatus(t("onboarding.enterprompt.login.google.status_failed"));
            }}
          />
        </div>
      ) : null}

      {SHOW_LOGIN_DEBUG_ERRORS && status ? (
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
