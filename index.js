import { latestCallUsageProjection } from './projection.js';

export const inject = ['sessionProjections'];
export async function apply(ctx) {
  await ctx.sessionProjections.register(latestCallUsageProjection);
}
