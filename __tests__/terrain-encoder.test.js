const {
  resampleElevationData,
  extractRegion,
  encodeRawHeightmap,
} = require('../src/terrain-encoder');

describe('Terrain encoder utilities', () => {
  describe('resampleElevationData', () => {
    it('should resample 2x2 to 4x4', () => {
      const source = new Float32Array([
        1, 2,
        3, 4
      ]);
      
      const result = resampleElevationData(source, 2, 2, 4, 4);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(16);
      // First value should be close to source
      expect(result[0]).toBeCloseTo(1, 1);
    });

    it('should downsample 4x4 to 2x2', () => {
      const source = new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
      ]);
      
      const result = resampleElevationData(source, 4, 4, 2, 2);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(4);
      // Values should be interpolated
      expect(result[0]).toBeGreaterThan(0);
    });

    it('should handle same size (no resampling)', () => {
      const source = new Float32Array([1, 2, 3, 4]);
      const result = resampleElevationData(source, 2, 2, 2, 2);
      
      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(1, 5);
      expect(result[3]).toBeCloseTo(4, 5);
    });
  });

  describe('extractRegion', () => {
    it('should extract top-left corner', () => {
      const source = new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
      ]);
      
      const result = extractRegion(source, 4, 0, 0, 2, 2);
      
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(4);
      expect(Array.from(result)).toEqual([1, 2, 5, 6]);
    });

    it('should extract bottom-right corner', () => {
      const source = new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
      ]);
      
      const result = extractRegion(source, 4, 2, 2, 2, 2);
      
      expect(result.length).toBe(4);
      expect(Array.from(result)).toEqual([11, 12, 15, 16]);
    });

    it('should extract middle region', () => {
      const source = new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
      ]);
      
      const result = extractRegion(source, 4, 1, 1, 2, 2);
      
      expect(result.length).toBe(4);
      expect(Array.from(result)).toEqual([6, 7, 10, 11]);
    });

    it('should handle single pixel extraction', () => {
      const source = new Float32Array([1, 2, 3, 4]);
      const result = extractRegion(source, 2, 1, 1, 1, 1);
      
      expect(result.length).toBe(1);
      expect(result[0]).toBe(4);
    });
  });

  describe('encodeRawHeightmap', () => {
    it('should encode elevation data as binary', () => {
      const data = new Float32Array([100, 200, 300, 400]);
      const buffer = encodeRawHeightmap(data);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(16); // 4 floats * 4 bytes
      
      // Verify first value
      expect(buffer.readFloatLE(0)).toBeCloseTo(100, 2);
      expect(buffer.readFloatLE(4)).toBeCloseTo(200, 2);
    });

    it('should handle single value', () => {
      const data = new Float32Array([42.5]);
      const buffer = encodeRawHeightmap(data);
      
      expect(buffer.length).toBe(4);
      expect(buffer.readFloatLE(0)).toBeCloseTo(42.5, 2);
    });

    it('should handle negative elevations', () => {
      const data = new Float32Array([-100, 0, 100]);
      const buffer = encodeRawHeightmap(data);
      
      expect(buffer.length).toBe(12);
      expect(buffer.readFloatLE(0)).toBeCloseTo(-100, 2);
      expect(buffer.readFloatLE(4)).toBeCloseTo(0, 2);
      expect(buffer.readFloatLE(8)).toBeCloseTo(100, 2);
    });
  });
});
