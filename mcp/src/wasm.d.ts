/** Wrangler's CompiledWasm module rule turns `.wasm` imports into a
 * ready-to-instantiate WebAssembly.Module; vitest.worker.config.ts installs
 * a small plugin that does the same for node test runs. */
declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
