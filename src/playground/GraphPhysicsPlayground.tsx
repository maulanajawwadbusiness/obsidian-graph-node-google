import React from 'react';
import { GraphPhysicsPlaygroundContainer } from './modules/GraphPhysicsPlaygroundContainer';
import type { GraphPhysicsPlaygroundProps } from './modules/graphPhysicsTypes';

export const GraphPhysicsPlayground: React.FC<GraphPhysicsPlaygroundProps> = (props) => (
  <GraphPhysicsPlaygroundContainer {...props} />
);
