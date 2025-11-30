window.addEventListener('DOMContentLoaded', () => {
  const inputPathEl = document.getElementById('inputPath');
  const outputDirEl = document.getElementById('outputDir');
  const tileSizeEl = document.getElementById('tileSize');
  const maxLevelEl = document.getElementById('maxLevel');
  const browseInputBtn = document.getElementById('browseInput');
  const browseOutputBtn = document.getElementById('browseOutput');
  const viewMetadataBtn = document.getElementById('viewMetadata');
  const runBtn = document.getElementById('runBtn');
  const statusEl = document.getElementById('status');

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', !!isError);
  }

  browseInputBtn.addEventListener('click', async () => {
    const selected = await window.demTiler.selectInputDem();
    if (selected) {
      inputPathEl.value = selected;
    }
  });

  browseOutputBtn.addEventListener('click', async () => {
    const selected = await window.demTiler.selectOutputDir();
    if (selected) {
      outputDirEl.value = selected;
    }
  });

  viewMetadataBtn.addEventListener('click', async () => {
    const inputPath = inputPathEl.value.trim();

    if (!inputPath) {
      setStatus('Please select an input DEM file first.', true);
      return;
    }

    setStatus('Reading metadata...');

    const result = await window.demTiler.readMetadata(inputPath);

    if (result && result.ok) {
      setStatus(result.formatted);
    } else {
      setStatus(`Error reading metadata: ${(result && result.error) || 'Unknown error'}`, true);
    }
  });

  runBtn.addEventListener('click', async () => {
    const inputPath = inputPathEl.value.trim();
    const outputDir = outputDirEl.value.trim();
    const tileSize = tileSizeEl.value;
    const maxLevel = maxLevelEl.value;

    if (!inputPath || !outputDir) {
      setStatus('Please provide both an input DEM and an output directory.', true);
      return;
    }

    setStatus('Running tiler...');

    const result = await window.demTiler.runTiler({
      inputPath,
      outputDir,
      tileSize,
      maxLevel,
    });

    if (result && result.ok) {
      setStatus('Done. (Note: pipeline is currently a stub and only logs output.)');
    } else {
      setStatus(`Error: ${(result && result.error) || 'Unknown error'}`, true);
    }
  });
});
