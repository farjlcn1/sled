"use client";

export function GroupRow({
  groupId,
  name,
  vehicleCount,
  expanded,
  onToggleExpand,
  onContextMenu,
}: {
  groupId: string;
  name: string;
  vehicleCount: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onContextMenu: (groupId: string, x: number, y: number) => void;
}) {
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onContextMenu(groupId, e.clientX, e.clientY);
  }

  return (
    <tr
      onDoubleClick={onToggleExpand}
      onContextMenu={handleContextMenu}
      title="Dvoklik za prikaz vozil v skupini, desni klik za zgodovino celotne skupine"
      className="cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800"
    >
      <td colSpan={2} className="px-3 py-2 text-sm">
        <span className="mr-1 inline-block w-3 text-gray-400 dark:text-gray-500">{expanded ? "▾" : "▸"}</span>
        <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          ({vehicleCount} {vehicleCount === 1 ? "vozilo" : "vozil"})
        </span>
      </td>
    </tr>
  );
}
