// Centralized currency configuration and formatting.
// Welth uses the Indian Rupee (INR) throughout the app. Keeping this in one
// place prevents the "₹ vs $" inconsistency that used to exist across components,
// emails and AI prompts.

export const CURRENCY_SYMBOL = "₹";
export const CURRENCY_CODE = "INR";
export const CURRENCY_LOCALE = "en-IN";

/**
 * Format a numeric amount as an INR string, e.g. 1234.5 -> "₹1,234.50".
 * Falls back gracefully for null/undefined/NaN inputs.
 * @param {number|string} amount
 * @param {{ withSymbol?: boolean }} [options]
 */
export function formatCurrency(amount, { withSymbol = true } = {}) {
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;

  const formatted = safeValue.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return withSymbol ? `${CURRENCY_SYMBOL}${formatted}` : formatted;
}
