/** Format fee cents for customer UI. */
export function formatWarrantyFee(cents: number | null | undefined, currency = "USD") {
  if (cents == null || !Number.isFinite(cents)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export type FeePaymentInfo = {
  checkoutUrl: string;
  label: string;
  cents: number | null;
  currency: string;
  registrationId: string;
};
