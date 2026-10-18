import { DIGITS, generate, randomIndex } from "./generate.ts";
import { WORDS } from "./wordlist.ts";

export interface PassphraseOptions {
  capitalize: boolean;
  digit: boolean;
}

const SEPARATOR = "-";

/** `capitalize` and `digit` exist for systems that demand upper case and a number. */
export function generatePassphrase(
  count: number,
  { capitalize, digit }: PassphraseOptions,
  pick: (max: number) => number = randomIndex,
  words: readonly string[] = WORDS,
): string {
  const picked = Array.from({ length: count }, () => {
    const word = words[pick(words.length)] as string;
    return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });
  return picked.join(SEPARATOR) + (digit ? generate(DIGITS, 1, pick) : "");
}

export function passphraseBits(
  count: number,
  { digit }: PassphraseOptions,
  wordCount: number = WORDS.length,
): number {
  return count * Math.log2(wordCount) + (digit ? Math.log2(DIGITS.length) : 0);
}
