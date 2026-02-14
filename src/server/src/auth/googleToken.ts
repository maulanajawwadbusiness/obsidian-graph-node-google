import { OAuth2Client } from "google-auth-library";

type GoogleTokenVerifyArgs = {
  idToken: string;
  audience: string;
};

type GoogleTokenInfo = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export function makeVerifyGoogleIdToken() {
  return async function verifyGoogleIdToken(args: GoogleTokenVerifyArgs): Promise<GoogleTokenInfo> {
    const oauthClient = new OAuth2Client(args.audience);
    const ticket = await oauthClient.verifyIdToken({
      idToken: args.idToken,
      audience: args.audience
    });
    const payload = ticket.getPayload();
    return {
      sub: payload?.sub,
      email: payload?.email ?? undefined,
      name: payload?.name ?? undefined,
      picture: payload?.picture ?? undefined
    };
  };
}
