// Verovio (WASM) wird einmal asynchron geladen; Toolkits teilen sich das Modul.

export interface TimemapEntry {
  tstamp: number;
  qstamp: number;
  on?: string[];
  off?: string[];
  restsOn?: string[];
  restsOff?: string[];
  measureOn?: string;
  tempo?: number;
}

export interface Toolkit {
  setOptions(options: Record<string, unknown>): void;
  loadData(data: string): boolean;
  getPageCount(): number;
  renderToSVG(page?: number, xmlDeclaration?: boolean): string;
  renderToTimemap(options?: Record<string, unknown>): TimemapEntry[];
  getPageWithElement(id: string): number;
  redoLayout(options?: Record<string, unknown>): void;
  getLog(): string;
}

type Module = unknown;
let modulePromise: Promise<Module> | null = null;

function loadModule(): Promise<Module> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasm = (await import("verovio/wasm")) as { default: () => Promise<Module> };
      return wasm.default();
    })();
  }
  return modulePromise;
}

/** Neues Toolkit (eigene Optionen und Daten), z. B. getrennt für Anzeige und PDF. */
export async function createToolkit(): Promise<Toolkit> {
  const [module, esm] = await Promise.all([loadModule(), import("verovio/esm")]);
  return new esm.VerovioToolkit(module) as unknown as Toolkit;
}
