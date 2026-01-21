/**
 * Group Tier System - Persistent tier tracking based on weekly group completion rate
 *
 * Tiers are always active and update weekly based on group performance.
 * This is independent from challenges (challenges are optional competitions).
 */

export type TierName =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND_I"
  | "DIAMOND_II"
  | "DIAMOND_III"
  | "DIAMOND_IV"
  | "DIAMOND_V"

export interface TierInfo {
  name: TierName
  displayName: string
  minCompletionRate: number // 0-100
  maxCompletionRate: number // 0-100
  color: string // Tailwind color class
  iconColor: string
  bgClass: string
  borderClass: string
  textClass: string
}

/**
 * Tier configuration with completion rate thresholds
 */
export const TIER_THRESHOLDS: TierInfo[] = [
  {
    name: "BRONZE",
    displayName: "Bronze",
    minCompletionRate: 0,
    maxCompletionRate: 49.99,
    color: "amber",
    iconColor: "#d97706",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    textClass: "text-amber-700 dark:text-amber-500",
  },
  {
    name: "SILVER",
    displayName: "Silver",
    minCompletionRate: 50,
    maxCompletionRate: 59.99,
    color: "slate",
    iconColor: "#64748b",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/20",
    textClass: "text-slate-700 dark:text-slate-400",
  },
  {
    name: "GOLD",
    displayName: "Gold",
    minCompletionRate: 60,
    maxCompletionRate: 69.99,
    color: "yellow",
    iconColor: "#ca8a04",
    bgClass: "bg-yellow-500/10",
    borderClass: "border-yellow-500/20",
    textClass: "text-yellow-700 dark:text-yellow-500",
  },
  {
    name: "PLATINUM",
    displayName: "Platinum",
    minCompletionRate: 70,
    maxCompletionRate: 79.99,
    color: "cyan",
    iconColor: "#0891b2",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/20",
    textClass: "text-cyan-700 dark:text-cyan-400",
  },
  {
    name: "DIAMOND_I",
    displayName: "Diamond I",
    minCompletionRate: 80,
    maxCompletionRate: 84.99,
    color: "violet",
    iconColor: "#7c3aed",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
    textClass: "text-violet-700 dark:text-violet-400",
  },
  {
    name: "DIAMOND_II",
    displayName: "Diamond II",
    minCompletionRate: 85,
    maxCompletionRate: 89.99,
    color: "violet",
    iconColor: "#7c3aed",
    bgClass: "bg-violet-500/15",
    borderClass: "border-violet-500/30",
    textClass: "text-violet-700 dark:text-violet-400",
  },
  {
    name: "DIAMOND_III",
    displayName: "Diamond III",
    minCompletionRate: 90,
    maxCompletionRate: 94.99,
    color: "violet",
    iconColor: "#7c3aed",
    bgClass: "bg-violet-500/20",
    borderClass: "border-violet-500/40",
    textClass: "text-violet-700 dark:text-violet-400",
  },
  {
    name: "DIAMOND_IV",
    displayName: "Diamond IV",
    minCompletionRate: 95,
    maxCompletionRate: 99.99,
    color: "violet",
    iconColor: "#7c3aed",
    bgClass: "bg-violet-500/25",
    borderClass: "border-violet-500/50",
    textClass: "text-violet-700 dark:text-violet-400",
  },
  {
    name: "DIAMOND_V",
    displayName: "Diamond V",
    minCompletionRate: 100,
    maxCompletionRate: 100,
    color: "violet",
    iconColor: "#7c3aed",
    bgClass: "bg-violet-500/30",
    borderClass: "border-violet-500/60",
    textClass: "text-violet-700 dark:text-violet-400",
  },
]

/**
 * Calculate which tier a group should be in based on completion rate
 */
export function calculateTierFromCompletionRate(completionRate: number): TierInfo {
  // Clamp completion rate to 0-100
  const rate = Math.max(0, Math.min(100, completionRate))

  // Find matching tier
  const tier = TIER_THRESHOLDS.find(
    (t) => rate >= t.minCompletionRate && rate <= t.maxCompletionRate
  )

  // Default to Bronze if no match (shouldn't happen)
  return tier || TIER_THRESHOLDS[0]
}

/**
 * Get tier info by tier name
 */
export function getTierInfo(tierName: TierName): TierInfo {
  const tier = TIER_THRESHOLDS.find((t) => t.name === tierName)
  return tier || TIER_THRESHOLDS[0]
}

/**
 * Get the next tier (for showing progression goals)
 */
export function getNextTier(currentTierName: TierName): TierInfo | null {
  const currentIndex = TIER_THRESHOLDS.findIndex((t) => t.name === currentTierName)
  if (currentIndex === -1 || currentIndex === TIER_THRESHOLDS.length - 1) {
    return null // Already at max tier
  }
  return TIER_THRESHOLDS[currentIndex + 1]
}

/**
 * Check if a tier was upgraded (for celebration/notifications)
 */
export function wasTierUpgraded(oldTier: TierName, newTier: TierName): boolean {
  const oldIndex = TIER_THRESHOLDS.findIndex((t) => t.name === oldTier)
  const newIndex = TIER_THRESHOLDS.findIndex((t) => t.name === newTier)
  return newIndex > oldIndex
}

/**
 * Format completion rate for display
 */
export function formatCompletionRate(rate: number): string {
  return `${Math.round(rate)}%`
}
