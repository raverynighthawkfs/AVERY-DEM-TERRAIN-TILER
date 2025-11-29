const os = require('os');
const { Command } = require('commander');
const { generateTerrainTiles } = require('./pipeline');

async function run(argv) {
  const program = new Command();

  program
    .name('dem-terraindb-tiler')
    .description('Merge elevation data from a DEM and generate terraindb tiles for Cesium / Unreal Engine.')
    .requiredOption('-i, --input <path>', 'Input DEM file (e.g. GeoTIFF)')
    .requiredOption('-o, --output <dir>', 'Output directory for generated terraindb tiles')
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

  await generateTerrainTiles({
    inputPath: options.input,
    outputDir: options.output,
    tileSize: Number(options.tileSize),
    maxLevel: Number(options.maxLevel),
    workers: options.workers,
  });
}

module.exports = { run };
