/**
 * Confidence badge tier mapping and utilities for Mission Intake
 * Per new_docs/ux.md §5.1 and new_docs/todo.md Gate G-B requirements
 */

export type ConfidenceTier = 'green' | 'amber' | 'red';

export type ConfidenceBadgeData = {
  tier: ConfidenceTier;
  label: string;
  color: string;
  bgColor: string;
  tooltipText: string;
};

/**
 * Map numeric confidence to badge tier
 * - green: ≥0.75
 * - amber: 0.4–0.74
 * - red: <0.4
 */
export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.75) return 'green';
  if (confidence >= 0.4) return 'amber';
  return 'red';
}

/**
 * Get badge display data for a given confidence score
 */
export function getConfidenceBadgeData(
  confidence: number,
  regenerationCount?: number,
  lastRegeneratedAt?: Date,
): ConfidenceBadgeData {
  const tier = getConfidenceTier(confidence);

  // Base tooltip explaining the score
  let tooltipText = '';

  switch (tier) {
    case 'green':
      tooltipText = `High confidence (${Math.round(confidence * 100)}%). This field was generated with strong certainty.`;
      break;
    case 'amber':
      tooltipText = `Medium confidence (${Math.round(confidence * 100)}%). You may want to review and refine this field.`;
      break;
    case 'red':
      tooltipText = `Low confidence (${Math.round(confidence * 100)}%). Please review carefully or regenerate.`;
      break;
  }

  // Add regeneration history if available
  if (regenerationCount !== undefined && regenerationCount > 0) {
    tooltipText += ` Regenerated ${regenerationCount} time${regenerationCount === 1 ? '' : 's'}.`;
  }

  // Add timestamp if available
  if (lastRegeneratedAt) {
    const timeAgo = formatTimeAgo(lastRegeneratedAt);
    tooltipText += ` Last updated ${timeAgo}.`;
  }

  return {
    tier,
    label: tier === 'green' ? 'High confidence' : tier === 'amber' ? 'Medium confidence' : 'Low confidence',
    color: tier === 'green' ? 'text-emerald-300' : tier === 'amber' ? 'text-amber-300' : 'text-red-300',
    bgColor: tier === 'green' ? 'bg-emerald-500/20' : tier === 'amber' ? 'bg-amber-500/20' : 'bg-red-500/20',
    tooltipText,
  };
}

/**
 * Format timestamp as human-readable time ago
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
