/**
 * Minimal GS1 Application Identifier (AI) parser.
 *
 * GS1 barcodes (GS1-128, DataBar Expanded, GS1 DataMatrix / QR) encode several
 * fields concatenated into one string. Each field starts with a 2–4 digit AI
 * that defines its meaning and length. Variable-length fields are terminated by
 * the FNC1 separator, which decoders emit as the GS control char (\x1d).
 *
 * This is a deterministic spec lookup — no external service, runs offline.
 * We only decode the handful of AIs we care about; unknown AIs are skipped
 * safely using their known length class.
 */

export type Gs1Parsed = {
  gtin?: string;
  expiry?: Date;
  bestBefore?: Date;
  productionDate?: Date;
  batch?: string;
  serial?: string;
  weightKg?: number;
};

const GS = "\x1d"; // FNC1 separator as emitted by scanners

// Fixed-length AIs we understand → total data length (excluding the AI digits)
const FIXED: Record<string, number> = {
  "00": 18, // SSCC
  "01": 14, // GTIN
  "02": 14, // GTIN of contained trade items
  "11": 6, // production date YYMMDD
  "12": 6, // due date
  "13": 6, // packaging date
  "15": 6, // best before YYMMDD
  "16": 6, // sell by
  "17": 6, // expiration date YYMMDD
  "20": 2, // variant
};

// Variable-length AIs we understand → max data length (we read until GS anyway)
const VARIABLE: Record<string, number> = {
  "10": 20, // batch / lot
  "21": 20, // serial
  "22": 20,
  "240": 30,
  "241": 30,
  "30": 8, // variable count
};

/** Decode a GS1 date (YYMMDD). DD = 00 means end of month. */
function parseGs1Date(v: string): Date | undefined {
  if (!/^\d{6}$/.test(v)) return undefined;
  const yy = Number(v.slice(0, 2));
  const mm = Number(v.slice(2, 4));
  let dd = Number(v.slice(4, 6));
  // GS1 rule: 00–50 → 2000–2050, 51–99 → 1951–1999
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (mm < 1 || mm > 12) return undefined;
  if (dd === 0) dd = new Date(year, mm, 0).getDate(); // last day of month
  return new Date(year, mm - 1, dd);
}

/** Does this raw scan look like a GS1 element string (vs a plain EAN/UPC)? */
export function looksLikeGs1(raw: string): boolean {
  if (!raw) return false;
  if (raw.includes(GS)) return true;
  // Plain retail symbols are exactly 8/12/13/14 digits with no AI structure
  if (/^\d{8}$|^\d{12,14}$/.test(raw)) return false;
  // Starts with a known AI and is longer than a plain code
  return /^(01|17|15|10|11|21|00)/.test(raw) && raw.length > 14;
}

/**
 * Walk the element string AI-by-AI. Returns the fields we recognise.
 * Robust to unknown AIs: for variable ones it reads to the next GS; for
 * unknown fixed-prefixed data with no GS it stops to avoid mis-slicing.
 */
export function parseGs1(raw: string): Gs1Parsed {
  const out: Gs1Parsed = {};
  if (!raw) return out;

  // Strip a leading symbology identifier like "]C1" / "]d2" / "]Q3" if present
  const s = raw.replace(/^\][A-Za-z]\d/, "");
  let i = 0;

  const readValue = (len: number): string => {
    // Read up to len chars, but stop early at a GS separator
    let end = Math.min(i + len, s.length);
    const gsIdx = s.indexOf(GS, i);
    if (gsIdx !== -1 && gsIdx < end) end = gsIdx;
    const val = s.slice(i, end);
    i = end;
    if (s[i] === GS) i++; // consume separator
    return val;
  };

  const readUntilGs = (max: number): string => {
    let end = s.indexOf(GS, i);
    if (end === -1) end = Math.min(i + max, s.length);
    const val = s.slice(i, end);
    i = end;
    if (s[i] === GS) i++;
    return val;
  };

  while (i < s.length) {
    if (s[i] === GS) {
      i++;
      continue;
    }

    // AIs are 2, 3 or 4 digits. Try the longest known match first.
    const two = s.substr(i, 2);
    const three = s.substr(i, 3);
    const four = s.substr(i, 4);

    let ai = "";
    let kind: "fixed" | "variable" | "weight" | null = null;
    let len = 0;

    if (/^31\d\d$/.test(four)) {
      // 310x..369x: measures; 6-digit value, last AI digit = decimal places
      ai = four;
      kind = "weight";
      len = 6;
    } else if (VARIABLE[three] != null) {
      ai = three;
      kind = "variable";
      len = VARIABLE[three];
    } else if (FIXED[two] != null) {
      ai = two;
      kind = "fixed";
      len = FIXED[two];
    } else if (VARIABLE[two] != null) {
      ai = two;
      kind = "variable";
      len = VARIABLE[two];
    } else {
      // Unknown AI — best effort: skip to next GS, or bail if none
      const next = s.indexOf(GS, i);
      if (next === -1) break;
      i = next + 1;
      continue;
    }

    i += ai.length;
    const value = kind === "variable" ? readUntilGs(len) : readValue(len);

    switch (ai) {
      case "01":
      case "02":
        out.gtin = value;
        break;
      case "17":
        out.expiry = parseGs1Date(value);
        break;
      case "15":
        out.bestBefore = parseGs1Date(value);
        break;
      case "11":
        out.productionDate = parseGs1Date(value);
        break;
      case "10":
        out.batch = value;
        break;
      case "21":
        out.serial = value;
        break;
      default:
        if (kind === "weight" && /^\d{6}$/.test(value)) {
          const decimals = Number(ai[3]);
          out.weightKg = Number(value) / 10 ** decimals;
        }
        break;
    }
  }

  return out;
}
