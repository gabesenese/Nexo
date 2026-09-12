import { createContext, useContext } from "react";

/**
 * The interest form lives at the root, and half the page's calls to action open
 * it, so the opener travels by context rather than through five components that
 * have no other reason to know about it.
 */
const TrialContext = createContext<() => void>(() => {});

export const TrialProvider = TrialContext.Provider;

export function useTrial() {
  return useContext(TrialContext);
}
