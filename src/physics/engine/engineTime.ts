export const getNowMs = () =>
    (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
