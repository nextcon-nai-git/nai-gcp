"use client";

import React from "react";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (index: number, item: T) => React.ReactNode;
  className?: string;
  maxHeight?: string | number;
}

/**
 * Componente para renderizar listas grandes com virtualization.
 * Apenas items visíveis são renderizados, melhorando performance drasticamente.
 *
 * @example
 * ```tsx
 * <VirtualizedList
 *   items={appointments}
 *   itemHeight={80}
 *   renderItem={(idx, appointment) => <AppointmentCard {...appointment} />}
 *   maxHeight={600}
 * />
 * ```
 */
export function VirtualizedList<T extends { id: string }>(
  { items, itemHeight, renderItem, className, maxHeight = 600 }: VirtualizedListProps<T>
) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style} key={items[index]?.id}>
      {renderItem(index, items[index])}
    </div>
  );

  return (
    <div className={className} style={{ height: maxHeight, width: "100%" }}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            itemCount={items.length}
            itemSize={itemHeight}
            width={width}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
