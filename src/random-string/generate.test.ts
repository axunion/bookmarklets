import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clamp,
  generate,
  generatePassword,
  generateToken,
  passwordBits,
  randomIndex,
  tokenBits,
} from "./generate.ts";

const PLAIN = { symbols: false, noAmbiguous: false };

test("generates a string of the requested length from the alphabet", () => {
  const out = generate("abc", 50);
  assert.equal(out.length, 50);
  assert.match(out, /^[abc]+$/);
});

test("picks characters through the given index source", () => {
  const indexes = [2, 0, 1];
  assert.equal(
    generate("abc", 3, () => indexes.shift() as number),
    "cab",
  );
});

test("returns an empty string for an empty alphabet", () => {
  assert.equal(generate("", 10), "");
});

test("randomIndex stays within [0, max)", () => {
  for (const max of [1, 5, 62, 67]) {
    for (let i = 0; i < 200; i += 1) {
      const index = randomIndex(max);
      assert.ok(Number.isInteger(index) && index >= 0 && index < max);
    }
  }
});

test("clamps into the range and truncates", () => {
  assert.equal(clamp(0, 12, 99), 12);
  assert.equal(clamp(100, 12, 99), 99);
  assert.equal(clamp(20.9, 12, 99), 20);
  assert.equal(clamp(Number.NaN, 12, 99), 12);
});

test("password always contains upper, lower and digit, and nothing else", () => {
  for (let i = 0; i < 300; i += 1) {
    const out = generatePassword(12, PLAIN);
    assert.equal(out.length, 12);
    assert.match(out, /^[A-Za-z0-9]+$/);
    assert.match(out, /[A-Z]/);
    assert.match(out, /[a-z]/);
    assert.match(out, /[0-9]/);
  }
});

test("password includes a symbol only when enabled", () => {
  for (let i = 0; i < 300; i += 1) {
    const out = generatePassword(12, { symbols: true, noAmbiguous: false });
    assert.match(out, /^[A-Za-z0-9_-]+$/);
    assert.match(out, /[-_]/);
  }
});

test("password can exclude ambiguous characters", () => {
  for (let i = 0; i < 300; i += 1) {
    const out = generatePassword(12, { symbols: true, noAmbiguous: true });
    assert.doesNotMatch(out, /[0O1lI]/);
    assert.match(out, /[A-Z]/);
    assert.match(out, /[a-z]/);
    assert.match(out, /[0-9]/);
    assert.match(out, /[-_]/);
  }
});

test("password retries until every class is present", () => {
  // First draw "AAA" lacks lower/digit; second draw "Aa0" satisfies the policy.
  const indexes = [0, 0, 0, 0, 26, 52];
  assert.equal(
    generatePassword(3, PLAIN, () => indexes.shift() as number),
    "Aa0",
  );
});

test("password entropy follows alphabet size", () => {
  assert.ok(Math.abs(passwordBits(20, PLAIN) - 20 * Math.log2(62)) < 1e-9);
  assert.ok(
    passwordBits(20, { symbols: true, noAmbiguous: true }) < 20 * Math.log2(64),
  );
});

test("token starts with a letter and uses lower case and digits by default", () => {
  for (let i = 0; i < 500; i += 1) {
    const out = generateToken(26, false);
    assert.equal(out.length, 26);
    assert.match(out, /^[a-z][a-z0-9]*$/);
  }
});

test("token can mix in upper case", () => {
  const joined = Array.from({ length: 200 }, () =>
    generateToken(40, true),
  ).join("");
  assert.match(joined, /[A-Z]/);
  for (let i = 0; i < 200; i += 1) {
    assert.match(generateToken(40, true), /^[a-z][A-Za-z0-9]*$/);
  }
});

test("token entropy counts the letter-only first character", () => {
  const expected = Math.log2(26) + 25 * Math.log2(36);
  assert.ok(Math.abs(tokenBits(26, false) - expected) < 1e-9);
  assert.ok(tokenBits(26, false) > 128);
});
