// A trailing "(集英社文庫)" or "[Kindle版]" style label: part of the listing, not the title.
const TRAILING_LABEL = /\s*[(（[［【][^)）\]］】]*[)）\]］】]\s*$/;
const KINDLE_SUFFIX = /\s*Kindle版\s*$/;

// Reduces a selected book title to what a catalog search can match.
export function cleanTitle(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  let title = normalized;
  for (let previous = ""; previous !== title; ) {
    previous = title;
    title = title.replace(KINDLE_SUFFIX, "").replace(TRAILING_LABEL, "");
  }
  // A title that is nothing but a bracketed label, like "【推しの子】", is the title itself.
  return title.trim() || normalized;
}

// item1=ZZ searches every field (title, author, subject), unlike AB (title only);
// space-separated words must all match.
const LIBRARY_SEARCH =
  "https://libweb.city.setagaya.tokyo.jp/detailresult?target1=1&item1=ZZ&key1=";
const KINDLE_SEARCH = "https://www.amazon.co.jp/s?i=digital-text&k=";

export type SearchLink = { label: string; url: string };

export function searchLinks(title: string): SearchLink[] {
  const query = encodeURIComponent(title);
  return [
    { label: "世田谷区立図書館", url: LIBRARY_SEARCH + query },
    { label: "Kindle+", url: KINDLE_SEARCH + query },
  ];
}
