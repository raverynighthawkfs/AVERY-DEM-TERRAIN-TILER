// High-level pipeline for generating terrain database tiles from a DEM.
const { readDEMData, readDEMMetadata } = require('./dem-reader');
const { generateTilingScheme, tileToBounds, bboxIntersects } = require('./tiling');
const { 
  resampleElevationData, 
  extractRegion, 
  encodeHeightmapPNG,
  writeTile 
} = require('./terrain-encoder');

/**
 * @typedef {Object} GenerateOptions
 * @property {string} inputPath - Path to the input DEM (e.g. GeoTIFF).
 * @property {string} outputDir - Directory where terrain tiles will be written.
 * @property {number} tileSize - Tile size in pixels or meters (implementation-specific).
 * @property {number} maxLevel - Maximum level-of-detail to generate.
 * @property {number|undefined} [workers] - Number of worker threads/processes to use (optional).
 */

/**
 * Entry point for generating terrain tiles.
 * @param {GenerateOptions} options
 */
async function generateTerrainTiles(options) {
  const { inputPath, outputDir, tileSize, maxLevel, workers } = options;

  console.log('[dem-terraindb-tiler] Starting generation');
  console.log('  DEM input     :', inputPath);
  console.log('  Output dir    :', outputDir);
  console.log('  Tile size     :', tileSize);
  console.log('  Max LOD level :', maxLevel);
  console.log('  Workers       :', workers ?? 'auto');
  console.log('');

  // Phase 1: Read DEM data and metadata
  console.log('[1/4] Reading DEM data...');
  const { data: elevationData, metadata } = await readDEMData(inputPath);
  
  console.log(`  Loaded ${metadata.width}x${metadata.height} DEM`);
  console.log(`  Elevation range: ${metadata.minElevation.toFixed(2)}m to ${metadata.maxElevation.toFixed(2)}m`);
  console.log(`  Bounds: [${metadata.bbox.map(v => v.toFixed(4)).join(', ')}]`);
  console.log('');

  // Phase 2: Generate tiling scheme
  console.log('[2/4] Computing tiling scheme...');
  const tilingScheme = generateTilingScheme(metadata.bbox, 0, maxLevel);
  
  console.log(`  Total tiles to generate: ${tilingScheme.totalTiles}`);
  for (let z = 0; z <= maxLevel; z++) {
    console.log(`    Level ${z}: ${tilingScheme.levels[z].length} tiles`);
  }
  console.log('');

  // Phase 3: Process each tile
  console.log('[3/4] Generating tiles...');
  let tilesProcessed = 0;
  const startTime = Date.now();
  
  for (let zoom = 0; zoom <= maxLevel; zoom++) {
    const tiles = tilingScheme.levels[zoom];
    
    for (const tile of tiles) {
      const tileBounds = tileToBounds(tile.x, tile.y, tile.z);
      
      // Check if tile intersects with DEM bounds
      const tileBbox = [tileBounds.minX, tileBounds.minY, tileBounds.maxX, tileBounds.maxY];
      if (!bboxIntersects(metadata.bbox, tileBbox)) {
        continue; // Skip tiles outside DEM coverage
      }
      
      // Calculate which part of the DEM corresponds to this tile
      const tileElevationData = extractTileData(
        elevationData,
        metadata,
        tileBounds,
        tileSize
      );
      
      // Encode as heightmap PNG
      const pngBuffer = await encodeHeightmapPNG(
        tileElevationData,
        tileSize,
        tileSize,
        metadata.minElevation,
        metadata.maxElevation
      );
      
      // Write tile to disk
      await writeTile(outputDir, tile.z, tile.x, tile.y, pngBuffer, '.png');
      
      tilesProcessed++;
      
      // Progress update every 10 tiles
      if (tilesProcessed % 10 === 0) {
        const progress = (tilesProcessed / tilingScheme.totalTiles * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`    Progress: ${tilesProcessed}/${tilingScheme.totalTiles} (${progress}%) - ${elapsed}s elapsed`);
      }
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Completed ${tilesProcessed} tiles in ${totalTime}s`);
  console.log('');

  // Phase 4: Write metadata
  console.log('[4/4] Writing metadata...');
  await writeLayerJson(outputDir, metadata, tilingScheme);
  console.log('  Metadata written: layer.json');
  console.log('');
  
  console.log('[dem-terraindb-tiler] Generation complete!');
}

/**
 * Extract and resample elevation data for a specific tile.
 * @param {TypedArray} elevationData - Full DEM elevation data
 * @param {Object} metadata - DEM metadata
 * @param {Object} tileBounds - Geographic bounds of the tile
 * @param {number} tileSize - Target tile size in pixels
 * @returns {Float32Array} Resampled tile elevation data
 */
function extractTileData(elevationData, metadata, tileBounds, tileSize) {
  const demBbox = metadata.bbox;
  const demWidth = metadata.width;
  const demHeight = metadata.height;
  
  // Calculate pixel coordinates in the DEM
  const xScale = demWidth / (demBbox[2] - demBbox[0]);
  const yScale = demHeight / (demBbox[3] - demBbox[1]);
  
  const x0 = Math.max(0, Math.floor((tileBounds.minX - demBbox[0]) * xScale));
  const y0 = Math.max(0, Math.floor((demBbox[3] - tileBounds.maxY) * yScale));
  const x1 = Math.min(demWidth - 1, Math.ceil((tileBounds.maxX - demBbox[0]) * xScale));
  const y1 = Math.min(demHeight - 1, Math.ceil((demBbox[3] - tileBounds.minY) * yScale));
  
  const extractWidth = x1 - x0 + 1;
  const extractHeight = y1 - y0 + 1;
  
  // Extract the region
  const regionData = extractRegion(elevationData, demWidth, x0, y0, extractWidth, extractHeight);
  
  // Resample to target tile size if necessary
  if (extractWidth !== tileSize || extractHeight !== tileSize) {
    return resampleElevationData(regionData, extractWidth, extractHeight, tileSize, tileSize);
  }
  
  return regionData;
}

/**
 * Write layer.json metadata file for Cesium terrain provider.
 * @param {string} outputDir - Output directory
 * @param {Object} metadata - DEM metadata
 * @param {Object} tilingScheme - Tiling scheme
 */
async function writeLayerJson(outputDir, metadata, tilingScheme) {
  const fs = require('fs-extra');
  const path = require('path');
  
  const layerJson = {
    tilejson: '2.1.0',
    name: 'DEM Terrain Tiles',
    description: `Generated from ${path.basename(metadata.path)}`,
    version: '1.0.0',
    format: 'heightmap-1.0',
    bounds: metadata.bbox,
    minzoom: tilingScheme.minZoom,
    maxzoom: tilingScheme.maxZoom,
    projection: metadata.projection || 'EPSG:4326',
    tiles: ['{z}/{x}/{y}.png'],
    available: Object.keys(tilingScheme.levels).map(z => [
      {
        startX: Math.min(...tilingScheme.levels[z].map(t => t.x)),
        startY: Math.min(...tilingScheme.levels[z].map(t => t.y)),
        endX: Math.max(...tilingScheme.levels[z].map(t => t.x)),
        endY: Math.max(...tilingScheme.levels[z].map(t => t.y)),
      }
    ]),
  };
  
  await fs.writeJson(path.join(outputDir, 'layer.json'), layerJson, { spaces: 2 });
}

module.exports = { generateTerrainTiles };
