const rawOnboarding = import.meta.env.VITE_ONBOARDING_ENABLED;

export const ONBOARDING_ENABLED = rawOnboarding === 'true' || rawOnboarding === '1';

const rawSplashMs = import.meta.env.VITE_ONBOARDING_SPLASH_MS;
const rawManifestoMs = import.meta.env.VITE_ONBOARDING_MANIFESTO_MS;

export const ONBOARDING_SPLASH_MS = Math.max(500, Number(rawSplashMs || 4500));
export const ONBOARDING_MANIFESTO_MS = Math.max(500, Number(rawManifestoMs || 6000));
