const os = require('os');
const { Command } = require('commander');
const { generateTerrainTiles } = require('./pipeline');
const { readDEMMetadata, formatMetadata } = require('./dem-reader');

async function run(argv) {
  const program = new Command();

  program
    .name('dem-terraindb-tiler')
    .description('Merge elevation data from a DEM and generate terraindb tiles for Cesium / Unreal Engine.')
    .requiredOption('-i, --input <path>', 'Input DEM file (e.g. GeoTIFF)')
    .option('-o, --output <dir>', 'Output directory for generated terraindb tiles')
    .option('--metadata', 'Display DEM metadata without generating tiles')
    .option('--tile-size <size>', 'Tile size in pixels or meters (implementation-specific)', '256')
    .option('--max-level <n>', 'Maximum level of detail', (v) => parseInt(v, 10), 10)
    .option(
      '--workers <n>',
      'Number of worker threads/processes to use for tiling (when implemented)',
      (v) => {
        const parsed = parseInt(v, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error('workers must be a positive integer');
        }
        return parsed;
      },
      os.cpus().length,
    )
    .parse(argv);

  const options = program.opts();

  // If --metadata flag is set, just display metadata and exit
  if (options.metadata) {
    try {
      const metadata = await readDEMMetadata(options.input);
      console.log(formatMetadata(metadata));
      return;
    } catch (err) {
      console.error('Error reading DEM metadata:', err.message);
      throw err;
    }
  }

  // Otherwise, validate output directory is provided and generate tiles
  if (!options.output) {
    throw new Error('Output directory (-o, --output) is required when generating tiles');
  }

  await generateTerrainTiles({
    inputPath: options.input,
    outputDir: options.output,
    tileSize: Number(options.tileSize),
    maxLevel: Number(options.maxLevel),
    workers: options.workers,
  });
}

module.exports = { run };
