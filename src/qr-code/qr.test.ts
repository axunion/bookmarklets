import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeBytes, generator, MAX_BYTES, reedSolomon } from "./qr.ts";

const bytes = (length: number) => new Uint8Array(length).fill(0x61);
const utf8 = (text: string) => new TextEncoder().encode(text);
const sizeOf = (length: number) => encodeBytes(bytes(length)).length;

test("computes Reed-Solomon codewords matching the standard's worked example", () => {
  const data = [
    32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17,
  ];
  assert.deepEqual(
    reedSolomon(data, generator(10)),
    [196, 35, 39, 119, 235, 215, 231, 226, 93, 23],
  );
});

test("moves to the next version exactly when the level M capacity is exceeded", () => {
  // Byte mode capacity at level M for versions 1-40, from the standard's capacity table.
  const capacity = [
    14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450,
    504, 560, 624, 666, 711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370,
    1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331,
  ];
  for (const [i, max] of capacity.entries()) {
    assert.equal(
      sizeOf(max),
      (i + 1) * 4 + 17,
      `version ${i + 1} at ${max} bytes`,
    );
    if (i < 39) {
      assert.equal(
        sizeOf(max + 1),
        (i + 2) * 4 + 17,
        `version ${i + 2} at ${max + 1} bytes`,
      );
    }
  }
});

test("accepts up to MAX_BYTES and rejects anything longer", () => {
  assert.equal(MAX_BYTES, 2331);
  assert.equal(sizeOf(MAX_BYTES), 177);
  assert.throws(() => encodeBytes(bytes(MAX_BYTES + 1)), RangeError);
});

test("places finder patterns in three corners and timing patterns between them", () => {
  const modules = encodeBytes(utf8("https://example.com/"));
  const size = modules.length;
  const finder = [
    "1111111",
    "1000001",
    "1011101",
    "1011101",
    "1011101",
    "1000001",
    "1111111",
  ];
  for (const [left, top] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ]) {
    const rows = finder.map((_, dy) =>
      modules[top + dy]
        .slice(left, left + 7)
        .map((dark) => (dark ? "1" : "0"))
        .join(""),
    );
    assert.deepEqual(rows, finder);
  }
  for (let i = 8; i < size - 8; i++) {
    assert.equal(modules[6][i], i % 2 === 0);
    assert.equal(modules[i][6], i % 2 === 0);
  }
  assert.equal(modules[size - 8][8], true);
});

test("writes the same valid level M format information in both copies", () => {
  const modules = encodeBytes(utf8("hello"));
  const size = modules.length;
  const read = (cells: [number, number][]) =>
    cells.reduce((acc, [x, y], i) => acc | ((modules[y][x] ? 1 : 0) << i), 0);
  const nearTopLeft = read([
    ...[0, 1, 2, 3, 4, 5].map((i): [number, number] => [8, i]),
    [8, 7],
    [8, 8],
    [7, 8],
    ...[9, 10, 11, 12, 13, 14].map((i): [number, number] => [14 - i, 8]),
  ]);
  const split = read([
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i): [number, number] => [size - 1 - i, 8]),
    ...[8, 9, 10, 11, 12, 13, 14].map((i): [number, number] => [
      8,
      size - 15 + i,
    ]),
  ]);
  assert.equal(nearTopLeft, split);

  // The eight level M format words (masks 0-7) from the standard's format table.
  const valid = [
    0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
  ];
  assert.ok(valid.includes(nearTopLeft));
});

test("writes version information and alignment patterns from version 7", () => {
  const modules = encodeBytes(bytes(122));
  const size = modules.length;
  assert.equal(size, 45);
  // Version 7 information from the standard: 000111110010010100.
  let bits = 0;
  for (let i = 0; i < 18; i++) {
    const dark: boolean = modules[Math.floor(i / 3)][size - 11 + (i % 3)];
    assert.equal(modules[size - 11 + (i % 3)][Math.floor(i / 3)], dark);
    bits |= (dark ? 1 : 0) << i;
  }
  assert.equal(bits, 0b000111110010010100);
  // Alignment centres at 22 and 38: dark centre, light ring, dark outline.
  for (const [cx, cy] of [
    [22, 22],
    [38, 38],
    [6, 22],
  ]) {
    assert.equal(modules[cy][cx], true);
    assert.equal(modules[cy][cx - 1], false);
    assert.equal(modules[cy - 1][cx + 1], false);
    assert.equal(modules[cy][cx + 2], true);
    assert.equal(modules[cy + 2][cx - 2], true);
  }
});

test("is deterministic and depends on the input", () => {
  const a = encodeBytes(utf8("abc"));
  assert.deepEqual(a, encodeBytes(utf8("abc")));
  assert.notDeepEqual(a, encodeBytes(utf8("abd")));
});
