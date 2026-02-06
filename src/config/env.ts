const rawOnboarding = import.meta.env.VITE_ONBOARDING_ENABLED;

export const ONBOARDING_ENABLED = rawOnboarding === 'true' || rawOnboarding === '1';
