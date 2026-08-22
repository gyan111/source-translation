/**
 * NumeralConverter - Bidirectional digit conversion between Indic scripts,
 * Arabic/Persian scripts, and standard ASCII digits for MediaWiki wikitext.
 */

// Digit offset mappings for major scripts supported across Wikimedia projects
export const DIGIT_MAPS = {
  // Odia
  or: ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'],
  // Devanagari (Hindi, Marathi, Nepali, Sanskrit, Maithili, Bhojpuri)
  hi: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  mr: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  ne: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  // Bengali / Assamese
  bn: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
  as: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
  // Gurmukhi / Punjabi
  pa: ['੦', '੧', '੨', '੩', '੪', '੫', '੬', '੭', '੮', '੯'],
  // Gujarati
  gu: ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'],
  // Telugu
  te: ['౦', '౧', '౨', '౩', '౪', '౫', '౬', '౭', '౮', '౯'],
  // Kannada
  kn: ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'],
  // Malayalam
  ml: ['൦', '൧', '൨', '൩', '൪', '൫', '൬', '൭', '൮', '൯'],
  // Tamil
  ta: ['௦', '௧', '௨', '௩', '௪', '௫', '௬', '௭', '௮', '௯'],
  // Arabic
  ar: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
  // Persian / Urdu
  fa: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
  ur: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
};

// Build a fast lookup map: any non-ASCII digit character -> '0'..'9'
const NON_ASCII_DIGIT_TO_ASCII = {};
for (const digits of Object.values(DIGIT_MAPS)) {
  for (let i = 0; i < 10; i++) {
    NON_ASCII_DIGIT_TO_ASCII[digits[i]] = String(i);
  }
}

// Regex matching any Indic, Arabic, or Persian digit
const ALL_NON_ASCII_DIGITS_RE = /[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0660-\u0669\u06F0-\u06F9]/g;

/**
 * Normalizes all non-ASCII digits (Odia, Devanagari, Gurmukhi, Bengali, Arabic, etc.) in a string to standard ASCII '0'..'9'.
 *
 * @param {string} str - Input string
 * @returns {string} String with all numerals converted to ASCII digits 0-9
 */
export function normalizeToAsciiDigits(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(ALL_NON_ASCII_DIGITS_RE, (match) => NON_ASCII_DIGIT_TO_ASCII[match] ?? match);
}

/**
 * Converts ASCII digits '0'..'9' in a string to the native script digits of target language.
 *
 * @param {string} str - Input string containing ASCII digits
 * @param {string} toLang - Target language code (e.g. 'or', 'hi', 'bn', 'pa', 'ar')
 * @returns {string} String with digits converted to target script
 */
export function convertDigitsToScript(str, toLang) {
  if (!str || typeof str !== 'string') return str;
  const digits = DIGIT_MAPS[toLang];
  if (!digits) return str; // Default to ASCII digits (standard for English, French, etc.)
  return str.replace(/[0-9]/g, (match) => digits[parseInt(match, 10)]);
}

/**
 * Checks if a string consists exclusively of numbers, coordinates, dates, units, offsets, or codes.
 *
 * @param {string} val - Parameter value string
 * @param {string} paramName - Parameter key name
 * @returns {boolean} true if value is numeric/code/offset and should bypass MT
 */
export function isPureNumericOrDateOrCode(val, paramName = '') {
  if (!val || typeof val !== 'string') return false;
  const raw = val.trim();
  if (raw.length === 0) return false;

  // Convert non-ASCII digits to ASCII for uniform checking
  const asciiVal = normalizeToAsciiDigits(raw);

  // Pure integer or decimal number (e.g. "2001", "20.50", "-13.5", "+5.30")
  if (/^[+-]?\d+(?:\.\d+)?$/.test(asciiVal)) return true;

  // Timezone offsets (e.g. "+5:30", "+05:30", "UTC+5.5", "UTC+5:30")
  if (/^(?:UTC|GMT)?\s*[+-]?\d+(?::\d+)?$/i.test(asciiVal)) return true;

  // Phone / Fax / Postal codes (e.g. "91-6727", "754211", "06727-220000", "+91-6727")
  if (/^[+]?\d+[\d\s-]{2,}\d+$/.test(asciiVal)) return true;

  // Numbers with standard units (e.g. "13 m", "20 km", "43 ft", "50 px", "100 sqmi")
  if (/^[+-]?\d+(?:\.\d+)?\s*(?:px|em|%|km|m|cm|mm|kg|g|°|ft|in|ha|acre|acres|sqmi|sqkm|km²|m²)$/i.test(asciiVal)) {
    return true;
  }

  // Dimensions (e.g. "200x300", "200 × 300 px")
  if (/^\d+\s*[×x]\s*\d+\s*(?:px)?$/i.test(asciiVal)) return true;

  // ISO Dates (e.g. "2024-03-10", "1869-03-10")
  if (/^\d{4}-\d{2}-\d{2}$/.test(asciiVal)) return true;

  // Direction letters (N, S, E, W)
  if (/^[NSEWnsew]$/.test(asciiVal)) return true;

  // Technical keywords & flags
  if (['auto', 'metric', 'imperial', 'inline', 'title', 'inline,title', 'yes', 'no', 'true', 'false'].includes(asciiVal.toLowerCase())) {
    return true;
  }

  // Language code format (e.g. "or", "pa", "en", "hi", "zh-cn")
  const key = paramName.toLowerCase().replace(/[\s_-]+/g, '_');
  if ((key.includes('lang') || key.includes('code') || key.includes('iso')) && /^[a-zA-Z]{2,4}(?:-[a-zA-Z0-9]+)?$/.test(asciiVal)) {
    return true;
  }

  return false;
}
