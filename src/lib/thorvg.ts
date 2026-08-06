import ThorVG from '@thorvg/webcanvas';

export type ThorVGModule = Awaited<ReturnType<typeof ThorVG.init>>;

let modulePromise: Promise<ThorVGModule> | undefined;

export function getThorVG(): Promise<ThorVGModule> {
  if (!modulePromise) modulePromise = ThorVG.init({ renderer: 'gl' });
  return modulePromise;
}
