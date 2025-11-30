const {
  lonLatToTile,
  tileToBounds,
  getTilesInBounds,
  generateTilingScheme,
  getResolution,
  getParentTile,
  getChildTiles,
  formatTilePath,
  bboxIntersects,
} = require('../src/tiling');

describe('Tiling utilities', () => {
  describe('lonLatToTile', () => {
    it('should convert lon/lat to tile coordinates at zoom 0', () => {
      const tile = lonLatToTile(0, 0, 0);
      expect(tile).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should convert lon/lat to tile coordinates at zoom 1', () => {
      const tile = lonLatToTile(-90, 0, 1);
      expect(tile.x).toBe(0);
      expect(tile.z).toBe(1);
    });

    it('should handle positive longitude', () => {
      const tile = lonLatToTile(90, 0, 1);
      expect(tile.x).toBe(1);
      expect(tile.z).toBe(1);
    });
  });

  describe('tileToBounds', () => {
    it('should return bounds for tile 0,0,0', () => {
      const bounds = tileToBounds(0, 0, 0);
      expect(bounds.minX).toBe(-180);
      expect(bounds.maxX).toBe(180);
      expect(bounds.minY).toBeCloseTo(-85.05, 1);
      expect(bounds.maxY).toBeCloseTo(85.05, 1);
    });

    it('should return valid bounds for zoom 1 tiles', () => {
      const bounds = tileToBounds(0, 0, 1);
      expect(bounds.minX).toBe(-180);
      expect(bounds.maxX).toBe(0);
    });
  });

  describe('getTilesInBounds', () => {
    it('should return tiles for global bounds at zoom 0', () => {
      const tiles = getTilesInBounds([-180, -85, 180, 85], 0);
      expect(tiles.length).toBeGreaterThanOrEqual(1);
      expect(tiles[0]).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should return 4 tiles for global bounds at zoom 1', () => {
      const tiles = getTilesInBounds([-180, -85, 180, 85], 1);
      expect(tiles.length).toBeGreaterThanOrEqual(4);
    });

    it('should return tiles for small region', () => {
      const tiles = getTilesInBounds([0, 0, 10, 10], 2);
      expect(tiles.length).toBeGreaterThan(0);
      tiles.forEach(tile => {
        expect(tile.z).toBe(2);
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('generateTilingScheme', () => {
    it('should generate scheme for zoom levels 0-2', () => {
      const scheme = generateTilingScheme([-10, -10, 10, 10], 0, 2);
      expect(scheme.minZoom).toBe(0);
      expect(scheme.maxZoom).toBe(2);
      expect(scheme.levels[0]).toBeDefined();
      expect(scheme.levels[1]).toBeDefined();
      expect(scheme.levels[2]).toBeDefined();
      expect(scheme.totalTiles).toBeGreaterThan(0);
    });

    it('should have increasing tile count at higher zoom', () => {
      const scheme = generateTilingScheme([-10, -10, 10, 10], 0, 3);
      expect(scheme.levels[3].length).toBeGreaterThanOrEqual(scheme.levels[2].length);
    });
  });

  describe('getResolution', () => {
    it('should return resolution at zoom 0', () => {
      const res = getResolution(0, 0, 256);
      expect(res).toBeGreaterThan(0);
    });

    it('should decrease resolution with higher zoom', () => {
      const res0 = getResolution(0, 0, 256);
      const res1 = getResolution(1, 0, 256);
      expect(res1).toBeLessThan(res0);
    });
  });

  describe('getParentTile', () => {
    it('should return null for zoom 0', () => {
      const parent = getParentTile({ x: 0, y: 0, z: 0 });
      expect(parent).toBeNull();
    });

    it('should return correct parent tile', () => {
      const parent = getParentTile({ x: 3, y: 2, z: 2 });
      expect(parent).toEqual({ x: 1, y: 1, z: 1 });
    });
  });

  describe('getChildTiles', () => {
    it('should return 4 child tiles', () => {
      const children = getChildTiles({ x: 1, y: 1, z: 1 });
      expect(children).toHaveLength(4);
      children.forEach(child => {
        expect(child.z).toBe(2);
      });
    });

    it('should have correct child coordinates', () => {
      const children = getChildTiles({ x: 0, y: 0, z: 0 });
      expect(children).toContainEqual({ x: 0, y: 0, z: 1 });
      expect(children).toContainEqual({ x: 1, y: 0, z: 1 });
      expect(children).toContainEqual({ x: 0, y: 1, z: 1 });
      expect(children).toContainEqual({ x: 1, y: 1, z: 1 });
    });
  });

  describe('formatTilePath', () => {
    it('should format as z/x/y by default', () => {
      const path = formatTilePath({ x: 5, y: 10, z: 3 });
      expect(path).toBe('3/5/10');
    });

    it('should format as x/y/z when specified', () => {
      const path = formatTilePath({ x: 5, y: 10, z: 3 }, 'xyz');
      expect(path).toBe('5/10/3');
    });
  });

  describe('bboxIntersects', () => {
    it('should detect overlapping boxes', () => {
      const bbox1 = [0, 0, 10, 10];
      const bbox2 = [5, 5, 15, 15];
      expect(bboxIntersects(bbox1, bbox2)).toBe(true);
    });

    it('should detect non-overlapping boxes', () => {
      const bbox1 = [0, 0, 10, 10];
      const bbox2 = [20, 20, 30, 30];
      expect(bboxIntersects(bbox1, bbox2)).toBe(false);
    });

    it('should detect contained boxes', () => {
      const bbox1 = [0, 0, 20, 20];
      const bbox2 = [5, 5, 15, 15];
      expect(bboxIntersects(bbox1, bbox2)).toBe(true);
    });

    it('should handle edge touching boxes', () => {
      const bbox1 = [0, 0, 10, 10];
      const bbox2 = [10, 0, 20, 10];
      expect(bboxIntersects(bbox1, bbox2)).toBe(true);
    });
  });
});
