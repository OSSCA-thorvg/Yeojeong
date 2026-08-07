// Initializes the shared ThorVG rendering module (GL with software fallback) and reuses a single instance.
// ThorVG 렌더링 모듈을 초기화(GL, 실패 시 소프트웨어로 대체)하고 하나의 공유 인스턴스로 재사용한다.
import ThorVG from '@thorvg/webcanvas';

export type ThorVGModule = Awaited<ReturnType<typeof ThorVG.init>>;

let modulePromise: Promise<ThorVGModule> | undefined;

// Initializes ThorVG with GL rendering, falling back to software rendering if that fails.
// ThorVG를 GL 렌더러로 초기화하고, 실패하면 소프트웨어 렌더러로 대체한다.
async function initThorVG(): Promise<ThorVGModule> {
  try {
    return await ThorVG.init({ renderer: 'gl' });
  } catch {
    return await ThorVG.init({ renderer: 'sw' });
  }
}

// Returns the shared ThorVG module instance, initializing it once and reusing the same promise for later calls.
// 공유되는 ThorVG 모듈 인스턴스를 반환한다. 최초 한 번만 초기화하고 이후에는 같은 Promise를 재사용한다.
export function getThorVG(): Promise<ThorVGModule> {
  if (!modulePromise) {
    modulePromise = initThorVG().catch((error) => {
      modulePromise = undefined;
      throw error;
    });
  }
  return modulePromise;
}
