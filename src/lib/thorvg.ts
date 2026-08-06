import ThorVG from '@thorvg/webcanvas';

export type ThorVGModule = Awaited<ReturnType<typeof ThorVG.init>>;

let modulePromise: Promise<ThorVGModule> | undefined;

async function initThorVG(): Promise<ThorVGModule> {
  try {
    return await ThorVG.init({ renderer: 'gl' });
  } catch {
    return await ThorVG.init({ renderer: 'sw' });
  }
}

export function getThorVG(): Promise<ThorVGModule> {
  if (!modulePromise) {
    modulePromise = initThorVG().catch((error) => {
      modulePromise = undefined;
      throw error;
    });
  }
  return modulePromise;
}
