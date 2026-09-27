// Aufbereitung der Verovio-SVGs für den PDF-Export (ohne jsPDF-Abhängigkeit, testbar).

// SMuFL-Textglyphen der Tempoangabe → deutscher Text (jsPDF kennt die Musikschrift nicht).
// Verovio setzt Metronomangaben mit den „metNote…“-Glyphen (U+ECA0 ff.), ältere Fassungen mit
// den Einzelnoten-Glyphen (U+E1D0 ff.).
const TEMPO_GLYPHS: Record<string, string> = {
  "\uECA3": "Halbe",
  "\uECA5": "Viertel",
  "\uECA7": "Achtel",
  "\uECA9": "Sechzehntel",
  "\uE1D3": "Halbe",
  "\uE1D5": "Viertel",
  "\uE1D7": "Achtel",
  "\uE1D9": "Sechzehntel",
};
const DOTS = ["\uECB7", "\uE1E7"];

/** Ersetzt Glyphen der Musikschrift in Texten (Tempo) durch lesbaren Text. */
export function replaceTextGlyphs(svg: SVGSVGElement): void {
  svg.querySelectorAll('tspan[font-family="Leipzig"], tspan[font-family="Bravura"]').forEach((el) => {
    const text = el.textContent ?? "";
    const base = [...text].map((ch) => TEMPO_GLYPHS[ch]).find(Boolean);
    const dotted = DOTS.some((dot) => text.includes(dot));
    el.removeAttribute("font-family");
    // Schriftgröße vom übrigen Text der Angabe übernehmen (z. B. „ = 96“).
    const sizes = Array.from(el.closest("text")?.querySelectorAll("tspan[font-size]") ?? [])
      .filter((t) => t !== el)
      .map((t) => t.getAttribute("font-size"));
    const size = sizes.find(Boolean);
    if (size) el.setAttribute("font-size", size);
    // Geschütztes Leerzeichen am Ende: svg2pdf entfernt führende Leerzeichen der Folgespanne.
    el.textContent = base ? `${dotted ? "punktierte " : ""}${base}\u00A0` : "";
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

function numbers(value: string | null): number[] | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  return parts.every(Number.isFinite) ? parts : null;
}

function length(value: string | null, fallback: number): number {
  if (!value || value.endsWith("%")) return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Ersetzt verschachtelte ``<svg>``-Elemente (Verovio: ``definition-scale``) durch ``<g>`` mit
 * expliziter Transformation. svg2pdf.js skaliert innere Viewports sonst falsch.
 */
export function flattenNestedSvg(root: SVGSVGElement): void {
  const outer = numbers(root.getAttribute("viewBox"));
  const outerWidth = outer ? outer[2]! : length(root.getAttribute("width"), 1000);
  const outerHeight = outer ? outer[3]! : length(root.getAttribute("height"), 1000);
  root.querySelectorAll("svg").forEach((inner) => {
    const box = numbers(inner.getAttribute("viewBox"));
    const width = length(inner.getAttribute("width"), outerWidth);
    const height = length(inner.getAttribute("height"), outerHeight);
    const x = length(inner.getAttribute("x"), 0);
    const y = length(inner.getAttribute("y"), 0);
    const group = document.createElementNS(SVG_NS, "g");
    let transform = `translate(${x} ${y})`;
    if (box && box[2]! > 0 && box[3]! > 0) {
      transform += ` scale(${width / box[2]!} ${height / box[3]!}) translate(${-box[0]!} ${-box[1]!})`;
    }
    group.setAttribute("transform", transform);
    for (const attr of Array.from(inner.attributes)) {
      if (!["viewBox", "width", "height", "x", "y", "overflow", "version", "xmlns"].includes(attr.name)) {
        group.setAttribute(attr.name, attr.value);
      }
    }
    while (inner.firstChild) group.appendChild(inner.firstChild);
    inner.replaceWith(group);
  });
}
