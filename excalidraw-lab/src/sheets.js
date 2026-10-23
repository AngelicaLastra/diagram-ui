/* Multiple sheets in one document, the thing Excalidraw leaves to frames.
   Everything lives in local storage; nothing leaves the machine. */
const KEY = "sketch-lab/sheets/v1";

export function loadSheets() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    if (!doc || !Array.isArray(doc.sheets) || !doc.sheets.length) return null;
    return doc;
  } catch (err) {
    return null;
  }
}
export function saveSheets(doc) {
  try { localStorage.setItem(KEY, JSON.stringify(doc)); } catch (err) { /* quota */ }
}
export function blankSheet(name) {
  return { id: Math.random().toString(36).slice(2), name, elements: [] };
}
