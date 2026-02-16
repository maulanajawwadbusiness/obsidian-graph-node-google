type CorsOptionsInput = Parameters<typeof import("cors")>[0];

export type CorsConfigInput = {
  allowedOrigins: string[];
  logAllowed?: boolean;
};

export function buildCorsOptions(input: CorsConfigInput): CorsOptionsInput {
  const logAllowed = input.logAllowed !== false;
  return {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (input.allowedOrigins.includes(origin)) {
        if (logAllowed) {
          console.log(`[cors] allowed origin: ${origin}`);
        }
        cb(null, true);
        return;
      }
      console.warn(`[cors] blocked origin: ${origin}`);
      cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  };
}
