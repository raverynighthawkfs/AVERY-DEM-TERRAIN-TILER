/**
 * Tiling and quadtree utilities for terrain tile generation.
 * Implements TMS (Tile Map Service) tiling scheme compatible with Cesium.
 */

const EARTH_RADIUS = 6378137.0; // WGS84 equatorial radius in meters
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS;

/**
 * @typedef {Object} TileCoordinate
 * @property {number} x - Tile X coordinate
 * @property {number} y - Tile Y coordinate
 * @property {number} z - Zoom level
 */

/**
 * @typedef {Object} TileBounds
 * @property {number} minX - Minimum longitude
 * @property {number} minY - Minimum latitude
 * @property {number} maxX - Maximum longitude
 * @property {number} maxY - Maximum latitude
 */

/**
 * Convert geographic coordinates (lon/lat) to tile coordinates at a given zoom level.
 * @param {number} lon - Longitude in degrees
 * @param {number} lat - Latitude in degrees
 * @param {number} zoom - Zoom level
 * @returns {TileCoordinate} Tile coordinate
 */
function lonLatToTile(lon, lat, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  
  return { x, y, z: zoom };
}

/**
 * Get the geographic bounds of a tile.
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @param {number} zoom - Zoom level
 * @returns {TileBounds} Geographic bounds of the tile
 */
function tileToBounds(x, y, zoom) {
  const n = Math.pow(2, zoom);
  
  const minLon = x / n * 360 - 180;
  const maxLon = (x + 1) / n * 360 - 180;
  
  const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
  const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  
  const minLat = minLatRad * 180 / Math.PI;
  const maxLat = maxLatRad * 180 / Math.PI;
  
  return {
    minX: minLon,
    minY: minLat,
    maxX: maxLon,
    maxY: maxLat,
  };
}

/**
 * Calculate all tiles that intersect with a bounding box at a given zoom level.
 * @param {Array<number>} bbox - Bounding box [minX, minY, maxX, maxY] in degrees
 * @param {number} zoom - Zoom level
 * @returns {Array<TileCoordinate>} Array of tile coordinates
 */
function getTilesInBounds(bbox, zoom) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  
  // Get tile coordinates for corners
  const minTile = lonLatToTile(minLon, maxLat, zoom); // Note: maxLat for min tile
  const maxTile = lonLatToTile(maxLon, minLat, zoom); // Note: minLat for max tile
  
  const tiles = [];
  
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  
  return tiles;
}

/**
 * Generate a tiling scheme for all zoom levels.
 * @param {Array<number>} bbox - Bounding box [minX, minY, maxX, maxY] in degrees
 * @param {number} minZoom - Minimum zoom level
 * @param {number} maxZoom - Maximum zoom level
 * @returns {Object} Tiling scheme with tiles per level
 */
function generateTilingScheme(bbox, minZoom = 0, maxZoom = 10) {
  const scheme = {
    bbox,
    minZoom,
    maxZoom,
    levels: {},
    totalTiles: 0,
  };
  
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const tiles = getTilesInBounds(bbox, zoom);
    scheme.levels[zoom] = tiles;
    scheme.totalTiles += tiles.length;
  }
  
  return scheme;
}

/**
 * Calculate the resolution (meters per pixel) at a given zoom level and latitude.
 * @param {number} zoom - Zoom level
 * @param {number} lat - Latitude in degrees
 * @param {number} tileSize - Tile size in pixels (default 256)
 * @returns {number} Resolution in meters per pixel
 */
function getResolution(zoom, lat = 0, tileSize = 256) {
  const latRad = lat * Math.PI / 180;
  return EARTH_CIRCUMFERENCE * Math.cos(latRad) / (tileSize * Math.pow(2, zoom));
}

/**
 * Get the parent tile coordinate at the next lower zoom level.
 * @param {TileCoordinate} tile - Child tile coordinate
 * @returns {TileCoordinate} Parent tile coordinate
 */
function getParentTile(tile) {
  if (tile.z === 0) {
    return null; // No parent for zoom level 0
  }
  
  return {
    x: Math.floor(tile.x / 2),
    y: Math.floor(tile.y / 2),
    z: tile.z - 1,
  };
}

/**
 * Get the four child tiles at the next higher zoom level.
 * @param {TileCoordinate} tile - Parent tile coordinate
 * @returns {Array<TileCoordinate>} Array of four child tile coordinates
 */
function getChildTiles(tile) {
  const baseX = tile.x * 2;
  const baseY = tile.y * 2;
  const childZ = tile.z + 1;
  
  return [
    { x: baseX, y: baseY, z: childZ },
    { x: baseX + 1, y: baseY, z: childZ },
    { x: baseX, y: baseY + 1, z: childZ },
    { x: baseX + 1, y: baseY + 1, z: childZ },
  ];
}

/**
 * Format tile coordinate as a path string (e.g., "5/10/12" for z5/x10/y12).
 * @param {TileCoordinate} tile - Tile coordinate
 * @param {string} format - Format type: 'zxy' or 'xyz' (default 'zxy')
 * @returns {string} Formatted tile path
 */
function formatTilePath(tile, format = 'zxy') {
  if (format === 'xyz') {
    return `${tile.x}/${tile.y}/${tile.z}`;
  }
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/**
 * Check if two bounding boxes intersect.
 * @param {Array<number>} bbox1 - First bounding box [minX, minY, maxX, maxY]
 * @param {Array<number>} bbox2 - Second bounding box [minX, minY, maxX, maxY]
 * @returns {boolean} True if bounding boxes intersect
 */
function bboxIntersects(bbox1, bbox2) {
  return !(
    bbox1[2] < bbox2[0] || // bbox1 maxX < bbox2 minX
    bbox1[0] > bbox2[2] || // bbox1 minX > bbox2 maxX
    bbox1[3] < bbox2[1] || // bbox1 maxY < bbox2 minY
    bbox1[1] > bbox2[3]    // bbox1 minY > bbox2 maxY
  );
}

module.exports = {
  lonLatToTile,
  tileToBounds,
  getTilesInBounds,
  generateTilingScheme,
  getResolution,
  getParentTile,
  getChildTiles,
  formatTilePath,
  bboxIntersects,
  EARTH_RADIUS,
  EARTH_CIRCUMFERENCE,
};
