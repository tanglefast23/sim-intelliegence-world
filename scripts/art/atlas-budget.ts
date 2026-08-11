import {
  ART_CATEGORY_IDS,
  type ArtCategoryId,
  type ArtManifest,
} from './art-manifest';
import { packAtlasRectangles, type AtlasPackInput } from './atlas-pack';

export type BudgetCell = AtlasPackInput & Readonly<{ category: ArtCategoryId }>;

export type AtlasBudgetReport = Readonly<{
  schemaVersion: 1;
  artRevision: number;
  categories: Readonly<Record<ArtCategoryId, Readonly<{
    actualCount: number;
    maximumCount: number;
    rawRectangleArea: number;
  }>>>;
  actual: Readonly<{
    cellCount: number;
    rawRectangleArea: number;
    width: number;
    height: number;
    boundingRectangleArea: number;
    occupancy: number;
  }>;
  forecast: Readonly<{
    cellCount: number;
    rawRectangleArea: number;
    rawAreaRatio: number;
    width: number;
    height: number;
    boundingRectangleArea: number;
    packedAreaRatio: number;
    occupancy: number;
  }>;
  largestCells: readonly Readonly<{ id: string; category: ArtCategoryId; width: number; height: number; rawRectangleArea: number }>[];
}>;

function rectangleArea(cell: AtlasPackInput, gutter: number): number {
  return (cell.width + gutter * 2) * (cell.height + gutter * 2);
}

export function createAtlasBudgetReport(
  cells: readonly BudgetCell[],
  manifest: ArtManifest,
): AtlasBudgetReport {
  const { gutter, maximumHeight, maximumPackedAreaRatio, maximumRawAreaRatio, maximumWidth } = manifest.limits;
  const actualCounts = Object.fromEntries(ART_CATEGORY_IDS.map((category) => [
    category,
    cells.filter((cell) => cell.category === category).length,
  ])) as Record<ArtCategoryId, number>;
  for (const category of ART_CATEGORY_IDS) {
    const count = actualCounts[category];
    const maximumCount = manifest.categories[category].maximumCount;
    if (count > maximumCount) {
      throw new Error(`Atlas category ${category} has ${count} cells; reduce it to ${maximumCount} or fewer.`);
    }
  }

  const actualPack = packAtlasRectangles(cells, { maximumWidth, maximumHeight, gutter });
  const forecastCells: BudgetCell[] = [...cells];
  for (const category of ART_CATEGORY_IDS) {
    const rule = manifest.categories[category];
    for (let index = actualCounts[category]; index < rule.maximumCount; index += 1) {
      forecastCells.push({
        id: `__forecast.${category}.${index.toString().padStart(3, '0')}`,
        category,
        width: rule.width,
        height: rule.height,
      });
    }
  }
  const forecastPack = packAtlasRectangles(forecastCells, {
    maximumWidth,
    maximumHeight,
    gutter,
    candidateWidths: [maximumWidth],
  });
  const capacityArea = maximumWidth * maximumHeight;
  const actualRawArea = cells.reduce((sum, cell) => sum + rectangleArea(cell, gutter), 0);
  const forecastRawArea = forecastCells.reduce((sum, cell) => sum + rectangleArea(cell, gutter), 0);
  const forecastRawRatio = forecastRawArea / capacityArea;
  const forecastPackedArea = forecastPack.width * forecastPack.height;
  const forecastPackedRatio = forecastPackedArea / capacityArea;
  if (forecastRawRatio > maximumRawAreaRatio) {
    throw new Error(`Atlas forecast raw area is ${(forecastRawRatio * 100).toFixed(1)}%; reduce transition sets, optional variants, or micro-decals.`);
  }
  if (forecastPackedRatio > maximumPackedAreaRatio) {
    throw new Error(`Atlas forecast packed area is ${(forecastPackedRatio * 100).toFixed(1)}%; reduce transition sets, optional variants, or micro-decals.`);
  }
  const categories = Object.fromEntries(ART_CATEGORY_IDS.map((category) => {
    const categoryCells = cells.filter((cell) => cell.category === category);
    return [category, {
      actualCount: categoryCells.length,
      maximumCount: manifest.categories[category].maximumCount,
      rawRectangleArea: categoryCells.reduce((sum, cell) => sum + rectangleArea(cell, gutter), 0),
    }];
  })) as AtlasBudgetReport['categories'];
  return {
    schemaVersion: 1,
    artRevision: manifest.artRevision,
    categories,
    actual: {
      cellCount: cells.length,
      rawRectangleArea: actualRawArea,
      width: actualPack.width,
      height: actualPack.height,
      boundingRectangleArea: actualPack.width * actualPack.height,
      occupancy: actualRawArea / (actualPack.width * actualPack.height),
    },
    forecast: {
      cellCount: forecastCells.length,
      rawRectangleArea: forecastRawArea,
      rawAreaRatio: forecastRawRatio,
      width: forecastPack.width,
      height: forecastPack.height,
      boundingRectangleArea: forecastPackedArea,
      packedAreaRatio: forecastPackedRatio,
      occupancy: forecastRawArea / forecastPackedArea,
    },
    largestCells: [...cells]
      .sort((left, right) => {
        const areaDifference = rectangleArea(right, gutter) - rectangleArea(left, gutter);
        if (areaDifference !== 0) return areaDifference;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      })
      .slice(0, 12)
      .map((cell) => ({
        id: cell.id,
        category: cell.category,
        width: cell.width,
        height: cell.height,
        rawRectangleArea: rectangleArea(cell, gutter),
      })),
  };
}
