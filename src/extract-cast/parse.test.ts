import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractCast,
  findUnresolved,
  formatText,
  parseText,
  type RawEntry,
} from "./parse.ts";

const cast = (chara: string, ...lines: string[]) =>
  extractCast([{ chara, lines }], "");
const castOf = (entries: RawEntry[]) => extractCast(entries, "");

test("pairs a character with the actor after the 声 prefix", () => {
  assert.deepEqual(cast("主人公", "声 - 山田太郎"), [["山田太郎", "主人公"]]);
});

test("accepts the prefix separator variants", () => {
  for (const sep of ["-", "–", "ー", ":", "："]) {
    assert.deepEqual(cast("A", `声${sep}佐藤`), [["佐藤", "A"]]);
  }
});

test("ignores description lines that merely contain 声", () => {
  assert.deepEqual(
    cast("提督の威厳", "大声を出して、下っ端を整列させる。"),
    [],
  );
});

test("strips bracketed footnotes and trailing text from names", () => {
  assert.deepEqual(cast("A[注 1]", "声 - 佐藤[26]"), [["佐藤", "A"]]);
});

test("ignores an age or version note, keeping both actors", () => {
  assert.deepEqual(
    cast("シャンクス", "声 - 池田秀一、島﨑信長（少年期〈959話 - 〉）"),
    [
      ["池田秀一", "シャンクス"],
      ["島﨑信長", "シャンクス"],
    ],
  );
});

test("splits an actor change chain and drops episode ranges", () => {
  assert.deepEqual(
    cast(
      "ベン・ベックマン",
      "声 - 曽我部和恭（4話）→田原アルノ（488話 - 1112話）→三木眞一郎（1156話 - ）",
    ),
    [
      ["曽我部和恭", "ベン・ベックマン"],
      ["田原アルノ", "ベン・ベックマン"],
      ["三木眞一郎", "ベン・ベックマン"],
    ],
  );
});

test("does not split on separators inside parentheses", () => {
  assert.deepEqual(
    cast(
      "ロックスター",
      "声 - 郷里大輔（151話）→斎藤志郎（劇場版『RED』、1109話 - ）",
    ),
    [
      ["郷里大輔", "ロックスター"],
      ["斎藤志郎", "ロックスター"],
    ],
  );
});

test("pairs actors with characters by position when the counts match", () => {
  assert.deepEqual(cast("A、B", "声 - 佐藤、鈴木"), [
    ["佐藤", "A"],
    ["鈴木", "B"],
  ]);
});

test("gives every character to each actor when the counts differ", () => {
  assert.deepEqual(
    cast("高塚正也の兄弟、弟", "声 - 高塚正也、竹本英史、田中"),
    [
      ["高塚正也", "高塚正也の兄弟, 弟"],
      ["竹本英史", "高塚正也の兄弟, 弟"],
      ["田中", "高塚正也の兄弟, 弟"],
    ],
  );
});

test("pairs actors with the character named in their parentheses", () => {
  assert.deepEqual(
    cast(
      "アブドーラ&ジェット",
      "声 - 平井啓二（アブドーラ）、服巻浩司（ジェット）",
    ),
    [
      ["平井啓二", "アブドーラ"],
      ["服巻浩司", "ジェット"],
    ],
  );
});

test("leaves a character without a matching actor unassigned", () => {
  assert.deepEqual(
    cast(
      "シャーロット・カウンター、シャーロット・カデンツァ、シャーロット・ガラ",
      "声 - 小山剛志（カウンター）、くわはら利晃（カデンツァ）",
    ),
    [
      ["小山剛志", "シャーロット・カウンター"],
      ["くわはら利晃", "シャーロット・カデンツァ"],
    ],
  );
});

test("lets an unlabeled actor and a labeled one share a character", () => {
  assert.deepEqual(cast("ベポ", "声 - 高戸靖広、上田麗奈（ミニベポ）"), [
    ["高戸靖広", "ベポ"],
    ["上田麗奈", "ベポ"],
  ]);
});

test("reads one actor line per character from several dd lines", () => {
  assert.deepEqual(
    cast(
      "ドリー&ブロギー",
      "声（ドリー） - 郷里大輔（71話 - 270話）→藤原貴弘（1109話 - 1112話）",
      "声（ブロギー） - 稲田徹",
    ),
    [
      ["郷里大輔", "ドリー"],
      ["藤原貴弘", "ドリー"],
      ["稲田徹", "ブロギー"],
    ],
  );
});

test("drops readings in parentheses from character names", () => {
  assert.deepEqual(cast("五鬼（ゴーキ）", "声 - 高塚正也"), [
    ["高塚正也", "五鬼"],
  ]);
});

test("splits characters on slashes and ampersands", () => {
  assert.deepEqual(cast("マンジャロウ / ニセゾロ", "声 - 粗忽屋東品川店"), [
    ["粗忽屋東品川店", "マンジャロウ, ニセゾロ"],
  ]);
});

test("merges characters played by the same actor without duplicates", () => {
  assert.deepEqual(
    castOf([
      { chara: "A", lines: ["声 - 佐藤"] },
      { chara: "B", lines: ["声 - 佐藤"] },
      { chara: "A", lines: ["声 - 佐藤"] },
    ]),
    [["佐藤", "A, B"]],
  );
});

test("normalizes full-width parentheses and spaces", () => {
  assert.deepEqual(cast("A（幼少期）", "声 - 山田　太郎"), [
    ["山田 太郎", "A(幼少期)"],
  ]);
});

test("reads inline 'chara(声 - actor)' from body text", () => {
  assert.deepEqual(
    extractCast([], "物語。主人公（声 - 山田太郎）が旅に出る。"),
    [["山田太郎", "主人公"]],
  );
});

test("ignores inline casts whose actor is already listed", () => {
  assert.deepEqual(
    extractCast([{ chara: "A", lines: ["声 - 佐藤"] }], "別名B（声 - 佐藤）"),
    [["佐藤", "A"]],
  );
});

test("returns nothing when there is no cast", () => {
  assert.deepEqual(extractCast([], "何もない本文"), []);
});

test("reports a voice line that produced no actor", () => {
  assert.deepEqual(findUnresolved([{ chara: "A", lines: ["声 - "] }]), [
    "A | 声 -",
    "A | no voice actor assigned",
  ]);
});

test("reports characters left without an actor", () => {
  assert.deepEqual(
    findUnresolved([
      { chara: "アルファ、ベータ", lines: ["声 - 佐藤（アルファ）"] },
    ]),
    ["ベータ | no voice actor assigned"],
  );
});

test("reports nothing for entries without voice lines or fully assigned ones", () => {
  assert.deepEqual(
    findUnresolved([
      { chara: "技", lines: ["大声を出す。"] },
      {
        chara: "ドリー&ブロギー",
        lines: ["声（ドリー） - 郷里大輔", "声（ブロギー） - 稲田徹"],
      },
    ]),
    [],
  );
});

test("formats entries as actor::character lines followed by # comments", () => {
  assert.equal(
    formatText([["佐藤", "A"]], ["Y | no voice actor assigned"]),
    "佐藤::A\n# Y | no voice actor assigned",
  );
});

test("parses edited text: skips comments and bad lines, merges actors, normalizes", () => {
  assert.deepEqual(
    parseText(
      "佐藤::A\n# comment\n\nno separator\n::empty\nempty::\n佐藤 :: B（幼少期）\n鈴木　一郎::C",
    ),
    [
      ["佐藤", "A, B(幼少期)"],
      ["鈴木 一郎", "C"],
    ],
  );
});
