/**
 * 3D Cloud Viewer Component powered by h5wasm (WebAssembly HDF5 reader)
 * and Plotly.js (WebGL 3D Volume & Isosurface rendering).
 * Reads .h5 files directly in the browser and renders physical 3D density distributions.
 */

import h5wasm, { Module } from 'https://cdn.jsdelivr.net/npm/h5wasm@0.4.9/dist/esm/hdf5_hl.js';

// Module-level cache for WASM readiness
let wasmReadyPromise = null;
function getH5Wasm() {
  if (!wasmReadyPromise) {
    wasmReadyPromise = h5wasm.ready.then(() => ({ h5wasm, Module, FS: Module.FS }));
  }
  return wasmReadyPromise;
}

/**
 * Reads any numeric dataset from h5wasm, automatically converting Float16 (2 bytes)
 * or Float32 to standard Float32Array for WebGL & Plotly.
 */
function readDatasetAsFloat32(f, datasetName) {
  const ds = f.get(datasetName);
  if (!ds) return { data: null, shape: null };

  const shape = ds.shape;
  const metadata = ds.metadata;

  // If already float32 or float64, standard .value getter works
  if (metadata.type === 1 && metadata.size === 2) {
    // Float16 (size === 2) is not natively handled by h5wasm's .value getter.
    // Read raw bytes via WebAssembly Module and decode to Float32Array:
    const nbytes = metadata.size * metadata.total_size;
    const data_ptr = Module._malloc(nbytes);
    try {
      Module.get_dataset_data(ds.file_id, ds.path, null, null, BigInt(data_ptr));
      const u16 = new Uint16Array(Module.HEAPU8.buffer, data_ptr, metadata.total_size);
      const outF32 = new Float32Array(metadata.total_size);

      for (let i = 0; i < metadata.total_size; i++) {
        const h = u16[i];
        const exponent = (h >> 10) & 0x1f;
        const mantissa = h & 0x3ff;
        const sign = (h >> 15) ? -1 : 1;

        if (exponent === 0) {
          outF32[i] = mantissa ? sign * Math.pow(2, -14) * (mantissa / 1024) : sign * 0;
        } else if (exponent === 31) {
          outF32[i] = mantissa ? NaN : sign * Infinity;
        } else {
          outF32[i] = sign * Math.pow(2, exponent - 15) * (1 + mantissa / 1024);
        }
      }
      return { data: outF32, shape };
    } finally {
      Module._free(data_ptr);
    }
  }

  // Fallback to standard h5wasm value getter
  return { data: ds.value, shape };
}

// Global active viewer instance tracker
let currentViewerInstance = null;

export class CloudViewer3D {
  constructor(containerEl, cloudId) {
    this.container = containerEl;
    this.cloudId = cloudId;
    this.plotDivId = `plotly-cloud-3d-${Date.now()}`;

    // Visualization state
    this.currentColormap = 'Cividis';
    this.renderMode = 'volume'; // 'volume' or 'isosurface'
    this.opacity = 0.18;
    this.showSlices = false;
    this.surfaceCount = 18;

    // Memory & Data lifecycle
    this.h5Data = null;
    this.plotlyPlot = null;
    this.resizeObserver = null;
    this.isDisposed = false;
    this.abortController = new AbortController();

    this.initDOM();
    this.loadH5AndRender();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="cloud-viewer-3d-wrapper">
        <!-- 3D Plot Area -->
        <div class="cloud-canvas-container" id="cloud-3d-canvas-box" style="position: relative; width: 100%; height: 460px;">
          <div class="viewer-loading-overlay" id="viewer-loading">
            <div class="viewer-spinner"></div>
            <span id="viewer-loading-text">Loading 3D H5 Volume for Cloud #${this.cloudId}...</span>
          </div>

          <!-- Plotly Graph Mount Point -->
          <div id="${this.plotDivId}" style="width: 100%; height: 100%;"></div>

          <!-- View Orientation & Physical Dimensions Telemetry -->
          <div class="hud-telemetry" id="hud-telemetry">
            <span class="telemetry-badge" id="telem-box">Box: —</span>
            <span class="telemetry-badge" id="telem-voxels">Grid: —</span>
            <span class="telemetry-badge" id="telem-maxd">Max <i>n</i><sub>H</sub>: —</span>
          </div>
        </div>

        <!-- 3D Viewer Toolbar Controls -->
        <div class="viewer-controls-bar">
          <div class="ctrl-group">
            <label class="ctrl-label">Colormap:</label>
            <select class="ctrl-select" id="ctrl-cmap-select">
              <option value="Cividis" selected>Cividis (Colorblind-Safe)</option>
            </select>
          </div>

          <div class="ctrl-group">
            <label class="ctrl-label">Mode:</label>
            <select class="ctrl-select" id="ctrl-mode-select">
              <option value="volume" selected>Volume (Raycast)</option>
              <option value="isosurface">Isosurfaces (Shells)</option>
            </select>
          </div>

          <div class="ctrl-group">
            <label class="ctrl-label">Opacity:</label>
            <input type="range" class="ctrl-slider" id="ctrl-opacity-slider" min="5" max="60" value="18" step="1" />
            <span class="ctrl-val-badge" id="ctrl-opacity-val">0.18</span>
          </div>

          <div class="ctrl-group-buttons">
            <button class="btn-ctrl-toggle" id="btn-toggle-slice" title="Toggle Z-Axis Midplane Slice Cross-Section">
              <span>Slice Plane</span>
            </button>

            <button class="btn-ctrl-action" id="btn-reset-cam" title="Reset Isometric 3D View">
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachDOMEvents();
  }

  attachDOMEvents() {
    const cmapSelect = this.container.querySelector('#ctrl-cmap-select');
    if (cmapSelect) {
      cmapSelect.addEventListener('change', (e) => {
        this.currentColormap = e.target.value;
        this.updatePlotlyTrace();
      });
    }

    const modeSelect = this.container.querySelector('#ctrl-mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.renderMode = e.target.value;
        this.updatePlotlyTrace();
      });
    }

    const opacitySlider = this.container.querySelector('#ctrl-opacity-slider');
    const opacityVal = this.container.querySelector('#ctrl-opacity-val');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.opacity = parseFloat(e.target.value) / 100.0;
        if (opacityVal) opacityVal.textContent = this.opacity.toFixed(2);
        this.updatePlotlyTrace();
      });
    }

    const sliceBtn = this.container.querySelector('#btn-toggle-slice');
    if (sliceBtn) {
      sliceBtn.addEventListener('click', () => {
        this.showSlices = !this.showSlices;
        sliceBtn.classList.toggle('active', this.showSlices);
        this.updatePlotlyTrace();
      });
    }

    const resetBtn = this.container.querySelector('#btn-reset-cam');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetCamera();
      });
    }
  }

  async loadH5AndRender() {
    const loadingText = this.container?.querySelector('#viewer-loading-text');
    const loadingOverlay = this.container?.querySelector('#viewer-loading');

    const cloudNumPadded = String(this.cloudId).padStart(3, '0');
    const candidatePaths = [
      `data/h5_clouds/cloud_${cloudNumPadded}.h5`,
      `data/h5_clouds/cloud_${this.cloudId}.h5`
    ];

    let virtualFilename = null;
    let FS_ref = null;

    try {
      if (loadingText) loadingText.textContent = `Initializing WebAssembly HDF5 Engine...`;
      const { h5wasm, FS } = await getH5Wasm();
      FS_ref = FS;

      if (this.isDisposed) return;

      let ab = null;
      for (const p of candidatePaths) {
        if (this.isDisposed) return;
        try {
          if (loadingText) loadingText.textContent = `Fetching ${p}...`;
          const resp = await fetch(p, { signal: this.abortController?.signal });
          if (resp.ok) {
            ab = await resp.arrayBuffer();
            break;
          }
        } catch (fetchErr) {
          if (fetchErr.name === 'AbortError' || this.isDisposed) return;
        }
      }

      if (this.isDisposed) return;

      if (!ab) {
        throw new Error(`Could not find .h5 file for Cloud #${this.cloudId}`);
      }

      if (loadingText) loadingText.textContent = `Parsing HDF5 volumetric dataset...`;
      virtualFilename = `temp_cloud_${this.cloudId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.h5`;
      FS.writeFile(virtualFilename, new Uint8Array(ab));
      ab = null; // Immediate release of fetch arrayBuffer

      const f = new h5wasm.File(virtualFilename, 'r');
      const { data: density, shape } = readDatasetAsFloat32(f, 'density');

      const attrs = {};
      for (const [k, v] of Object.entries(f.attrs)) {
        attrs[k] = v.value;
      }

      f.close();

      if (this.isDisposed) return;

      const [nx, ny, nz] = shape;
      const voxelSize = Number(attrs.voxel_size_pc) || 3.125;

      // Adaptive striding for large volumetric grids to stay within WebGL memory budgets
      const maxDim = Math.max(nx, ny, nz);
      const maxTargetDim = 64; // Capped resolution for smooth 60fps WebGL volume rendering
      const step = maxDim > maxTargetDim ? Math.ceil(maxDim / maxTargetDim) : 1;

      const snx = Math.floor((nx - 1) / step) + 1;
      const sny = Math.floor((ny - 1) / step) + 1;
      const snz = Math.floor((nz - 1) / step) + 1;
      const totalPts = snx * sny * snz;

      const xArr = new Float32Array(totalPts);
      const yArr = new Float32Array(totalPts);
      const zArr = new Float32Array(totalPts);
      const valArr = new Float32Array(totalPts);

      const cx = (nx - 1) / 2.0;
      const cy = (ny - 1) / 2.0;
      const cz = (nz - 1) / 2.0;

      let validCount = 0;
      let minD = Infinity;
      let maxD = -Infinity;
      let outIdx = 0;

      for (let si = 0; si < snx; si++) {
        const i = si * step;
        const x_pc = (i - cx) * voxelSize;
        const iOffset = i * ny;
        for (let sj = 0; sj < sny; sj++) {
          const j = sj * step;
          const y_pc = (j - cy) * voxelSize;
          const ijOffset = (iOffset + j) * nz;
          for (let sk = 0; sk < snz; sk++) {
            const k = sk * step;
            const z_pc = (k - cz) * voxelSize;
            const rawIdx = ijOffset + k;
            const dVal = density[rawIdx];
            // Outside mask is NaN; inside cloud is valid positive density
            const isInside = !Number.isNaN(dVal) && dVal > 0;

            xArr[outIdx] = x_pc;
            yArr[outIdx] = y_pc;
            zArr[outIdx] = z_pc;

            // Use 0.0 for background voxels (NaN discards Plotly WebGL volume meshes)
            if (isInside && dVal > 0) {
              valArr[outIdx] = dVal;
              validCount++;
              if (dVal < minD) minD = dVal;
              if (dVal > maxD) maxD = dVal;
            } else {
              valArr[outIdx] = 0.0;
            }
            outIdx++;
          }
        }
      }

      if (minD === Infinity) minD = 0.05;
      if (maxD === -Infinity) maxD = 5.0;

      const isomin = minD > 0 ? minD * 1.1 : 0.05;
      const isomax = maxD > 0 ? maxD * 0.95 : 5.0;

      this.h5Data = {
        cloudId: this.cloudId,
        shape: [nx, ny, nz],
        sampledShape: [snx, sny, snz],
        step,
        voxelSize,
        totalVoxels: nx * ny * nz,
        cloudVoxels: validCount,
        x: xArr,
        y: yArr,
        z: zArr,
        value: valArr,
        minD,
        maxD,
        isomin,
        isomax,
        boxSizePc: [
          (nx * voxelSize).toFixed(1),
          (ny * voxelSize).toFixed(1),
          (nz * voxelSize).toFixed(1)
        ]
      };

      if (this.isDisposed) return;

      if (loadingOverlay) loadingOverlay.style.display = 'none';

      this.renderPlotly();
      this.updateTelemetryUI();

      // Setup auto-resizer
      const canvasBox = this.container?.querySelector('#cloud-3d-canvas-box');
      if (canvasBox && typeof ResizeObserver !== 'undefined' && !this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(() => {
          const plotEl = document.getElementById(this.plotDivId);
          if (plotEl && typeof Plotly !== 'undefined') {
            Plotly.Plots.resize(plotEl);
          }
        });
        this.resizeObserver.observe(canvasBox);
      }
    } catch (err) {
      if (this.isDisposed || err.name === 'AbortError') return;
      console.error('Failed to load 3D H5 cloud:', err);
      if (loadingOverlay) {
        loadingOverlay.innerHTML = `<span style="color: #ef4444; font-weight: 500;">Failed to load HDF5 volume: ${err.message}</span>`;
      }
    } finally {
      if (virtualFilename && FS_ref) {
        try {
          FS_ref.unlink(virtualFilename);
        } catch (_) { }
      }
    }
  }

  buildTrace() {
    const d = this.h5Data;
    if (!d) return null;

    if (this.renderMode === 'isosurface') {
      return {
        type: 'isosurface',
        x: d.x,
        y: d.y,
        z: d.z,
        value: d.value,
        isomin: d.isomin,
        isomax: d.isomax,
        surface: { count: 5, fill: 0.9 },
        opacity: Math.min(0.85, this.opacity * 2.8),
        colorscale: this.currentColormap,
        colorbar: {
          title: {
            text: '<i>n</i><sub>H</sub> (cm<sup>-3</sup>)',
            font: { color: '#cbd5e1', size: 20 }
          },
          tickfont: { color: '#94a3b8', size: 16 },
          len: 0.62,
          thickness: 15,
          x: 1.02,
          y: 0.45,
          yanchor: 'middle'
        },
        slices: {
          z: { show: this.showSlices, locations: [0] }
        },
        caps: { x: { show: false }, y: { show: false }, z: { show: false } },
        lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.3 },
        hoverinfo: 'none',
        hovertemplate: ''
      };
    }

    // Default: True 3D Volume rendering
    return {
      type: 'volume',
      x: d.x,
      y: d.y,
      z: d.z,
      value: d.value,
      isomin: d.isomin,
      isomax: d.isomax,
      opacity: this.opacity,
      surface: { count: this.surfaceCount },
      colorscale: this.currentColormap,
      colorbar: {
        title: {
          text: '<i>n</i><sub>H</sub> (cm<sup>-3</sup>)',
          font: { color: '#cbd5e1', size: 12 }
        },
        tickfont: { color: '#94a3b8', size: 10 },
        len: 0.62,
        thickness: 15,
        x: 1.02,
        y: 0.45,
        yanchor: 'middle'
      },
      slices: {
        z: { show: this.showSlices, locations: [0] }
      },
      caps: { x: { show: false }, y: { show: false }, z: { show: false } },
      lighting: { ambient: 0.65, diffuse: 0.75 },
      hoverinfo: 'none',
      hovertemplate: ''
    };
  }

  buildLayout() {
    return {
      hovermode: false,
      paper_bgcolor: '#06080e',
      plot_bgcolor: '#06080e',
      scene: {
        xaxis: {
          title: { text: 'X [pc]', font: { color: '#94a3b8', size: 11 } },
          tickfont: { color: '#64748b', size: 10 },
          backgroundcolor: '#06080e',
          gridcolor: '#1e293b',
          showbackground: true,
          zerolinecolor: '#334155'
        },
        yaxis: {
          title: { text: 'Y [pc]', font: { color: '#94a3b8', size: 11 } },
          tickfont: { color: '#64748b', size: 10 },
          backgroundcolor: '#06080e',
          gridcolor: '#1e293b',
          showbackground: true,
          zerolinecolor: '#334155'
        },
        zaxis: {
          title: { text: 'Z [pc]', font: { color: '#94a3b8', size: 11 } },
          tickfont: { color: '#64748b', size: 10 },
          backgroundcolor: '#06080e',
          gridcolor: '#1e293b',
          showbackground: true,
          zerolinecolor: '#334155'
        },
        aspectmode: 'data',
        camera: {
          eye: { x: 1.55, y: 1.55, z: 1.25 }
        }
      },
      margin: { l: 0, r: 60, b: 0, t: 36 },
      showlegend: false
    };
  }

  renderPlotly() {
    const plotEl = document.getElementById(this.plotDivId);
    if (!plotEl || typeof Plotly === 'undefined' || !this.h5Data) return;

    const trace = this.buildTrace();
    const layout = this.buildLayout();
    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['sendDataToCloud', 'hoverClosest3d']
    };

    Plotly.newPlot(plotEl, [trace], layout, config);
    this.plotlyPlot = plotEl;
  }

  updatePlotlyTrace() {
    const plotEl = document.getElementById(this.plotDivId);
    if (!plotEl || typeof Plotly === 'undefined' || !this.h5Data) return;

    const trace = this.buildTrace();
    const layout = this.buildLayout();
    Plotly.react(plotEl, [trace], layout);
  }

  resetCamera() {
    const plotEl = document.getElementById(this.plotDivId);
    if (!plotEl || typeof Plotly === 'undefined') return;

    Plotly.relayout(plotEl, {
      'scene.camera': {
        eye: { x: 1.55, y: 1.55, z: 1.25 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 }
      }
    });
  }

  updateTelemetryUI() {
    if (!this.container || !this.h5Data) return;
    const boxEl = this.container.querySelector('#telem-box');
    const voxEl = this.container.querySelector('#telem-voxels');
    const maxdEl = this.container.querySelector('#telem-maxd');

    const [bx, by, bz] = this.h5Data.boxSizePc;
    const [nx, ny, nz] = this.h5Data.shape;
    const step = this.h5Data.step;

    if (boxEl) boxEl.innerHTML = `Box: ${bx} &times; ${by} &times; ${bz} pc`;
    if (voxEl) {
      const stepNote = step > 1 ? ` (${this.h5Data.sampledShape.join('×')} sampled)` : '';
      voxEl.textContent = `Grid: ${nx}×${ny}×${nz}${stepNote}`;
    }
    if (maxdEl) {
      maxdEl.innerHTML = `Max <i>n</i><sub>H</sub>: ${this.h5Data.maxD.toFixed(2)} cm<sup>-3</sup>`;
    }
  }

  dispose() {
    this.isDisposed = true;

    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (_) { }
      this.abortController = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    const plotEl = document.getElementById(this.plotDivId);
    if (plotEl) {
      if (typeof Plotly !== 'undefined') {
        try {
          Plotly.purge(plotEl);
        } catch (_) { }
      }
      plotEl.innerHTML = '';
    }

    if (this.h5Data) {
      this.h5Data.x = null;
      this.h5Data.y = null;
      this.h5Data.z = null;
      this.h5Data.value = null;
      this.h5Data = null;
    }

    this.plotlyPlot = null;
    this.container = null;
  }
}

/**
 * Helper to unmount and completely purge any active 3D cloud volume from memory
 */
export function unmountCloudViewer3D() {
  if (currentViewerInstance) {
    currentViewerInstance.dispose();
    currentViewerInstance = null;
  }
}

/**
 * Helper to mount or switch the 3D Viewer in the given DOM container.
 * Strictly ensures any existing 3D volume instance is unmounted and purged first.
 */
export function mountCloudViewer3D(containerEl, cloudId) {
  unmountCloudViewer3D();

  if (containerEl) {
    currentViewerInstance = new CloudViewer3D(containerEl, cloudId);
  }
  return currentViewerInstance;
}

export function getActive3DViewer() {
  return currentViewerInstance;
}
