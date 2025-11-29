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
- Run via npm script (equivalent to the above `node` invocations):
  - `npm start -- --help`
  - `npm start -- -i <input-dem> -o <output-dir> [--tile-size <size>] [--max-level <n>]`
- GUI (Electron desktop app, macOS & Windows):
  - `npm run ui`  launches the Electron window on the current platform.
- Packaging (Electron builder):
  - macOS (ARM / M-series, run on a Mac): `npm run dist:mac`  produces a `.dmg` in `dist/`.
  - Windows x64 (run on Windows): `npm run dist:win`  produces an `.exe` installer in `dist/`.
- Tests:
  - `npm test` is currently a placeholder that prints an error and exits with status 1; there is no test runner configured yet.
- Build / lint:
  - There are no build, lint, or format scripts defined in `package.json` as of version `1.0.0`. The code runs directly on Node.js without a separate build step.

## Architecture and Code Structure

### Runtime layout

- `package.json`
  - Declares a `bin` entry: `"dem-terraindb-tiler": "./bin/cli.js"`, making this a globally-installable CLI when published.
  - Defines scripts:
    - `start`: `node ./bin/cli.js`
    - `test`: placeholder that always fails.
  - Uses CommonJS (`"type": "commonjs"`) and depends on `commander` for CLI parsing.

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
      - `-o, --output <dir>`: output directory for generated terrain tiles.
    - Optional options:
      - `--tile-size <size>`: tile size (string option; later coerced to `Number`). Defaults to `"256"`.
      - `--max-level <n>`: maximum level of detail; parsed to integer with default `10`.
  - Parsing the provided `argv` and reading `program.opts()`.
  - Calling `generateTerrainTiles` from `src/pipeline.js` with a normalized options object:
    - `inputPath`
    - `outputDir`
    - `tileSize` (number)
    - `maxLevel` (number)

`run(argv)` is the main integration point between the CLI surface and the terrain generation pipeline. If you need to invoke the tiler programmatically (e.g., from tests or other scripts), prefer calling `run()` or directly using `generateTerrainTiles()` with a constructed options object.

### Desktop GUI (Electron)

- `electron-main.js`
  - Electron main process. Creates the browser window, loads `ui/index.html`, and registers IPC handlers for:
    - `select-input-dem` / `select-output-dir` to open native file/folder pickers.
    - `run-tiler` to invoke `generateTerrainTiles` with options chosen in the UI.
- `electron-preload.js`
  - Uses `contextBridge` to expose a minimal API on `window.demTiler` (select input DEM, select output directory, run the tiler) so the renderer can communicate with the main process without direct Node.js access.
- `ui/index.html` and `ui/renderer.js`
  - Implement the cross-platform desktop UI: inputs for DEM path, output directory, tile size, and max LOD, plus a status area.
  - When the user clicks "Generate Tiles", the renderer calls `window.demTiler.runTiler(...)`, which flows via Electron IPC back to `generateTerrainTiles` in `src/pipeline.js`.

### Terrain generation pipeline (`src/pipeline.js`)

- Exports a single async function `generateTerrainTiles(options)`.
- Currently implements a logging-only stub:
  - Destructures `inputPath`, `outputDir`, `tileSize`, `maxLevel` from `options`.
  - Logs the effective configuration to stdout.
  - Emits a warning indicating that `generateTerrainTiles` is a stub.
- Contains inline comments that outline the intended high-level phases of the pipeline:
  1. Read DEM metadata (bounds, resolution, projection).
  2. Derive a quadtree / tiling scheme compatible with Cesium / Unreal.
  3. For each tile and level-of-detail, resample or clamp DEM data.
  4. Encode and write the data to the terraindb tile format.

As you implement functionality, a good separation of concerns is to keep `generateTerrainTiles` as the orchestration layer and move concrete logic into additional modules under `src/` (for example: DEM I/O, tiling/grid computations, encoding/writing). This keeps the CLI boundary thin and makes it easier to reuse the core pipeline from tests or other tools.

## Tests and Linting

- Tests:
  - There is no test framework configured yet. `npm test` only runs a placeholder command.
  - Once a test runner is introduced and test files are added, update this section with:
    - How to run the full test suite.
    - How to run a single test file or a focused test.
- Linting / formatting:
  - No linting or formatting commands are currently defined. If tools such as ESLint or Prettier are added later, prefer wiring them via npm scripts (e.g., `lint`, `format`) and documenting the exact commands here so future WARP instances can use them directly.
