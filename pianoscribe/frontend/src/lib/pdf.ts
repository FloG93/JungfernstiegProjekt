// PDF-Export: Verovio rendert A4-Seiten als SVG, jsPDF + svg2pdf.js setzen sie in ein PDF.
// So sieht das PDF genau aus wie die Anzeige; es braucht keine nativen Bibliotheken.

import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";

import { flattenNestedSvg, replaceTextGlyphs } from "./svgfix";
import { createToolkit } from "./verovio";

// A4 in Verovio-Einheiten (1/10 mm bei scale 100).
export const A4_OPTIONS = {
  pageWidth: 2100,
  pageHeight: 2970,
  pageMarginTop: 80,
  pageMarginBottom: 80,
  pageMarginLeft: 90,
  pageMarginRight: 90,
  scale: 45,
  adjustPageHeight: false,
  breaks: "auto",
  header: "auto",
  footer: "none",
  svgViewBox: true,
};

export async function renderPdf(musicxml: string, onProgress?: (fraction: number) => void): Promise<Blob> {
  const tk = await createToolkit();
  tk.setOptions(A4_OPTIONS);
  if (!tk.loadData(musicxml)) throw new Error("Die Noten konnten nicht gesetzt werden.");
  const pages = tk.getPageCount();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:2100px;visibility:hidden";
  document.body.appendChild(host);
  try {
    for (let page = 1; page <= pages; page++) {
      host.innerHTML = tk.renderToSVG(page);
      const svg = host.querySelector("svg");
      if (!svg) continue;
      replaceTextGlyphs(svg);
      flattenNestedSvg(svg);
      if (page > 1) doc.addPage("a4", "portrait");
      await svg2pdf(svg, doc, { x: 0, y: 0, width: 210, height: 297 });
      onProgress?.(page / pages);
    }
  } finally {
    host.remove();
  }
  return doc.output("blob");
}
