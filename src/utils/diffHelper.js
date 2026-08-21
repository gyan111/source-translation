/**
 * Calculates percentage of content modified by the human editor.
 * Compares words/tokens between original machine translation and current text.
 * @param {string} original
 * @param {string} current
 * @returns {number} 0 to 100
 */
export function calculateModificationPercent(original, current) {
  if (!original && !current) return 0;
  if (!original && current) return 100;
  if (original && !current) return 0;
  if (original === current) return 0;

  const origWords = original.trim().split(/\s+/).filter(Boolean);
  const currWords = current.trim().split(/\s+/).filter(Boolean);

  if (origWords.length === 0) return 0;

  let matches = 0;
  const currWordSet = new Map();
  for (const w of currWords) {
    currWordSet.set(w, (currWordSet.get(w) || 0) + 1);
  }

  for (const w of origWords) {
    if (currWordSet.get(w) > 0) {
      matches++;
      currWordSet.set(w, currWordSet.get(w) - 1);
    }
  }

  const unchangedRatio = matches / Math.max(origWords.length, currWords.length);
  return Math.max(0, Math.min(100, Math.round((1 - unchangedRatio) * 100)));
}
