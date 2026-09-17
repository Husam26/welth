// Central Gemini configuration. Keeping the model id in one place means model
// upgrades/retirements (e.g. the 1.5-flash retirement) are a one-line change.
import { GoogleGenerativeAI } from "@google/generative-ai";

// gemini-1.5-flash and gemini-2.5-flash were retired/gated for new users.
// "gemini-flash-latest" is an alias that always points to the current flash
// model, so it won't 404 due to a future retirement. Supports generateContent
// + function calling. Pin to a concrete version (e.g. "gemini-3.6-flash") if
// you need fully reproducible model behaviour.
export const GEMINI_MODEL = "gemini-flash-latest";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
