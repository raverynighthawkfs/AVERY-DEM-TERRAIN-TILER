const fs = require('fs-extra');
const { fromFile } = require('geotiff');

/**
 * @typedef {Object} DEMMetadata
 * @property {string} path - Path to the DEM file
 * @property {number} width - Width of the raster in pixels
 * @property {number} height - Height of the raster in pixels
 * @property {Array<number>} bbox - Bounding box [minX, minY, maxX, maxY]
 * @property {Array<number>} resolution - Resolution [xRes, yRes] in units
 * @property {number} [noDataValue] - No data value (if specified)
 * @property {string} [projection] - Projection information (if available)
 * @property {Object} origin - Origin point {x, y}
 * @property {number} minElevation - Minimum elevation value
 * @property {number} maxElevation - Maximum elevation value
 * @property {string} dataType - Data type of the raster (e.g., 'Float32', 'Int16')
 */

/**
 * Read metadata from a GeoTIFF DEM file.
 * @param {string} inputPath - Path to the GeoTIFF file
 * @returns {Promise<DEMMetadata>} DEM metadata
 */
async function readDEMMetadata(inputPath) {
  // Verify file exists
  const exists = await fs.pathExists(inputPath);
  if (!exists) {
    throw new Error(`DEM file not found: ${inputPath}`);
  }

  // Open GeoTIFF
  const tiff = await fromFile(inputPath);
  const image = await tiff.getImage();
  
  // Get basic dimensions
  const width = image.getWidth();
  const height = image.getHeight();
  
  // Get bounding box from GeoTIFF
  const bbox = image.getBoundingBox();
  
  // Calculate resolution
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  
  // Get sample format and bits per sample
  const sampleFormat = image.getSampleFormat();
  const bitsPerSample = image.getBitsPerSample();
  const dataType = getDataTypeName(sampleFormat[0], bitsPerSample[0]);
  
  // Read GeoKeys for projection info
  const geoKeys = image.getGeoKeys();
  const projection = geoKeys ? formatProjectionInfo(geoKeys) : 'Unknown';
  
  // Get GDAL metadata if available
  const fileDirectory = image.fileDirectory;
  const noDataValue = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : undefined;
  
  // Read a sample of the data to determine min/max elevation
  // For performance, we'll sample the data rather than read everything
  const rasters = await image.readRasters();
  const elevationData = rasters[0]; // First band
  
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  
  for (let i = 0; i < elevationData.length; i++) {
    const value = elevationData[i];
    if (noDataValue !== undefined && value === noDataValue) {
      continue; // Skip no-data values
    }
    if (value < minElevation) minElevation = value;
    if (value > maxElevation) maxElevation = value;
  }
  
  return {
    path: inputPath,
    width,
    height,
    bbox,
    resolution: [Math.abs(resX), Math.abs(resY)],
    noDataValue,
    projection,
    origin: { x: originX, y: originY },
    minElevation: minElevation === Infinity ? 0 : minElevation,
    maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
    dataType,
  };
}

/**
 * Read elevation data from a GeoTIFF DEM file.
 * @param {string} inputPath - Path to the GeoTIFF file
 * @returns {Promise<{data: TypedArray, metadata: DEMMetadata}>} Elevation data and metadata
 */
async function readDEMData(inputPath) {
  const metadata = await readDEMMetadata(inputPath);
  
  const tiff = await fromFile(inputPath);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  
  return {
    data: rasters[0], // First band contains elevation data
    metadata,
  };
}

/**
 * Format projection information from GeoKeys.
 * @param {Object} geoKeys - GeoKeys from GeoTIFF
 * @returns {string} Formatted projection string
 */
function formatProjectionInfo(geoKeys) {
  const parts = [];
  
  if (geoKeys.GTModelTypeGeoKey) {
    const modelType = geoKeys.GTModelTypeGeoKey;
    parts.push(modelType === 1 ? 'Projected' : modelType === 2 ? 'Geographic' : 'Geocentric');
  }
  
  if (geoKeys.ProjectedCSTypeGeoKey) {
    parts.push(`EPSG:${geoKeys.ProjectedCSTypeGeoKey}`);
  } else if (geoKeys.GeographicTypeGeoKey) {
    parts.push(`EPSG:${geoKeys.GeographicTypeGeoKey}`);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'Unknown';
}

/**
 * Get human-readable data type name.
 * @param {number} sampleFormat - Sample format code
 * @param {number} bitsPerSample - Bits per sample
 * @returns {string} Data type name
 */
function getDataTypeName(sampleFormat, bitsPerSample) {
  // sampleFormat: 1=uint, 2=int, 3=float
  const typeMap = {
    1: { 8: 'UInt8', 16: 'UInt16', 32: 'UInt32' },
    2: { 8: 'Int8', 16: 'Int16', 32: 'Int32' },
    3: { 32: 'Float32', 64: 'Float64' },
  };
  
  return typeMap[sampleFormat]?.[bitsPerSample] || `Unknown(${sampleFormat},${bitsPerSample})`;
}

/**
 * Format metadata for display.
 * @param {DEMMetadata} metadata - DEM metadata
 * @returns {string} Formatted metadata string
 */
function formatMetadata(metadata) {
  const lines = [
    '=== DEM Metadata ===',
    `File: ${metadata.path}`,
    `Dimensions: ${metadata.width} x ${metadata.height} pixels`,
    `Data Type: ${metadata.dataType}`,
    '',
    'Geographic Extent:',
    `  Min X: ${metadata.bbox[0].toFixed(6)}`,
    `  Min Y: ${metadata.bbox[1].toFixed(6)}`,
    `  Max X: ${metadata.bbox[2].toFixed(6)}`,
    `  Max Y: ${metadata.bbox[3].toFixed(6)}`,
    '',
    'Resolution:',
    `  X: ${metadata.resolution[0].toFixed(6)} units/pixel`,
    `  Y: ${metadata.resolution[1].toFixed(6)} units/pixel`,
    '',
    'Elevation Range:',
    `  Minimum: ${metadata.minElevation.toFixed(2)} m`,
    `  Maximum: ${metadata.maxElevation.toFixed(2)} m`,
    `  Range: ${(metadata.maxElevation - metadata.minElevation).toFixed(2)} m`,
    '',
    `Projection: ${metadata.projection}`,
  ];
  
  if (metadata.noDataValue !== undefined) {
    lines.push(`No Data Value: ${metadata.noDataValue}`);
  }
  
  return lines.join('\n');
}

module.exports = {
  readDEMMetadata,
  readDEMData,
  formatMetadata,
};
