/**
 * Stellar amount conversion utilities.
 *
 * On the Stellar network, amounts are denominated in "stroops" — the smallest
 * unit of an asset. For native XLM, 1 XLM = 10,000,000 (10^7) stroops.
 *
 * The backend stores bounty rewards in stroops as a bigint (TypeORM returns
 * the value as a string to preserve precision in JavaScript). Frontend code
 * should never display the raw stroop value; convert to a human-readable
 * XLM amount first using {@link stroopsToXLM}.
 */

/** Number of stroops in 1 XLM. */
export const STROOPS_PER_XLM = 10_000_000;

/**
 * Convert a stroop amount (string, bigint, or number) to a decimal XLM string
 * with 7 digits of fractional precision, trimming trailing zeros.
 *
 * @example
 *   stroopsToXLM("10000000")      // "1"
 *   stroopsToXLM("15000000")      // "1.5"
 *   stroopsToXLM("1")             // "0.0000001"
 *   stroopsToXLM(0n)              // "0"
 */
export function stroopsToXLM(stroops: string | number | bigint): string {
  let big: bigint;
  try {
    big = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  } catch {
    return "0";
  }

  if (big === 0n) return "0";

  const negative = big < 0n;
  const abs = negative ? -big : big;
  const whole = abs / BigInt(STROOPS_PER_XLM);
  const fraction = abs % BigInt(STROOPS_PER_XLM);

  if (fraction === 0n) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  // Pad fraction to 7 digits, then trim trailing zeros
  const fractionStr = fraction.toString().padStart(7, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${fractionStr}`;
}

/**
 * Format a stroop amount as a localized XLM string for display.
 *
 * @example
 *   formatRewardXLM("10000000")    // "1 XLM"
 *   formatRewardXLM("15000000")    // "1.5 XLM"
 *   formatRewardXLM(null)          // "Reward TBD"
 */
export function formatRewardXLM(
  stroops: string | number | bigint | null | undefined
): string {
  if (stroops === null || stroops === undefined || stroops === "") {
    return "Reward TBD";
  }
  return `${stroopsToXLM(stroops)} XLM`;
}
