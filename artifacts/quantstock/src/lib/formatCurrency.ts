export function formatCurrency(
  amount: number,
  currency: string,
  maximumFractionDigits = 2,
): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}
