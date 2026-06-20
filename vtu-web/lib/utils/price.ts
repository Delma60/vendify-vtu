// types/index.ts (or inline in your utils file)
export type DiscountType = "percentile" | "fixed";

export interface DiscountConfig {
  value: number;
  type: DiscountType | string; // 'string' allows for flexibility if you add more types later
}

/**
 * Calculates the exact discount amount to be deducted.
 * * @param amount The original amount (e.g., transaction amount in kobo).
 * @param discount The discount configuration { value, type }.
 * @returns The calculated discount amount.
 */
export const calculateDiscountAmount = (
  amount: number,
  discount?: DiscountConfig | null
): number => {
  // Return 0 if no discount is provided or value is invalid
  if (!discount || typeof discount.value !== "number" || isNaN(discount.value)) {
    return 0;
  }

  // Handle Percentage Discount (e.g., 2% of 5000 = 100)
  if (discount.type === "percentile") {
    return amount * (discount.value / 100);
  }

  // Handle Fixed Discount (e.g., flat 50 Naira off)
  if (discount.type === "fixed") {
    return discount.value;
  }

  return 0; // Fallback for unknown types
};

/**
 * Calculates the final price after the discount is applied.
 * * @param amount The original amount.
 * @param discount The discount configuration.
 * @returns The final payable amount.
 */
export const calculateFinalPrice = (
  amount: number,
  discount?: DiscountConfig | null
): number => {
  const discountAmount = calculateDiscountAmount(amount, discount);
  
  // Ensure the final price doesn't drop below 0
  return Math.max(0, amount - discountAmount);
};

export const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);
