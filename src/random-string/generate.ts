const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
export const DIGITS = "0123456789";
// Only characters that survive URL/form encoding and are accepted by most legacy systems.
const SYMBOLS = "-_";
const AMBIGUOUS = "0O1lI";

const buffer = new Uint32Array(1);

/** Uniform integer in [0, max); rejects the biased tail of the 32-bit range. */
export function randomIndex(max: number): number {
  const limit = 2 ** 32 - (2 ** 32 % max);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] as number;
  } while (value >= limit);
  return value % max;
}

/** Out-of-range or non-integer values are clamped into [min, max]; NaN becomes min. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function generate(
  alphabet: string,
  length: number,
  pick: (max: number) => number = randomIndex,
): string {
  if (alphabet === "") return "";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[pick(alphabet.length)];
  }
  return out;
}

export interface PasswordOptions {
  symbols: boolean;
  noAmbiguous: boolean;
}

function passwordClasses({ symbols, noAmbiguous }: PasswordOptions): string[] {
  const classes = [UPPER, LOWER, DIGITS];
  if (symbols) classes.push(SYMBOLS);
  return classes.map((chars) =>
    noAmbiguous
      ? [...chars].filter((c) => !AMBIGUOUS.includes(c)).join("")
      : chars,
  );
}

/**
 * Draws from all classes and retries until every class appears, which keeps the
 * result uniform over the strings that satisfy the policy.
 */
export function generatePassword(
  length: number,
  options: PasswordOptions,
  pick: (max: number) => number = randomIndex,
): string {
  const classes = passwordClasses(options);
  const alphabet = classes.join("");
  let out: string;
  do {
    out = generate(alphabet, length, pick);
  } while (!classes.every((chars) => [...out].some((c) => chars.includes(c))));
  return out;
}

/** Ignores the negligible loss from the retry in `generatePassword`. */
export function passwordBits(length: number, options: PasswordOptions): number {
  return length * Math.log2(passwordClasses(options).join("").length);
}

function tokenBody(caseSensitive: boolean): string {
  return caseSensitive ? LOWER + UPPER + DIGITS : LOWER + DIGITS;
}

/**
 * Token for hiding a URL. Starts with a lowercase letter because host labels,
 * bucket names and CSS ids often reject a leading digit.
 */
export function generateToken(
  length: number,
  caseSensitive: boolean,
  pick: (max: number) => number = randomIndex,
): string {
  return (
    generate(LOWER, 1, pick) +
    generate(tokenBody(caseSensitive), length - 1, pick)
  );
}

export function tokenBits(length: number, caseSensitive: boolean): number {
  return (
    Math.log2(LOWER.length) +
    (length - 1) * Math.log2(tokenBody(caseSensitive).length)
  );
}
