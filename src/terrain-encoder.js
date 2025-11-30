const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

/**
 * @typedef {Object} TerrainTileData
 * @property {Buffer} buffer - Encoded tile data
 * @property {string} format - Format type ('heightmap' or 'quantized-mesh')
 * @property {Object} metadata - Tile metadata
 */

/**
 * Encode elevation data as a heightmap PNG (16-bit grayscale).
 * This format is suitable for Cesium's heightmap terrain provider.
 * 
 * @param {Float32Array|Float64Array} elevationData - Elevation values
 * @param {number} width - Width of the tile
 * @param {number} height - Height of the tile
 * @param {number} minElevation - Minimum elevation value for normalization
 * @param {number} maxElevation - Maximum elevation value for normalization
 * @returns {Promise<Buffer>} PNG buffer
 */
async function encodeHeightmapPNG(elevationData, width, height, minElevation, maxElevation) {
  // Convert elevation data to 16-bit unsigned integers
  // Map elevation range to 0-65535
  const range = maxElevation - minElevation;
  const uint16Data = new Uint16Array(width * height);
  
  for (let i = 0; i < elevationData.length; i++) {
    const normalized = range > 0 ? (elevationData[i] - minElevation) / range : 0;
    uint16Data[i] = Math.max(0, Math.min(65535, Math.round(normalized * 65535)));
  }
  
  // Convert to Buffer (big-endian for PNG)
  const buffer = Buffer.alloc(uint16Data.length * 2);
  for (let i = 0; i < uint16Data.length; i++) {
    buffer.writeUInt16BE(uint16Data[i], i * 2);
  }
  
  // Encode as PNG using sharp
  return sharp(buffer, {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Encode elevation data as a raw binary heightmap.
 * @param {Float32Array|Float64Array} elevationData - Elevation values
 * @returns {Buffer} Raw binary buffer
 */
function encodeRawHeightmap(elevationData) {
  const buffer = Buffer.alloc(elevationData.length * 4);
  
  for (let i = 0; i < elevationData.length; i++) {
    buffer.writeFloatLE(elevationData[i], i * 4);
  }
  
  return buffer;
}

/**
 * Resample elevation data to a target tile size using bilinear interpolation.
 * @param {Float32Array|Float64Array} sourceData - Source elevation data
 * @param {number} sourceWidth - Source width
 * @param {number} sourceHeight - Source height
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Float32Array} Resampled elevation data
 */
function resampleElevationData(sourceData, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const result = new Float32Array(targetWidth * targetHeight);
  
  const xRatio = sourceWidth / targetWidth;
  const yRatio = sourceHeight / targetHeight;
  
  for (let ty = 0; ty < targetHeight; ty++) {
    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = tx * xRatio;
      const sy = ty * yRatio;
      
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, sourceWidth - 1);
      const y1 = Math.min(y0 + 1, sourceHeight - 1);
      
      const xFrac = sx - x0;
      const yFrac = sy - y0;
      
      // Bilinear interpolation
      const v00 = sourceData[y0 * sourceWidth + x0];
      const v10 = sourceData[y0 * sourceWidth + x1];
      const v01 = sourceData[y1 * sourceWidth + x0];
      const v11 = sourceData[y1 * sourceWidth + x1];
      
      const v0 = v00 * (1 - xFrac) + v10 * xFrac;
      const v1 = v01 * (1 - xFrac) + v11 * xFrac;
      const value = v0 * (1 - yFrac) + v1 * yFrac;
      
      result[ty * targetWidth + tx] = value;
    }
  }
  
  return result;
}

/**
 * Extract a sub-region from elevation data.
 * @param {Float32Array|Float64Array} sourceData - Source elevation data
 * @param {number} sourceWidth - Source width
 * @param {number} x - X offset
 * @param {number} y - Y offset
 * @param {number} width - Region width
 * @param {number} height - Region height
 * @returns {Float32Array} Extracted region data
 */
function extractRegion(sourceData, sourceWidth, x, y, width, height) {
  const result = new Float32Array(width * height);
  
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const sourceIdx = (y + row) * sourceWidth + (x + col);
      const targetIdx = row * width + col;
      result[targetIdx] = sourceData[sourceIdx];
    }
  }
  
  return result;
}

/**
 * Write a terrain tile to disk.
 * @param {string} outputDir - Output directory
 * @param {number} z - Zoom level
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @param {Buffer} data - Tile data
 * @param {string} extension - File extension (default '.terrain')
 * @returns {Promise<string>} Path to written file
 */
async function writeTile(outputDir, z, x, y, data, extension = '.terrain') {
  const tilePath = path.join(outputDir, String(z), String(x));
  await fs.ensureDir(tilePath);
  
  const filePath = path.join(tilePath, `${y}${extension}`);
  await fs.writeFile(filePath, data);
  
  return filePath;
}

/**
 * Generate a simple quantized-mesh format tile (simplified version).
 * This is a basic implementation - production use would require full quantized-mesh spec.
 * 
 * @param {Float32Array} elevationData - Elevation values
 * @param {number} width - Tile width
 * @param {number} height - Tile height
 * @param {Object} bounds - Tile geographic bounds
 * @returns {Buffer} Quantized-mesh formatted data
 */
function encodeQuantizedMesh(elevationData, width, height, bounds) {
  // This is a simplified stub for quantized-mesh format
  // A full implementation would require:
  // - Vertex quantization
  // - Triangle indices
  // - Edge indices
  // - Vertex normals
  // - Water mask
  // - Metadata
  
  // For now, return a simple header + height data
  const headerSize = 88; // Simplified header
  const vertexCount = width * height;
  const buffer = Buffer.alloc(headerSize + vertexCount * 2);
  
  // Write header (simplified)
  let offset = 0;
  
  // Center coordinates (doubles)
  buffer.writeDoubleLE((bounds.minX + bounds.maxX) / 2, offset); offset += 8;
  buffer.writeDoubleLE((bounds.minY + bounds.maxY) / 2, offset); offset += 8;
  buffer.writeDoubleLE(0, offset); offset += 8; // Elevation (placeholder)
  
  // Min/max height
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let i = 0; i < elevationData.length; i++) {
    minHeight = Math.min(minHeight, elevationData[i]);
    maxHeight = Math.max(maxHeight, elevationData[i]);
  }
  
  buffer.writeFloatLE(minHeight, offset); offset += 4;
  buffer.writeFloatLE(maxHeight, offset); offset += 4;
  
  // Bounding sphere (simplified)
  buffer.writeDoubleLE((bounds.minX + bounds.maxX) / 2, offset); offset += 8;
  buffer.writeDoubleLE((bounds.minY + bounds.maxY) / 2, offset); offset += 8;
  buffer.writeDoubleLE(0, offset); offset += 8;
  buffer.writeDoubleLE(1000000, offset); offset += 8; // Radius (placeholder)
  
  // Horizon occlusion point (simplified)
  buffer.writeDoubleLE(0, offset); offset += 8;
  buffer.writeDoubleLE(0, offset); offset += 8;
  buffer.writeDoubleLE(0, offset); offset += 8;
  
  // Vertex data (quantized heights)
  const heightRange = maxHeight - minHeight;
  for (let i = 0; i < vertexCount; i++) {
    const normalized = heightRange > 0 ? (elevationData[i] - minHeight) / heightRange : 0;
    const quantized = Math.round(normalized * 32767);
    buffer.writeInt16LE(quantized, offset);
    offset += 2;
  }
  
  return buffer;
}

module.exports = {
  encodeHeightmapPNG,
  encodeRawHeightmap,
  encodeQuantizedMesh,
  resampleElevationData,
  extractRegion,
  writeTile,
};
