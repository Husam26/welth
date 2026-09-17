// Prisma returns Decimal instances for money fields (balance / amount) which are
// not serializable across the Server -> Client boundary in Next.js. This helper
// converts those Decimal fields to plain JS numbers.
//
// Previously this logic was duplicated as `serializedTransaction` / `serializeAmount`
// in actions/accounts.js, actions/dashboard.js and actions/transaction.js.

export const serializeDecimal = (obj) => {
  if (!obj) return obj;

  const serialized = { ...obj };

  if (obj.balance !== undefined && obj.balance !== null) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount !== undefined && obj.amount !== null) {
    serialized.amount = obj.amount.toNumber();
  }

  return serialized;
};
