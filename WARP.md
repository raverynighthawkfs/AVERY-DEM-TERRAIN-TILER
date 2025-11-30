# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This repository contains a small Node.js CLI tool for generating terrain database tiles from a DEM (e.g. GeoTIFF) intended for use with Cesium / Unreal Engine, plus an Electron-based desktop UI for macOS and Windows. The core terrain generation pipeline is currently a stub; the existing code focuses on command-line parsing, wiring, and basic GUI scaffolding.

## Key Commands

All commands are intended to be run from the repository root.

- Install dependencies:
  - `npm install`
- Run the CLI (preferred during development):
  - `node ./bin/cli.js --help`
  - `node ./bin/cli.js -i <input-dem> -o <output-dir> [--tile-size <size>] [--max-level <n>]`
  - `node ./bin/cli.js -i <input-dem> --metadata` (view DEM metadata without generating tiles)
- Run via npm script (equivalent to the above `node` invocations):
  - `npm start -- --help`
  - `npm start -- -i <input-dem> -o <output-dir> [--tile-size <size>] [--max-level <n>]`
  - `npm start -- -i <input-dem> --metadata`
- GUI (Electron desktop app, macOS & Windows):
  - `npm run ui`  launches the Electron window on the current platform.
  - Click "View Metadata" button to inspect DEM file properties before generating tiles.
- Packaging (Electron builder):
  - macOS (ARM / M-series, run on a Mac): `npm run dist:mac`  produces a `.dmg` in `dist/`.
  - Windows x64 (run on Windows): `npm run dist:win`  produces an `.exe` installer in `dist/`.
- Tests:
  - `npm test` runs the Jest test suite (32 tests covering tiling and terrain encoding utilities).
  - `npm run test:watch` runs tests in watch mode for development.
  - `npm run test:coverage` generates a test coverage report in the `coverage/` directory.
- Build / lint:
  - There are no build, lint, or format scripts defined in `package.json` as of version `1.0.0`. The code runs directly on Node.js without a separate build step.

## Architecture and Code Structure

### Runtime layout

- `package.json`
  - Declares a `bin` entry: `"dem-terraindb-tiler": "./bin/cli.js"`, making this a globally-installable CLI when published.
  - Defines scripts:
    - `start`: `node ./bin/cli.js`
    - `test`: runs Jest test suite.
    - `test:watch`: runs Jest in watch mode.
    - `test:coverage`: generates test coverage report.
    - `ui`: launches Electron GUI.
    - `dist:mac` and `dist:win`: build platform-specific distributables.
  - Uses CommonJS (`"type": "commonjs"`).
  - Production dependencies: `commander` (CLI parsing), `geotiff` (GeoTIFF reading), `sharp` (image processing), `fs-extra` (file operations).
  - Dev dependencies: `jest` (testing), `electron`, `electron-builder`.

### CLI entrypoint (`bin/cli.js`)

- Acts as the Node.js shebang entry.
- Imports `run` from `src/index.js` and calls it with `process.argv`.
- Centralizes error handling: logs any thrown error to stderr and exits with code `1`.
- This file should remain thin; CLI behavior and domain logic are delegated to `src/`.

### CLI orchestration (`src/index.js`)

- Exposes a single async function `run(argv)` that is responsible for:
  - Constructing a `Command` instance from `commander`.
  - Defining the `dem-terraindb-tiler` CLI, including:
    - Required options:
      - `-i, --input <path>`: input DEM file path.
    - Optional options:
      - `-o, --output <dir>`: output directory for generated terrain tiles (required unless `--metadata` is used).
      - `--metadata`: display DEM metadata without generating tiles.
      - `--tile-size <size>`: tile size (string option; later coerced to `Number`). Defaults to `"256"`.
      - `--max-level <n>`: maximum level of detail; parsed to integer with default `10`.
  - Parsing the provided `argv` and reading `program.opts()`.
  - If `--metadata` flag is set, calling `readDEMMetadata` and `formatMetadata` to display DEM information.
  - Otherwise, calling `generateTerrainTiles` from `src/pipeline.js` with a normalized options object:
    - `inputPath`
    - `outputDir`
    - `tileSize` (number)
    - `maxLevel` (number)

`run(argv)` is the main integration point between the CLI surface and the terrain generation pipeline. If you need to invoke the tiler programmatically (e.g., from tests or other scripts), prefer calling `run()` or directly using `generateTerrainTiles()` with a constructed options object.

### Desktop GUI (Electron)

- `electron-main.js`
  - Electron main process. Creates the browser window, loads `ui/index.html`, and registers IPC handlers for:
    - `select-input-dem` / `select-output-dir` to open native file/folder pickers.
    - `read-metadata` to read and return DEM metadata.
    - `run-tiler` to invoke `generateTerrainTiles` with options chosen in the UI.
- `electron-preload.js`
  - Uses `contextBridge` to expose a minimal API on `window.demTiler` (select input DEM, select output directory, read metadata, run the tiler) so the renderer can communicate with the main process without direct Node.js access.
- `ui/index.html` and `ui/renderer.js`
  - Implement the cross-platform desktop UI: inputs for DEM path, output directory, tile size, and max LOD, plus a status area.
  - "View Metadata" button allows users to inspect DEM properties before generation.
  - When the user clicks "Generate Tiles", the renderer calls `window.demTiler.runTiler(...)`, which flows via Electron IPC back to `generateTerrainTiles` in `src/pipeline.js`.

### Terrain generation pipeline (`src/pipeline.js`)

- Exports a single async function `generateTerrainTiles(options)`.
- Implements a complete 4-phase terrain tile generation pipeline:
  1. **Read DEM data**: Loads GeoTIFF using `readDEMData()` from `src/dem-reader.js`, extracting elevation values and metadata (bounds, resolution, projection).
  2. **Compute tiling scheme**: Uses `generateTilingScheme()` from `src/tiling.js` to derive a quadtree structure compatible with Cesium/Unreal, calculating all tile coordinates for each LOD level.
  3. **Generate tiles**: For each tile at each zoom level:
     - Extracts the corresponding region from the DEM.
     - Resamples elevation data to the target tile size using bilinear interpolation.
     - Encodes as heightmap PNG (16-bit grayscale) via `encodeHeightmapPNG()` from `src/terrain-encoder.js`.
     - Writes tile to disk in `{z}/{x}/{y}.png` structure.
  4. **Write metadata**: Generates a `layer.json` file with tile metadata for Cesium terrain providers.
- Progress logging tracks tile generation and shows elapsed time.

### Supporting modules

- **`src/dem-reader.js`**
  - `readDEMMetadata(inputPath)`: Reads GeoTIFF metadata including dimensions, bounds, resolution, projection, data type, and elevation range.
  - `readDEMData(inputPath)`: Returns both elevation data array and metadata.
  - `formatMetadata(metadata)`: Formats metadata as human-readable text for display.
  - Uses `geotiff` library to parse GeoTIFF files.

- **`src/tiling.js`**
  - Implements TMS (Tile Map Service) coordinate system.
  - `lonLatToTile()`: Converts geographic coordinates to tile coordinates.
  - `tileToBounds()`: Gets geographic bounds of a tile.
  - `getTilesInBounds()`: Calculates all tiles intersecting a bounding box at a zoom level.
  - `generateTilingScheme()`: Generates complete quadtree scheme for all zoom levels.
  - Additional utilities: `getParentTile()`, `getChildTiles()`, `getResolution()`, `bboxIntersects()`.

- **`src/terrain-encoder.js`**
  - `encodeHeightmapPNG()`: Encodes elevation data as 16-bit PNG heightmap for Cesium.
  - `encodeQuantizedMesh()`: Simplified quantized-mesh format encoder (stub for future enhancement).
  - `resampleElevationData()`: Bilinear interpolation for resampling elevation data.
  - `extractRegion()`: Extracts a rectangular region from elevation data.
  - `writeTile()`: Writes encoded tile data to disk.
  - Uses `sharp` for PNG encoding.

As you implement additional functionality or enhancements, the separation of concerns keeps the pipeline orchestration layer clean while concrete logic lives in specialized modules. This makes it easier to reuse components from tests or other tools.

## Tests and Linting

- Tests:
  - Jest is configured as the test framework with tests located in `__tests__/` directory.
  - Run the full test suite: `npm test`
  - Run tests in watch mode (auto-rerun on file changes): `npm run test:watch`
  - Generate coverage report: `npm run test:coverage` (output in `coverage/` directory)
  - Current test files:
    - `__tests__/tiling.test.js`: Tests for tiling coordinate system, tile bounds calculation, quadtree generation, and bbox intersection logic.
    - `__tests__/terrain-encoder.test.js`: Tests for elevation data resampling, region extraction, and heightmap encoding.
  - All 32 tests currently pass.
  - To run a single test file: `npm test -- __tests__/tiling.test.js`
  - To run a focused test: Use Jest's `.only()` modifier in the test file, e.g., `it.only('test name', ...)`
- Linting / formatting:
  - No linting or formatting commands are currently defined. If tools such as ESLint or Prettier are added later, prefer wiring them via npm scripts (e.g., `lint`, `format`) and documenting the exact commands here so future WARP instances can use them directly.
