"use client";

import { List, type RowComponentProps } from "react-window";
import type { CSSProperties, ReactNode } from "react";

interface VirtualizedRowProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
}

interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}

function VirtualizedRow<T>({
  index,
  style,
  items,
  renderItem,
}: RowComponentProps<VirtualizedRowProps<T>>) {
  return (
    <div style={style as CSSProperties} role="listitem">
      {renderItem(items[index], index)}
    </div>
  );
}

export function VirtualizedList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className,
}: VirtualizedListProps<T>) {
  if (items.length === 0) return null;

  return (
    <List
      aria-label="Virtualized list"
      role="list"
      className={className}
      defaultHeight={height}
      overscanCount={3}
      rowComponent={VirtualizedRow<T>}
      rowCount={items.length}
      rowHeight={itemHeight}
      rowProps={{ items, renderItem }}
      style={{ width: "100%", height }}
    />
  );
}
