// Central Gemini configuration. Keeping the model id in one place means model
// upgrades/retirements (e.g. the 1.5-flash retirement) are a one-line change.
import { GoogleGenerativeAI } from "@google/generative-ai";

// gemini-1.5-flash / 2.5-flash were retired/gated. The "gemini-flash-latest"
// alias works but can get overloaded (503) under load, so we pin to a concrete,
// currently-available flash model that supports generateContent + function
// calling. Swap this one line if it ever 404s (retired) or 503s (overloaded);
// good alternates: "gemini-3.6-flash", "gemini-flash-lite-latest".
export const GEMINI_MODEL = "gemini-3.5-flash";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Retry a Gemini call on transient errors (503 overloaded, 429 rate limit,
 * 500) with exponential backoff + jitter. Non-transient errors rethrow
 * immediately. Throws the last error if all attempts fail.
 */
export async function withGeminiRetry(fn, { retries = 3, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      const msg = String(err?.message || "");
      const transient =
        status === 503 ||
        status === 429 ||
        status === 500 ||
        /unavailable|overloaded|deadline|try again|temporarily/i.test(msg);
      if (!transient || attempt === retries) break;
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** True if an error is a transient/overloaded Gemini service error. */
export function isTransientGeminiError(err) {
  const status = err?.status ?? err?.response?.status;
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    /unavailable|overloaded|deadline|try again|temporarily/i.test(String(err?.message || ""))
  );
}
