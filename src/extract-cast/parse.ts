// DOM-free cast extraction. Input is raw text collected from the page.
//
// Expected markup (Japanese Wikipedia): <dt>character</dt><dd>声 - actor</dd>,
// where the actor text may carry notes and several actors:
//   声 - A(幼少期)、B           a note in parentheses is kept on the actor's name
//   声 - A(4話)→B(5話 - )       the actor changed over time
//   声 - A(X)、B(Y)             parentheses name the character an actor plays

/** A voice actor and the character(s) they play. */
export type CastEntry = [voice: string, chara: string];

/** A <dt> (character) with the text of every <dd> that follows it. */
export interface RawEntry {
  chara: string;
  lines: string[];
}

interface Actor {
  name: string;
  /** Text in parentheses after the name; a character hint, or a note to ignore. */
  note: string;
}

const BRACKETED_NOTE = /\[[^\]]*\]/g;
const VOICE_LINE = /^\s*声\s*(?:\(([^)]*)\))?\s*[-–ー:：]\s*([\s\S]*)$/;
// Parentheses holding only a reading, e.g. "五鬼(ゴーキ)".
const READING = /\([\s぀-ヿ・ー]*\)/g;
// A note with no letters (e.g. "1", " - ") says nothing worth keeping.
const HAS_LETTER = /\p{L}/u;
const NOT_A_NAME = /^(?:他|ほか|など)$/;
const OPENERS = "(「『〈";
const CLOSERS = ")」』〉";

const standardize = (text: string) =>
  text
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/　/g, " ")
    .replace(BRACKETED_NOTE, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();

function nextDepth(depth: number, char: string): number {
  if (OPENERS.includes(char)) {
    return depth + 1;
  }
  return CLOSERS.includes(char) ? Math.max(0, depth - 1) : depth;
}

/** Splits on any of `separators`, ignoring those inside parentheses or quotes. */
function splitTopLevel(text: string, separators: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (depth === 0 && separators.includes(char)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
    depth = nextDepth(depth, char);
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** True when an opener is never closed; splitTopLevel then stops splitting. */
const hasUnclosedBracket = (text: string) => [...text].reduce(nextDepth, 0) > 0;

function parseActor(text: string): Actor {
  const open = text.indexOf("(");
  if (open === -1) {
    return { name: text.trim(), note: "" };
  }
  const close = text.lastIndexOf(")");
  return {
    name: text.slice(0, open).trim(),
    note: text.slice(open + 1, close > open ? close : undefined).trim(),
  };
}

/** Comma-separated slots, each a chain of actors joined by "→". */
function parseActors(text: string): Actor[][] {
  return splitTopLevel(text, "、,，／/")
    .map((slot) =>
      splitTopLevel(slot, "→")
        .map(parseActor)
        .filter(({ name }) => name && !NOT_A_NAME.test(name)),
    )
    .filter((chain) => chain.length > 0);
}

const refersTo = (hint: string, chara: string) =>
  hint.length >= 2 &&
  (chara.includes(hint) || (chara.length >= 2 && hint.includes(chara)));

function parseCharas(chara: string): string[] {
  return splitTopLevel(standardize(chara).replace(READING, ""), "、,，&＆/／");
}

function pair(charas: string[], line: string): CastEntry[] {
  const parsed = VOICE_LINE.exec(line);
  if (!parsed) {
    return [];
  }
  const [, header = "", body = ""] = parsed;
  const slots = parseActors(body);

  // "声(ドリー) - ..." addresses only the character it names.
  const headed = header
    ? charas.filter((chara) => refersTo(header, chara))
    : [];
  const zip =
    headed.length === 0 && slots.length === charas.length && charas.length > 1;

  return slots.flatMap((chain, index) =>
    chain.flatMap(({ name, note }) => {
      const hinted = charas.filter((chara) => refersTo(note, chara));
      const targets =
        headed.length > 0
          ? headed
          : hinted.length > 0
            ? hinted
            : zip
              ? [charas[index] as string]
              : charas;
      const voice =
        hinted.length === 0 && HAS_LETTER.test(note)
          ? `${name}(${note})`
          : name;
      return targets.map((chara): CastEntry => [voice, chara]);
    }),
  );
}

/** Merges entries sharing a voice actor, joining their characters with ", ". */
function mergeByVoice(entries: CastEntry[]): CastEntry[] {
  const byVoice = new Map<string, string[]>();
  for (const [voice, chara] of entries) {
    const charas = byVoice.get(voice) ?? [];
    if (!charas.includes(chara)) {
      charas.push(chara);
    }
    byVoice.set(voice, charas);
  }
  return [...byVoice].map(([voice, charas]) => [voice, charas.join(", ")]);
}

// "キャラ(声 - 声優)" written inside running text; up to 16 chars of the character name.
const INLINE_CAST = /.{1,16}[(（][^)）]*声\s*[-–ー:：][^)）]+[)）]/g;
const INLINE_CAST_PARTS = /^(.*?)[(（][^)）]*声\s*[-–ー:：]\s*([^)）]+)[)）]$/;

function fromInlineText(bodyText: string): CastEntry[] {
  return (bodyText.match(INLINE_CAST) ?? []).flatMap((match): CastEntry[] => {
    const parts = INLINE_CAST_PARTS.exec(match);
    if (!parts) {
      return [];
    }
    const chara = standardize((parts[1] as string).split("。").pop() ?? "");
    return [[standardize(parts[2] as string), chara]];
  });
}

/**
 * Builds the cast list. <dt>/<dd> entries are primary; a "キャラ(声 - 声優)" found
 * in the body text is added only for voice actors not already listed.
 */
export function extractCast(
  entries: RawEntry[],
  bodyText: string,
): CastEntry[] {
  const primary = mergeByVoice(
    entries.flatMap(({ chara, lines }) => {
      const charas = parseCharas(chara);
      return lines.flatMap((line) => pair(charas, standardize(line)));
    }),
  );
  const known = new Set(primary.map(([voice]) => voice));
  const inline = fromInlineText(bodyText).filter(
    ([voice, chara]) => voice && chara && !known.has(voice),
  );
  return mergeByVoice([...primary, ...inline]);
}

/**
 * Describes what the parser could not place: voice lines that yielded no actor,
 * and characters of a voiced entry that no actor was assigned to.
 */
export function findUnresolved(entries: RawEntry[]): string[] {
  return entries.flatMap(({ chara, lines }) => {
    const voiceLines = lines
      .map(standardize)
      .filter((line) => VOICE_LINE.test(line));
    if (voiceLines.length === 0) return [];

    const charas = parseCharas(chara);
    const label = standardize(chara);
    const assigned = new Set<string>();
    const unresolved: string[] = [];

    for (const text of [label, ...voiceLines].filter(hasUnclosedBracket)) {
      unresolved.push(`${label} | unclosed bracket: ${text}`);
    }
    for (const line of voiceLines) {
      const pairs = pair(charas, line);
      if (pairs.length === 0) {
        unresolved.push(`${label} | ${line}`);
      }
      for (const [, name] of pairs) {
        assigned.add(name);
      }
    }
    for (const name of charas.filter((c) => !assigned.has(c))) {
      unresolved.push(`${name} | no voice actor assigned`);
    }
    return unresolved;
  });
}

const SEPARATOR = "::";

/** One "actor::character" line per entry, followed by unresolved items as "#" comments. */
export function formatText(cast: CastEntry[], unresolved: string[]): string {
  return [
    ...cast.map(([voice, chara]) => `${voice}${SEPARATOR}${chara}`),
    ...unresolved.map((item) => `# ${item}`),
  ].join("\n");
}

/** Reads the edited text back: skips blanks and "#" comments, merges duplicate actors. */
export function parseText(text: string): CastEntry[] {
  const entries = text.split("\n").flatMap((line): CastEntry[] => {
    const trimmed = line.trim();
    const at = trimmed.indexOf(SEPARATOR);
    if (trimmed.startsWith("#") || at === -1) {
      return [];
    }
    const voice = standardize(trimmed.slice(0, at));
    const chara = standardize(trimmed.slice(at + SEPARATOR.length));
    return voice && chara ? [[voice, chara]] : [];
  });
  return mergeByVoice(entries);
}
