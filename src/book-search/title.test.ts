import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTitle, searchLinks } from "./title.ts";

test("strips a trailing Kindle版 and publisher label", () => {
  assert.equal(
    cleanTitle("吾輩は猫である (新潮文庫) Kindle版"),
    "吾輩は猫である",
  );
  assert.equal(cleanTitle("坊っちゃん［Kindle版］"), "坊っちゃん");
});

test("keeps text after a pipe", () => {
  assert.equal(cleanTitle("Foo | Bar"), "Foo | Bar");
});

test("keeps brackets inside the title", () => {
  assert.equal(cleanTitle("【推しの子】 1"), "【推しの子】 1");
});

test("keeps a title that consists only of a bracketed label", () => {
  assert.equal(cleanTitle("【推しの子】"), "【推しの子】");
});

test("collapses whitespace and leaves a plain title alone", () => {
  assert.equal(cleanTitle("  走れ\n メロス "), "走れ メロス");
});

test("builds library and Kindle+ links with the encoded title", () => {
  const [library, kindle] = searchLinks("A&B 本");
  assert.equal(
    library.url,
    "https://libweb.city.setagaya.tokyo.jp/detailresult?target1=1&item1=ZZ&key1=A%26B%20%E6%9C%AC",
  );
  assert.equal(kindle.label, "Kindle+");
  assert.ok(kindle.url.endsWith("k=A%26B%20%E6%9C%AC"));
  assert.ok(kindle.url.includes("i=digital-text"));
});
