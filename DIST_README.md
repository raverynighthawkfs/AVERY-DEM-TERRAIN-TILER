# AVERY DEM Terraindb Tiler - Distribution Packages

## What's included

This is the **AVERY DEM Terraindb Tiler** - a cross-platform Electron desktop app for generating terrain database tiles from DEM (Digital Elevation Model) files.

### ✨ Features
- **Material Design UI** with emoji icons (📄, 📁, 🔧, 📐, 🚀)
- **Quick start guide** built into the interface
- **Multi-core processing support** with `--workers` option (when pipeline is implemented)
- **Cross-platform**: Windows x64 and macOS ARM (Apple Silicon M1-M5)

### 📁 Supported Input Files
- **GeoTIFF DEMs**: `.tif`, `.tiff`
- Other DEM formats should be converted to GeoTIFF before loading

## Download & Install

### Windows x64 PCs
- **File**: `AVERY DEM Terraindb Tiler Setup 1.0.0.exe` (~82 MB)
- **Architecture**: x64 (64-bit Intel/AMD processors)
- **Install**: Run the `.exe` installer and follow the prompts

### Mac (Apple Silicon M1-M5)
- **File**: `AVERY DEM Terraindb Tiler-1.0.0-arm64.dmg` (would be ~100+ MB)
- **Architecture**: ARM64 (Apple Silicon: M1, M2, M3, M4, M5 chips)
- **Install**: 
  1. Open the `.dmg` file
  2. Drag the app into your `/Applications` folder
  
> **Note**: The Mac build requires building on a Mac machine with Node.js. Run `npm run dist:mac` on macOS to generate the `.dmg`.

## How to Use

1. **Launch the app**
2. **Input DEM**: Click 📁 Browse to select a GeoTIFF DEM file (`.tif`/`.tiff`)
3. **Output directory**: Click 🗂️ Browse to choose an empty output folder
4. **Configure**:
   - **Tile size**: Default 256 pixels (adjust as needed)
   - **Z_LEVEL**: Max level of detail, default 10
5. **Generate**: Click 🚀 Generate Tiles

### Current Status: Prototype
This build is a **prototype/proof-of-concept**:
- The UI is fully functional with file pickers and configuration
- The terrain generation pipeline currently **logs configuration only** and doesn't write real tiles yet
- Perfect for testing the interface and workflow

## CLI Usage (Advanced)

You can also run the tiler from command line:

```bash
# Show help
dem-terraindb-tiler --help

# Generate tiles
dem-terraindb-tiler \
  -i /path/to/input.tif \
  -o /path/to/output-dir \
  --tile-size 256 \
  --max-level 10 \
  --workers 8
```

## Technical Details

- **Platform**: Electron (Chromium + Node.js)
- **Architecture**: Native x64 (Windows), ARM64 (Mac)  
- **File Size**: ~80-100 MB (includes Chromium runtime)
- **Requirements**: Windows 10+ (x64), macOS 11+ (Apple Silicon)
- **Multi-threading**: CPU core optimization ready via `--workers` flag

## Next Steps

The complete terrain generation pipeline implementation would add:
- Real DEM loading and metadata extraction
- Quadtree tiling scheme generation
- Terrain data resampling and encoding
- Terraindb tile format output compatible with Cesium/Unreal Engine

---

**Project**: `dem-terraindb-tiler` v1.0.0  
**Developer**: AVERY  
**License**: ISC