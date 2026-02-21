export type SkeletonHydrationNode = {
  id: string;
};

export type SkeletonPosition = {
  x: number;
  y: number;
};

export function hydrateSkeletonNodePositions(args: {
  nodes: SkeletonHydrationNode[];
  initialPositions: Record<string, SkeletonPosition>;
  spacing: number;
}): Record<string, SkeletonPosition> {
  const result: Record<string, SkeletonPosition> = {};
  for (let index = 0; index < args.nodes.length; index += 1) {
    const node = args.nodes[index];
    const pos = args.initialPositions[node.id];
    if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) {
      result[node.id] = { x: pos.x, y: pos.y };
      continue;
    }
    const fallbackAngle = (Math.PI * 2 * index) / Math.max(1, args.nodes.length);
    result[node.id] = {
      x: Number((Math.cos(fallbackAngle) * args.spacing).toFixed(6)),
      y: Number((Math.sin(fallbackAngle) * args.spacing).toFixed(6))
    };
  }
  return result;
}
