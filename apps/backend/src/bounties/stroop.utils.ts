/**
 * Stellar stroop conversion utilities.
 *
 * 1 XLM = 10,000,000 stroops (7 decimal places).
 * All reward amounts are stored in stroops (BIGINT) in the database
 * and transmitted as strings in the API to avoid JSON number precision loss.
 */

const STROOPS_PER_XLM = 10_000_000n;

/**
 * Convert a stroop amount (string) to XLM (string with 7 decimal places).
 * @param stroops - Whole number string in stroops
 * @returns XLM amount string, e.g. "1.0000000" for "10000000" stroops
 */
export function stroopsToXlm(stroops: string): string {
  const value = BigInt(stroops);
  const whole = value / STROOPS_PER_XLM;
  const fraction = value % STROOPS_PER_XLM;
  return `${whole}.${fraction.toString().padStart(7, '0')}`;
}

/**
 * Convert an XLM amount (string or number) to stroops (string).
 * @param xlm - XLM amount, e.g. "1.5" or 1.5
 * @returns Whole number string in stroops, e.g. "15000000"
 */
export function xlmToStroops(xlm: string | number): string {
  const str = typeof xlm === 'number' ? xlm.toFixed(7) : String(xlm);
  const [whole, fraction = ''] = str.split('.');
  const paddedFraction = fraction.padEnd(7, '0').slice(0, 7);
  return String(BigInt(whole) * STROOPS_PER_XLM + BigInt(paddedFraction));
}

/**
 * TypeORM value transformer for stroop amounts.
 * Database stores BIGINT (string from PG driver), JS side uses bigint.
 */
export const stroopTransformer = {
  /** PG returns BIGINT as string → convert to bigint for JS */
  from: (value: string | number | bigint | null): bigint | null => {
    if (value === null || value === undefined) return null;
    return BigInt(value);
  },
  /** JS bigint → convert to string for PG BIGINT parameter */
  to: (value: bigint | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    return String(value);
  },
};
