// QR Code encoder (ISO/IEC 18004): byte mode, error correction level M, versions 1-40.
// Level M is fixed because it recovers about 15% damage while keeping the symbol small.

// true = dark module, indexed [y][x].
export type Matrix = boolean[][];

// Indexed by version (1-40); index 0 is unused.
const ECC_CODEWORDS_PER_BLOCK = [
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26,
  26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28,
];
const BLOCK_COUNT = [
  0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
  18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];

// Format information bits for level M are 00; the mask number follows.
const FORMAT_LEVEL_M = 0;
const PAD_BYTES = [0xec, 0x11];

export const MAX_BYTES = 2331;

const bitAt = (value: number, index: number) => ((value >>> index) & 1) !== 0;

function rawModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const aligns = Math.floor(version / 7) + 2;
    result -= (25 * aligns - 10) * aligns - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewordCount(version: number): number {
  return (
    Math.floor(rawModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[version] * BLOCK_COUNT[version]
  );
}

const countBits = (version: number) => (version <= 9 ? 8 : 16);

function pickVersion(length: number): number {
  for (let version = 1; version <= 40; version++) {
    if (4 + countBits(version) + length * 8 <= dataCodewordCount(version) * 8) {
      return version;
    }
  }
  throw new RangeError(`Too long for a QR code: ${length} bytes`);
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

// Reed-Solomon generator polynomial over GF(256), without its leading 1 coefficient.
export function generator(degree: number): number[] {
  const divisor = new Array<number>(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMultiply(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return divisor;
}

// Remainder of data(x) * x^degree divided by the generator polynomial.
export function reedSolomon(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

function dataCodewords(version: number, data: Uint8Array): number[] {
  const codewords = new Array<number>(dataCodewordCount(version)).fill(0);
  let used = 0;
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--, used++) {
      if (bitAt(value, i)) codewords[used >>> 3] |= 0x80 >>> (used & 7);
    }
  };
  append(0b0100, 4);
  append(data.length, countBits(version));
  for (const byte of data) append(byte, 8);
  // The terminator and bit alignment are zeros, which the zero fill already provides.
  for (let i = 0, at = Math.ceil(used / 8); at < codewords.length; i++, at++) {
    codewords[at] = PAD_BYTES[i % 2];
  }
  return codewords;
}

// Splits the data into blocks, appends each block's error correction and interleaves them.
function interleave(version: number, data: number[]): number[] {
  const blocks = BLOCK_COUNT[version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[version];
  const total = Math.floor(rawModules(version) / 8);
  const shortBlocks = blocks - (total % blocks);
  const shortLength = Math.floor(total / blocks);

  const divisor = generator(eccLength);
  const parts: { data: number[]; ecc: number[] }[] = [];
  for (let i = 0, offset = 0; i < blocks; i++) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const block = data.slice(offset, offset + length);
    offset += length;
    parts.push({ data: block, ecc: reedSolomon(block, divisor) });
  }

  const result: number[] = [];
  for (let i = 0; i <= shortLength - eccLength; i++) {
    for (const part of parts)
      if (i < part.data.length) result.push(part.data[i]);
  }
  for (let i = 0; i < eccLength; i++) {
    for (const part of parts) result.push(part.ecc[i]);
  }
  return result;
}

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  // Version 32 is the one exception to the even spacing rule in the standard's table.
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const FINDER_LIKE = ["10111010000", "00001011101"];

function countOverlapping(text: string, pattern: string): number {
  let count = 0;
  for (
    let at = text.indexOf(pattern);
    at >= 0;
    at = text.indexOf(pattern, at + 1)
  ) {
    count++;
  }
  return count;
}

// Mask quality score from the four rules of the standard; lower is better.
function penalty(modules: Matrix): number {
  const size = modules.length;
  let total = 0;
  let darkCount = 0;

  const bit = (dark: boolean) => (dark ? "1" : "0");
  const rows = modules.map((row) => row.map(bit).join(""));
  const columns = modules[0].map((_, x) =>
    modules.map((row) => bit(row[x])).join(""),
  );
  for (const line of [...rows, ...columns]) {
    // Runs of five or more same-colored modules score 3 plus one per extra module.
    for (const [run] of line.matchAll(/(.)\1{4,}/g)) total += run.length - 2;
    for (const pattern of FINDER_LIKE) {
      total += 40 * countOverlapping(line, pattern);
    }
  }
  for (const row of rows) darkCount += row.replace(/0/g, "").length;

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const dark = modules[y][x];
      if (
        dark === modules[y][x + 1] &&
        dark === modules[y + 1][x] &&
        dark === modules[y + 1][x + 1]
      ) {
        total += 3;
      }
    }
  }

  const cells = size * size;
  total += (Math.ceil(Math.abs(darkCount * 20 - cells * 10) / cells) - 1) * 10;
  return total;
}

function draw(version: number, codewords: number[]): Matrix {
  const size = version * 4 + 17;
  const blank = () =>
    Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const modules = blank();
  // Function patterns and reserved areas; data modules and masking skip them.
  const reserved = blank();
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    reserved[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size)
          set(x, y, ring !== 2 && ring !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const aligns = alignmentPositions(version);
  for (const [i, cy] of aligns.entries()) {
    for (const [j, cx] of aligns.entries()) {
      const onFinder =
        (i === 0 && j === 0) ||
        (i === 0 && j === aligns.length - 1) ||
        (i === aligns.length - 1 && j === 0);
      if (onFinder) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const formatBits = (mask: number) => {
    const data = (FORMAT_LEVEL_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bitAt(bits, i));
    set(8, 7, bitAt(bits, 6));
    set(8, 8, bitAt(bits, 7));
    set(7, 8, bitAt(bits, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bitAt(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bitAt(bits, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bitAt(bits, i));
    set(8, size - 8, true);
  };
  // Reserve the format area before placing data; the real mask is written below.
  formatBits(0);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bitAt(bits, i));
      set(b, a, bitAt(bits, i));
    }
  }

  // Zigzag over column pairs from the bottom right, skipping the vertical timing column.
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (!reserved[y][x] && index < codewords.length * 8) {
          modules[y][x] = bitAt(codewords[index >>> 3], 7 - (index & 7));
          index++;
        }
      }
    }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!reserved[y][x] && MASKS[mask](x, y))
          modules[y][x] = !modules[y][x];
      }
    }
  };
  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    formatBits(mask);
    const score = penalty(modules);
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
    applyMask(mask);
  }
  applyMask(best);
  formatBits(best);
  return modules;
}

export function encodeBytes(data: Uint8Array): Matrix {
  const version = pickVersion(data.length);
  return draw(version, interleave(version, dataCodewords(version, data)));
}
