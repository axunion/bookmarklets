export const CHARSETS = {
  "0-9": "0123456789",
  "A-Z": "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "a-z": "abcdefghijklmnopqrstuvwxyz",
  "+-_@?": "+-_@?",
} as const;

export type CharsetKey = keyof typeof CHARSETS;

export const MIN_LENGTH = 1;
export const MAX_LENGTH = 99;

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

/** Joins the selected character sets in a fixed order. */
export function buildAlphabet(keys: readonly CharsetKey[]): string {
  return (Object.keys(CHARSETS) as CharsetKey[])
    .filter((key) => keys.includes(key))
    .map((key) => CHARSETS[key])
    .join("");
}

/** Out-of-range or non-integer lengths are clamped to 1-99. */
export function clampLength(value: number): number {
  if (!Number.isFinite(value)) return MIN_LENGTH;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.trunc(value)));
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
