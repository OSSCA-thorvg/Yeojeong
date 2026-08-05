import ThorVG from '@thorvg/webcanvas';

export type ThorVGModule = Awaited<ReturnType<typeof ThorVG.init>>;

let modulePromise: Promise<ThorVGModule> | undefined;

// WASM module init is expensive; every canvas in the app shares one instance.
export function getThorVG(): Promise<ThorVGModule> {
  if (!modulePromise) modulePromise = ThorVG.init({ renderer: 'gl' });
  return modulePromise;
}
