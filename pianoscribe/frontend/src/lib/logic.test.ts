import { afterEach, describe, expect, it, vi } from "vitest";

import { api, audioUrl, setTokenForTests } from "../api/client";
import { KEY_OPTIONS, noteNameDe, noteNameTone, SALAMANDER_URLS } from "./music";
import { flattenNestedSvg, replaceTextGlyphs } from "./svgfix";
import { formatDecimal, formatTime, TimeMap } from "./timing";

describe("TimeMap", () => {
  const map = new TimeMap([
    { q: 0, t: 1.0 },
    { q: 1, t: 1.5 },
    { q: 2, t: 2.1 }, // Tempo wird langsamer
  ]);

  it("interpoliert zwischen Beats", () => {
    expect(map.timeToQ(1.25)).toBeCloseTo(0.5);
    expect(map.timeToQ(1.8)).toBeCloseTo(1.5);
    expect(map.qToTime(1.5)).toBeCloseTo(1.8);
  });

  it("extrapoliert außerhalb", () => {
    expect(map.timeToQ(0.5)).toBeCloseTo(-1);
    expect(map.timeToQ(2.7)).toBeCloseTo(3);
  });

  it("ist umkehrbar", () => {
    for (const t of [0.7, 1.3, 1.9, 2.5]) expect(map.qToTime(map.timeToQ(t))).toBeCloseTo(t);
  });
});

describe("Formatierung und Musik", () => {
  it("formatiert Zeiten", () => {
    expect(formatTime(0)).toBe("0:00,0");
    expect(formatTime(83.46)).toBe("1:23,4");
    expect(formatDecimal(20.35)).toBe("20,4");
    expect(formatDecimal(1234.5, 0)).toBe("1.235");
  });

  it("benennt Noten", () => {
    expect(noteNameDe(60)).toBe("C4");
    expect(noteNameDe(71)).toBe("H4");
    expect(noteNameTone(61)).toBe("C#4");
  });

  it("kennt 30 Salamander-Samples von A0 bis C8", () => {
    const names = Object.keys(SALAMANDER_URLS);
    expect(names).toHaveLength(30);
    expect(SALAMANDER_URLS["A0"]).toBe("A0.mp3");
    expect(SALAMANDER_URLS["D#4"]).toBe("Ds4.mp3");
    expect(SALAMANDER_URLS["C8"]).toBe("C8.mp3");
  });

  it("listet 30 Tonarten mit deutschen Namen", () => {
    expect(KEY_OPTIONS).toHaveLength(30);
    expect(KEY_OPTIONS.find((k) => k.value === "E- major")?.label).toBe("Es-Dur");
    expect(KEY_OPTIONS.find((k) => k.value === "b minor")?.label).toBe("h-Moll");
  });
});

describe("PDF-Vorbereitung", () => {
  it("ersetzt das Tempo-Glyph durch Text", () => {
    const html = `<svg xmlns="http://www.w3.org/2000/svg"><text><tspan class="rend"><tspan class="text">
      <tspan font-family="Leipzig" font-size="720px">\uE1D5\uE1E7</tspan></tspan></tspan>
      <tspan class="text"><tspan font-size="405px"> = </tspan></tspan></text></svg>`;
    const host = document.createElement("div");
    host.innerHTML = html;
    const svg = host.querySelector("svg")!;
    replaceTextGlyphs(svg);
    const text = svg.textContent?.replace(/\s+/g, " ").trim();
    expect(text?.replace(/\u00A0/g, " ")).toBe("punktierte Viertel =");
    expect(svg.querySelector('[font-family="Leipzig"]')).toBeNull();
    expect(svg.querySelector("tspan.text tspan")?.getAttribute("font-size")).toBe("405px");
  });

  it("kennt die Metronom-Glyphen von Verovio", () => {
    const host = document.createElement("div");
    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><text><tspan class="rend"><tspan class="text">
      <tspan font-family="Leipzig" font-size="720px">\uECA5</tspan></tspan></tspan>
      <tspan class="text"><tspan font-size="405px"> = 96</tspan></tspan></text></svg>`;
    const svg = host.querySelector("svg")!;
    replaceTextGlyphs(svg);
    expect(svg.textContent?.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim()).toBe("Viertel = 96");
  });
});

describe("SVG für svg2pdf", () => {
  it("ersetzt verschachtelte SVGs durch skalierte Gruppen", () => {
    const host = document.createElement("div");
    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 945 1336.5">
      <svg class="definition-scale" viewBox="0 0 21000 29700" color="black"><g class="page-margin"><path d="M0 0"/></g></svg>
    </svg>`;
    const svg = host.querySelector("svg")!;
    flattenNestedSvg(svg);
    expect(svg.querySelectorAll("svg")).toHaveLength(0);
    const group = svg.querySelector("g.definition-scale")!;
    expect(group.getAttribute("transform")).toBe("translate(0 0) scale(0.045 0.045) translate(0 0)");
    expect(group.getAttribute("color")).toBe("black");
    expect(group.querySelector("g.page-margin path")).not.toBeNull();
  });
});

describe("API-Client", () => {
  afterEach(() => {
    setTokenForTests(null);
    vi.restoreAllMocks();
  });

  it("schickt das Token als Header und in Medien-URLs", async () => {
    setTokenForTests("abc");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await api.projects();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-PianoScribe-Token"]).toBe("abc");
    expect(audioUrl("p1", "trimmed", "v1")).toBe("/api/projects/p1/audio/trimmed?v=v1&token=abc");
  });

  it("wandelt Fehler in verständliche Meldungen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Projekt nicht gefunden." }), {
      status: 404, headers: { "content-type": "application/json" },
    })));
    await expect(api.project("x")).rejects.toThrow("Projekt nicht gefunden.");
  });
});
