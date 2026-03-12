import { Injectable } from '@angular/core';

export interface MasonryItem {
  id: string;
  width: number;
  height: number;
}

export interface MasonryLayout {
  itemPositions: Record<string, { left: number; top: number; width: number; height: number }>;
  totalHeight: number;
}

/**
 * Pure, stateless service for computing justified masonry grid layouts.
 *
 * Packs items into rows so that every row fills the full container width,
 * similar to Google Photos or Flickr's justified-grid layout.
 *
 * Algorithm:
 *  1. Accumulate items into a pending row buffer one by one.
 *  2. After each addition, compute how wide the row would be at TARGET_ROW_HEIGHT.
 *  3. Once natural width ≥ container width the row is "full": scale heights
 *     uniformly so the row fills the container exactly.
 *  4. The final short row keeps TARGET_ROW_HEIGHT to avoid over-stretching.
 */
@Injectable({ providedIn: 'root' })
export class MasonryLayoutService {
  private readonly ITEM_GAP = 6;
  private readonly TARGET_ROW_HEIGHT = 280;

  computeLayout(items: MasonryItem[], containerWidth: number): MasonryLayout {
    if (!containerWidth || items.length === 0) {
      return { itemPositions: {}, totalHeight: 0 };
    }

    const { ITEM_GAP, TARGET_ROW_HEIGHT } = this;
    const positions: Record<string, { left: number; top: number; width: number; height: number }> = {};
    let nextRowTop = 0;

    const ar = (item: MasonryItem) =>
      item.width > 0 && item.height > 0 ? item.width / item.height : 4 / 3;

    const commitRow = (row: MasonryItem[], rowHeight: number) => {
      let x = 0;
      for (const item of row) {
        const w = rowHeight * ar(item);
        positions[item.id] = { left: x, top: nextRowTop, width: w, height: rowHeight };
        x += w + ITEM_GAP;
      }
      nextRowTop += rowHeight + ITEM_GAP;
    };

    let pending: MasonryItem[] = [];
    for (let i = 0; i < items.length; i++) {
      pending.push(items[i]);
      const combinedAR = pending.reduce((s, p) => s + ar(p), 0);
      const naturalWidth = combinedAR * TARGET_ROW_HEIGHT + ITEM_GAP * (pending.length - 1);
      const isLast = i === items.length - 1;

      if (naturalWidth >= containerWidth || isLast) {
        const rowHeight =
          isLast && naturalWidth < containerWidth
            ? TARGET_ROW_HEIGHT
            : (containerWidth - ITEM_GAP * (pending.length - 1)) / combinedAR;
        commitRow(pending, rowHeight);
        pending = [];
      }
    }

    return { itemPositions: positions, totalHeight: nextRowTop > 0 ? nextRowTop - ITEM_GAP : 0 };
  }
}
