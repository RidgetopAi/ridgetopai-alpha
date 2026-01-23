/**
 * GoalProgressBar - Visual progress indicator for goals
 * Phase 3: Goal Management UI
 */

interface GoalProgressBarProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * Get color based on progress percentage
 */
function getProgressColor(progress: number): string {
  if (progress >= 100) return 'bg-green-500';
  if (progress >= 75) return 'bg-green-400';
  if (progress >= 50) return 'bg-blue-400';
  if (progress >= 25) return 'bg-yellow-400';
  return 'bg-zinc-500';
}

/**
 * Get height class based on size
 */
function getSizeClass(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'h-1.5';
    case 'md':
      return 'h-2';
    case 'lg':
      return 'h-3';
    default:
      return 'h-2';
  }
}

export function GoalProgressBar({
  progress,
  size = 'md',
  showLabel = false,
  className = '',
}: GoalProgressBarProps) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const progressColor = getProgressColor(clampedProgress);
  const sizeClass = getSizeClass(size);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-zinc-400">Progress</span>
          <span className="text-xs text-zinc-300 font-medium">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
      <div className={`w-full bg-zinc-700 rounded-full overflow-hidden ${sizeClass}`}>
        <div
          className={`${progressColor} ${sizeClass} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Compact progress indicator for cards and lists
 */
export function GoalProgressIndicator({
  progress,
  size = 24,
}: {
  progress: number;
  size?: number;
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedProgress / 100) * circumference;

  const getStrokeColor = (progress: number): string => {
    if (progress >= 100) return '#22c55e'; // green-500
    if (progress >= 75) return '#4ade80'; // green-400
    if (progress >= 50) return '#60a5fa'; // blue-400
    if (progress >= 25) return '#facc15'; // yellow-400
    return '#71717a'; // zinc-500
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#3f3f46" // zinc-700
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getStrokeColor(clampedProgress)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300 ease-out"
        />
      </svg>
      <span className="absolute text-[9px] font-semibold text-zinc-300">
        {Math.round(clampedProgress)}
      </span>
    </div>
  );
}
