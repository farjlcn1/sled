"use client";

export function MobileGroupRow({
  name,
  vehicleCount,
  expanded,
  onToggleExpand,
}: {
  name: string;
  vehicleCount: number;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggleExpand}
      className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left dark:border-gray-700 dark:bg-gray-800/60"
    >
      <span className="flex items-center gap-2">
        <span className="w-3 text-gray-400 dark:text-gray-500">{expanded ? "▾" : "▸"}</span>
        <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {vehicleCount} {vehicleCount === 1 ? "vozilo" : "vozil"}
      </span>
    </button>
  );
}
