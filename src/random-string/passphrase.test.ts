import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePassphrase, passphraseBits } from "./passphrase.ts";
import { WORDS } from "./wordlist.ts";

const PLAIN = { capitalize: false, digit: false };
const sequence =
  (...indexes: number[]) =>
  () =>
    indexes.shift() as number;

test("wordlist has 2048 unique lower-case ASCII words", () => {
  assert.equal(WORDS.length, 2048);
  assert.equal(new Set(WORDS).size, 2048);
  for (const word of WORDS) assert.match(word, /^[a-z]+$/);
});

test("joins the picked words with hyphens", () => {
  assert.equal(
    generatePassphrase(3, PLAIN, sequence(0, 1, 0), ["alpha", "beta"]),
    "alpha-beta-alpha",
  );
});

test("capitalizes each word on request", () => {
  assert.equal(
    generatePassphrase(2, { capitalize: true, digit: false }, sequence(1, 0), [
      "alpha",
      "beta",
    ]),
    "Beta-Alpha",
  );
});

test("appends one digit on request", () => {
  assert.equal(
    generatePassphrase(
      2,
      { capitalize: false, digit: true },
      sequence(0, 1, 7),
      ["alpha", "beta"],
    ),
    "alpha-beta7",
  );
});

test("real generation yields the requested number of words", () => {
  const out = generatePassphrase(7, PLAIN);
  assert.match(out, /^[a-z]+(-[a-z]+){6}$/);
});

test("entropy is 11 bits per word plus the optional digit", () => {
  assert.equal(passphraseBits(7, PLAIN), 77);
  assert.ok(
    Math.abs(
      passphraseBits(7, { capitalize: false, digit: true }) -
        (77 + Math.log2(10)),
    ) < 1e-9,
  );
});
