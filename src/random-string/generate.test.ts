import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAlphabet,
  clampLength,
  generate,
  randomIndex,
} from "./generate.ts";

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

test("builds the alphabet in a fixed order regardless of selection order", () => {
  assert.equal(
    buildAlphabet(["a-z", "0-9"]),
    "0123456789abcdefghijklmnopqrstuvwxyz",
  );
  assert.equal(buildAlphabet(["+-_@?"]), "+-_@?");
  assert.equal(buildAlphabet([]), "");
});

test("clamps the length to 1-99", () => {
  assert.equal(clampLength(0), 1);
  assert.equal(clampLength(-5), 1);
  assert.equal(clampLength(100), 99);
  assert.equal(clampLength(12.9), 12);
  assert.equal(clampLength(Number.NaN), 1);
});
