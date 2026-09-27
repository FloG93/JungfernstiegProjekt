// Das npm-Paket verovio bringt keine Typdeklarationen mit.
declare module "verovio/wasm" {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module "verovio/esm" {
  export const VerovioToolkit: new (module: unknown) => object;
}
