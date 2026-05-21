/**
 * Prisma `select` presets for stable cross-cutting projections.
 * Spread these into a `.select` block so every consumer gets the same shape.
 */

export const userIdentitySelect = {
  id: true,
  name: true,
  numId: true,
  image: true,
} as const;
