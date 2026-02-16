import React from 'react';
import { GraphPhysicsPlaygroundContainer } from './modules/GraphPhysicsPlaygroundContainer';
import type { GraphPhysicsPlaygroundProps } from './modules/graphPhysicsTypes';

const DEBUG_WARM_MOUNT_QUERY_KEY = 'debugWarmMount';
let nextWarmMountId = 1;

function isWarmMountDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(DEBUG_WARM_MOUNT_QUERY_KEY) === '1';
}

export const GraphPhysicsPlayground: React.FC<GraphPhysicsPlaygroundProps> = (props) => {
  const mountIdRef = React.useRef<number>(nextWarmMountId++);

  React.useEffect(() => {
    if (!isWarmMountDebugEnabled()) return;
    console.log('[WarmMount] graph_runtime_mounted mountId=%d', mountIdRef.current);
  }, []);

  return <GraphPhysicsPlaygroundContainer {...props} />;
};
