/**
 * Cloud Catalog by Model Explorer Component
 * Handles model tab switching, search filtering, cloud card listings,
 * selected cloud inspector, comparison pills, and live density histogram plotting.
 */

import { MODEL_META } from './config.js';
import { state } from './state.js';
import {
  renderLatex,
  triggerKaTeXAutoRender,
  formatScientific,
  showTooltip,
  moveTooltip,
  hideTooltip,
  escapeHtml
} from './utils.js';
import {
  lognormalPDF,
  castaingHopkinsPDF,
  piecewiseLNPL_PDF,
  piecewiseCHPL_PDF
} from './pdfMath.js';
import { mountCloudViewer3D, unmountCloudViewer3D } from './cloudViewer3D.js';

export function getCloudNote(cloudId) {
  if (!state.cloudNotes) return null;
  const key = String(cloudId).trim();
  if (state.cloudNotes[key] !== undefined && state.cloudNotes[key] !== null) {
    return state.cloudNotes[key];
  }
  const intKey = parseInt(cloudId, 10);
  if (!isNaN(intKey) && state.cloudNotes[intKey] !== undefined && state.cloudNotes[intKey] !== null) {
    return state.cloudNotes[intKey];
  }
  return null;
}

export function hasCloudNote(cloudId) {
  const note = getCloudNote(cloudId);
  if (!note) return false;
  if (typeof note === 'string') return note.trim().length > 0;
  if (typeof note === 'object') {
    return Boolean(note.note || note.text || note.content || note.description || (Object.keys(note).length > 0 && !note._schema_description));
  }
  return false;
}

export function initCloudCatalog() {
  setupCatalogModelTabs();
  setupCatalogSearch();
  renderCloudCatalog();
}

function setupCatalogModelTabs() {
  const tabs = document.querySelectorAll('.catalog-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const model = tab.getAttribute('data-model');
      if (model && model !== state.currentCatalogModel) {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.currentCatalogModel = model;
        state.selectedCatalogCloudId = null; // Reset selection to top cloud of model
        renderCloudCatalog();
      }
    });
  });
}

function setupCatalogSearch() {
  const input = document.querySelector('#catalog-search-input');
  if (input) {
    input.addEventListener('input', e => {
      state.catalogSearchQuery = e.target.value.trim().toLowerCase();
      renderCloudCatalog(false); // Keep current selection if possible
    });
  }
}

export function getSortedCloudsForModel(modelKey) {
  let clouds = [];

  if (modelKey === 'Failed') {
    // Show clouds whose preferred_model is 'Failed'
    clouds = state.rawData
      .filter(d => d.preferred_model === 'Failed')
      .map(d => ({
        cloud: d,
        redChi2: d.redChi2 || 0,
        fitInfo: null,
        isPreferred: true
      }));
  } else {
    // Only show clouds whose preferred_model matches this model
    clouds = state.rawData
      .filter(d => d.preferred_model === modelKey)
      .map(d => {
        const fit = d.modelFits && d.modelFits[modelKey];
        const redChi2 = fit && fit.redChi2 !== null && !isNaN(fit.redChi2) ? fit.redChi2 : (d.redChi2 || 0);
        return {
          cloud: d,
          redChi2: redChi2,
          fitInfo: fit,
          isPreferred: true
        };
      });

    // Sort ascending by reduced chi-squared for that model (best fit first)
    clouds.sort((a, b) => a.redChi2 - b.redChi2);
  }

  if (state.catalogSearchQuery) {
    clouds = clouds.filter(item => {
      const idStr = String(item.cloud.cloud_id).toLowerCase();
      const nameStr = String(item.cloud.file_name || '').toLowerCase();
      return idStr.includes(state.catalogSearchQuery) || nameStr.includes(state.catalogSearchQuery);
    });
  }

  return clouds;
}

export function renderCloudCatalog(autoSelectFirst = true) {
  const listContainer = document.querySelector('#catalog-cloud-list');
  const countBadge = document.querySelector('#catalog-count-badge');
  const detailPane = document.querySelector('#catalog-cloud-detail');

  if (!listContainer || !detailPane) return;

  const sortedClouds = getSortedCloudsForModel(state.currentCatalogModel);
  const totalCount = sortedClouds.length;

  if (countBadge) {
    countBadge.textContent = `${totalCount} clouds`;
  }

  listContainer.innerHTML = '';

  if (sortedClouds.length === 0) {
    listContainer.innerHTML = `<div class="catalog-empty-msg">No clouds found for this tab</div>`;
    detailPane.innerHTML = `<div class="catalog-empty-msg">No cloud selected</div>`;
    return;
  }

  // Auto-select first cloud if none selected or selected cloud not in filtered list
  if (autoSelectFirst || !state.selectedCatalogCloudId || !sortedClouds.some(c => c.cloud.cloud_id === state.selectedCatalogCloudId)) {
    state.selectedCatalogCloudId = sortedClouds[0].cloud.cloud_id;
    state.selectedInspectorModel = null;
  }

  sortedClouds.forEach((item, index) => {
    const d = item.cloud;
    const isSelected = d.cloud_id === state.selectedCatalogCloudId;

    const card = document.createElement('div');
    card.className = `catalog-cloud-item ${isSelected ? 'selected' : ''}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    card.setAttribute('data-cloud-id', d.cloud_id);

    const massFormatted = d.mass > 0 ? formatScientific(d.mass) : '—';
    const lengthFormatted = d.lengthScale > 0 ? `${d.lengthScale.toFixed(1)} pc` : '—';
    const chiFormatted = item.redChi2 > 0 ? item.redChi2.toFixed(3) : 'Unconstrained';
    const noteExists = hasCloudNote(d.cloud_id);

    card.innerHTML = `
      <div class="cloud-item-left">
        <div class="cloud-item-title-row">
          <span class="cloud-item-rank">#${index + 1}</span>
          <span class="cloud-item-id">Cloud ${d.cloud_id}</span>
          ${noteExists ? `<span class="cloud-note-badge" title="Has notes in cloud_notes.json">📝</span>` : ''}
        </div>
        <div class="cloud-item-sub">
          <span>L: ${lengthFormatted}</span> · <span>M: ${massFormatted} M☉</span>
        </div>
      </div>
      <div class="cloud-item-right">
        <span class="cloud-chi2-val">${chiFormatted}</span>
        <span class="cloud-chi2-label">${item.redChi2 > 0 ? 'χ²_red' : 'Status'}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      state.selectedCatalogCloudId = d.cloud_id;
      state.selectedInspectorModel = null; // Reset inspector override to catalog model
      listContainer.querySelectorAll('.catalog-cloud-item').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-selected', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-selected', 'true');
      renderCloudDetail(item);
    });

    listContainer.appendChild(card);
  });

  const selectedItem = sortedClouds.find(c => c.cloud.cloud_id === state.selectedCatalogCloudId) || sortedClouds[0];
  if (selectedItem) {
    renderCloudDetail(selectedItem);
  }
}

export function renderCloudDetail(item, activeModelOverride = null) {
  const detailPane = document.querySelector('#catalog-cloud-detail');
  if (!detailPane) return;

  const d = item.cloud;
  
  // If in 'Failed' tab and no model pill selected, activeModelKey is null (no fit overlay by default)
  let activeModelKey = activeModelOverride !== null ? activeModelOverride : state.selectedInspectorModel;
  if (!activeModelKey && state.currentCatalogModel !== 'Failed') {
    activeModelKey = state.currentCatalogModel;
  }

  const fit = (activeModelKey && d.modelFits && d.modelFits[activeModelKey]) ? d.modelFits[activeModelKey] : null;
  const modelMeta = activeModelKey ? (MODEL_META[activeModelKey] || {}) : { name: 'None', abbrTex: '\\text{None}', color: '#64748b' };
  const prefMeta = MODEL_META[d.preferred_model] || {};

  let paramsHtml = '';
  if (activeModelKey === 'gaussian' && fit) {
    paramsHtml = `
      <div class="detail-params-section">
        <div class="detail-params-title">Fitted Log-Normal Parameters</div>
        <div class="detail-params-row">
          <div class="detail-param-item"><span class="p-label">Dispersion (σ_LN):</span><strong class="p-val">${fit.sigma !== null ? fit.sigma.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Mean (μ):</span><strong class="p-val">${fit.mu !== null ? fit.mu.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Amplitude (A):</span><strong class="p-val">${fit.A !== null ? fit.A.toFixed(3) : '—'}</strong></div>
        </div>
      </div>
    `;
  } else if (activeModelKey === 'gauss_exp' && fit) {
    paramsHtml = `
      <div class="detail-params-section">
        <div class="detail-params-title">Fitted LN + Power Law Parameters</div>
        <div class="detail-params-row">
          <div class="detail-param-item"><span class="p-label">Core Dispersion (σ_LN):</span><strong class="p-val">${fit.sigma !== null ? fit.sigma.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Threshold (s_thresh):</span><strong class="p-val">${fit.sThresh !== null ? fit.sThresh.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Power-Law Slope (Λ):</span><strong class="p-val">${fit.lambda !== null ? fit.lambda.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Mean (μ):</span><strong class="p-val">${fit.mu !== null ? fit.mu.toFixed(3) : '—'}</strong></div>
        </div>
      </div>
    `;
  } else if (activeModelKey === 'hopkins' && fit) {
    paramsHtml = `
      <div class="detail-params-section">
        <div class="detail-params-title">Fitted Castaing-Hopkins Parameters</div>
        <div class="detail-params-row">
          <div class="detail-param-item"><span class="p-label">Dispersion (σ_CH):</span><strong class="p-val">${fit.sigma !== null ? fit.sigma.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Intermittency (θ_CH):</span><strong class="p-val">${fit.theta !== null ? fit.theta.toFixed(4) : '—'}</strong></div>
        </div>
      </div>
    `;
  } else if (activeModelKey === 'hopkins_exp' && fit) {
    paramsHtml = `
      <div class="detail-params-section">
        <div class="detail-params-title">Fitted Hopkins + Power Law Parameters</div>
        <div class="detail-params-row">
          <div class="detail-param-item"><span class="p-label">Dispersion (σ_CH):</span><strong class="p-val">${fit.sigma !== null ? fit.sigma.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Intermittency (θ_CH):</span><strong class="p-val">${fit.theta !== null ? fit.theta.toFixed(4) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Threshold (s_thresh):</span><strong class="p-val">${fit.sThresh !== null ? fit.sThresh.toFixed(3) : '—'}</strong></div>
          <div class="detail-param-item"><span class="p-label">Tail Slope (Λ):</span><strong class="p-val">${fit.lambda !== null ? fit.lambda.toFixed(3) : '—'}</strong></div>
        </div>
      </div>
    `;
  } else {
    paramsHtml = `
      <div class="detail-params-section">
        <div class="detail-params-title">Model Parameters</div>
        <p style="font-size: 0.8rem; color: var(--text-sub);">
          ${state.currentCatalogModel === 'Failed' ? 'No model fit selected by default. Click any model pill under the plot to overlay its fit curve.' : 'No fitted parameter data available.'}
        </p>
      </div>
    `;
  }

  // Interactive model comparison table / clickable chips for this cloud
  const comparisonList = [
    { key: 'gaussian', label: 'LN', fit: d.modelFits?.gaussian },
    { key: 'gauss_exp', label: 'LN–PL', fit: d.modelFits?.gauss_exp },
    { key: 'hopkins', label: 'CH', fit: d.modelFits?.hopkins },
    { key: 'hopkins_exp', label: 'CH–PL', fit: d.modelFits?.hopkins_exp }
  ];

  const modelComparisonPills = comparisonList.map(m => {
    const isCurrent = m.key === activeModelKey;
    const isBest = d.preferred_model === m.key;
    const hasFit = m.fit && m.fit.redChi2 !== null && !isNaN(m.fit.redChi2) && m.fit.redChi2 > 0;
    const chiVal = hasFit ? m.fit.redChi2.toFixed(2) : 'Failed';
    const pillColor = MODEL_META[m.key]?.color || 'var(--accent)';
    return `
      <button class="fit-pill fit-pill-btn ${isCurrent ? 'active' : ''} ${!hasFit ? 'disabled' : ''}" 
              data-inspect-model="${m.key}" 
              ${!hasFit ? 'disabled' : ''}
              title="${hasFit ? `Inspect ${m.label} fit curve on this cloud` : 'Fit not converged'}">
        <span class="fit-pill-dot" style="background: ${pillColor};"></span>
        <span class="fit-pill-label" style="font-weight: 700;">${m.label}:</span>
        <strong class="fit-pill-val" style="color: ${isBest ? '#34d399' : (isCurrent ? 'var(--text-highlight)' : 'var(--text-muted)')};">${chiVal}</strong>
        ${isBest ? `<span style="font-size: 0.62rem; color: #34d399; font-weight: 700;">(Best)</span>` : ''}
      </button>
    `;
  }).join('');

  // Fetch histogram CSV and render live Cloud PDF Plot
  const cloudNum = parseInt(d.cloud_id, 10);
  const cloudNumPadded = String(cloudNum).padStart(3, '0');
  const histCsvPath = `data/histograms/cloud_${cloudNumPadded}_density_histogram.csv`;

  const badgeTex = activeModelKey ? (modelMeta.abbrTex || activeModelKey) : (prefMeta.abbrTex || d.preferred_model);
  const badgeColor = activeModelKey ? (modelMeta.color || 'var(--accent)') : (prefMeta.color || '#64748b');

  const is3D = state.cloudInspectorViewMode === '3d';

  detailPane.innerHTML = `
    <div class="detail-header">
      <div class="detail-title-wrap">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <h3 class="detail-cloud-title">Cloud #${d.cloud_id}</h3>
          <span class="theory-badge" style="background: rgba(var(--accent-rgb), 0.1); border-color: ${badgeColor}; color: ${badgeColor};">
            ${renderLatex(badgeTex)}
          </span>
          ${activeModelKey && activeModelKey !== d.preferred_model ? `<span class="active-filter-tag" style="font-size: 0.7rem; padding: 2px 6px;">Overlaying ${modelMeta.name}</span>` : ''}
        </div>
        <p class="detail-cloud-sub">
          Source: <code>${d.file_name || 'cloud_' + d.cloud_id + '.h5'}</code> · Preferred Model: <strong>${renderLatex(prefMeta.abbrTex || d.preferred_model)}</strong>
        </p>
      </div>

      <div class="detail-fit-score-box">
        <div class="score-item">
          <span class="score-label">${activeModelKey ? `Reduced χ² (${modelMeta.name})` : 'Catalog Status'}</span>
          <strong class="score-val" style="color: ${badgeColor};">${fit && fit.redChi2 ? fit.redChi2.toFixed(3) : (d.preferred_model === 'Failed' ? 'Unconstrained' : '—')}</strong>
        </div>
        ${fit && fit.aic !== null ? `
          <div class="score-item" style="border-left: 1px solid var(--panel-border); padding-left: 1rem;">
            <span class="score-label">AIC</span>
            <strong class="score-val" style="font-size: 0.95rem; color: var(--text-muted);">${fit.aic.toFixed(1)}</strong>
          </div>
        ` : ''}
        ${fit && fit.bic !== null ? `
          <div class="score-item" style="border-left: 1px solid var(--panel-border); padding-left: 1rem;">
            <span class="score-label">BIC</span>
            <strong class="score-val" style="font-size: 0.95rem; color: var(--text-muted);">${fit.bic.toFixed(1)}</strong>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- 50% / 50% Inspector Grid: Left PDF/3D Viewer | Right Parameters & Metadata -->
    <div class="detail-content-columns">
      <!-- Left Column: Density PDF Plot / 3D Cloud View (50%) -->
      <div class="detail-plot-section">
        <div class="detail-plot-header">
          <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap;">
            <div>
              <span class="controls-title">${is3D ? `3D Cloud Volume View` : `Density PDF $p(s)$ vs $s$`}</span>
              <span class="controls-hint">${is3D ? `Interactive 3D WebGL volume with density colormap` : (activeModelKey ? `Data bins ($\\text{SNR} \\ge 5$) &amp; Fitted Line` : `Data bins ($\\text{SNR} \\ge 5$)`)}</span>
            </div>
          </div>

          <!-- View Mode Switcher: PDF vs 3D View -->
          <div class="detail-view-mode-toggle" role="tablist" aria-label="Cloud visualization view mode">
            <button class="view-mode-btn ${!is3D ? 'active' : ''}" data-view-mode="pdf" id="btn-view-pdf" title="View 2D Logarithmic Density PDF and model fits">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <span>Density PDF</span>
            </button>
            <button class="view-mode-btn ${is3D ? 'active' : ''}" data-view-mode="3d" id="btn-view-3d" title="View interactive 3D WebGL density volume">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              <span>3D View</span>
            </button>
          </div>
        </div>

        <div id="cloud-detail-plot" class="cloud-detail-plot-svg-wrapper ${is3D ? 'is-3d-active' : ''}">
          <div class="detail-plot-loading">Loading ${is3D ? '3D cloud volume' : 'density histogram'}...</div>
        </div>

        <!-- Model Comparison Strip inside the Plot Box (hidden or secondary in 3D mode) -->
        <div class="detail-plot-models-strip">
          <div class="detail-plot-models-header">
            <span class="detail-plot-models-label">Model Fits ($\\chi^2_{\\text{red}}$)</span>
            <span class="detail-plot-models-hint">Click a model to overlay fit curve</span>
          </div>
          <div class="fit-stats-pills detail-plot-pills">
            ${modelComparisonPills}
          </div>
        </div>
      </div>

      <!-- Right Column: Model Parameters & Physical Properties (50%) -->
      <div class="detail-params-column">
        <!-- Parameter Strip -->
        ${paramsHtml}

        <!-- Physical Properties Grid -->
        <div class="detail-grid-metrics">
          <div class="detail-metric-card">
            <span class="label">Mass ($M$)</span>
            <strong class="val">${formatScientific(d.mass)} M☉</strong>
          </div>
          <div class="detail-metric-card">
            <span class="label">Length Scale ($L$)</span>
            <strong class="val">${d.lengthScale > 0 ? d.lengthScale.toFixed(2) + ' pc' : '—'}</strong>
          </div>
          <div class="detail-metric-card">
            <span class="label">Cloud Radius</span>
            <strong class="val">${d.cloud_radius_pc ? parseFloat(d.cloud_radius_pc).toFixed(2) + ' pc' : '—'}</strong>
          </div>
          <div class="detail-metric-card">
            <span class="label">Galactic Coordinates</span>
            <strong class="val" style="font-size: 0.88rem;">
              ${d.galactic_l_deg ? `l=${parseFloat(d.galactic_l_deg).toFixed(1)}°, b=${parseFloat(d.galactic_b_deg).toFixed(1)}°` : '—'}
            </strong>
          </div>
          <div class="detail-metric-card">
            <span class="label">Distance</span>
            <strong class="val">${d.distance_pc ? parseFloat(d.distance_pc).toFixed(0) + ' pc' : '—'}</strong>
          </div>
          <div class="detail-metric-card">
            <span class="label">Voxel Size</span>
            <strong class="val">${d.voxel_size_pc ? parseFloat(d.voxel_size_pc).toFixed(3) + ' pc' : '—'}</strong>
          </div>
        </div>

        <!-- Notes & Observations Section for This Cloud -->
        ${(() => {
          const rawNote = getCloudNote(d.cloud_id);
          if (hasCloudNote(d.cloud_id)) {
            let noteText = '';
            let noteTag = null;
            let noteMetaStr = '';
            if (typeof rawNote === 'string') {
              noteText = rawNote.trim();
            } else if (typeof rawNote === 'object') {
              noteText = (rawNote.note || rawNote.text || rawNote.content || rawNote.description || JSON.stringify(rawNote)).trim();
              noteTag = rawNote.tag || rawNote.category || rawNote.label || null;
              const metaParts = [rawNote.author ? `Author: ${rawNote.author}` : null, rawNote.date ? `Date: ${rawNote.date}` : null].filter(Boolean);
              if (metaParts.length > 0) {
                noteMetaStr = metaParts.join(' · ');
              }
            }

            return `
              <div class="detail-notes-section">
                <div class="detail-notes-header">
                  <div class="detail-notes-title-group">
                    <svg class="notes-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span class="detail-notes-title">Cloud Notes &amp; Observations</span>
                  </div>
                  ${noteTag ? `<span class="notes-tag-pill">${escapeHtml(noteTag)}</span>` : ''}
                </div>
                <div class="detail-notes-body">
                  <p class="detail-notes-text">${escapeHtml(noteText)}</p>
                  ${noteMetaStr ? `<div class="detail-notes-meta">${escapeHtml(noteMetaStr)}</div>` : ''}
                </div>
              </div>
            `;
          }
          return '';
        })()}
      </div>
    </div>
  `;

  // Attach View Mode Switcher events
  detailPane.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view-mode');
      if (mode && mode !== state.cloudInspectorViewMode) {
        if (mode !== '3d') {
          unmountCloudViewer3D();
        }
        state.cloudInspectorViewMode = mode;
        renderCloudDetail(item, activeModelKey);
      }
    });
  });

  // Attach click events on comparison pills to toggle active fit model preview
  detailPane.querySelectorAll('.fit-pill-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const targetModel = btn.getAttribute('data-inspect-model');
      if (targetModel) {
        if (state.selectedInspectorModel === targetModel && state.currentCatalogModel === 'Failed') {
          state.selectedInspectorModel = null; // toggle off for Failed tab
          renderCloudDetail(item, null);
        } else {
          state.selectedInspectorModel = targetModel;
          renderCloudDetail(item, targetModel);
        }
      }
    });
  });

  if (state.cloudInspectorViewMode === '3d') {
    const plotContainer = detailPane.querySelector('#cloud-detail-plot');
    if (plotContainer) {
      mountCloudViewer3D(plotContainer, d.cloud_id);
    }
  } else {
    // Zero 3D volumetric data in memory when viewing Density PDF mode
    unmountCloudViewer3D();
    renderCloudDetailPlot(histCsvPath, d, fit, activeModelKey);
  }

  triggerKaTeXAutoRender();
}

export function renderCloudDetailPlot(histCsvPath, cloudData, fitInfo, modelKey) {
  const container = document.querySelector('#cloud-detail-plot');
  if (!container) return;

  const rawCid = cloudData?.cloud_id;
  const numCid = rawCid !== undefined ? String(parseInt(rawCid, 10)) : null;

  const cachedPoints = state.histograms?.[rawCid] || state.histograms?.[numCid] || state.histograms?.[String(rawCid)];

  if (cachedPoints && Array.isArray(cachedPoints) && cachedPoints.length > 0) {
    const binCenters = cachedPoints.map(pt => pt[0]);
    const meanCounts = cachedPoints.map(pt => pt[1]);
    const errorCounts = cachedPoints.map(pt => pt[2]);
    drawHistogramPlot(container, cloudData, binCenters, meanCounts, errorCounts, fitInfo, modelKey);
    return;
  }

  console.warn(`[renderCloudDetailPlot] No cached histogram found in state.histograms for cloud_id "${rawCid}" (parsed: "${numCid}"). Available keys count:`, Object.keys(state.histograms || {}).length);

  // Fallback to standalone CSV if consolidated JSON is unavailable
  d3.csv(histCsvPath).then(histRows => {
    const binCenters = [];
    const meanCounts = [];
    const errorCounts = [];

    histRows.forEach(row => {
      const bc = parseFloat(row.bin_center);
      const mc = parseFloat(row.mean_count);
      const ec = parseFloat(row.error_count);
      if (!isNaN(bc) && !isNaN(mc) && !isNaN(ec)) {
        binCenters.push(bc);
        meanCounts.push(mc);
        errorCounts.push(ec);
      }
    });

    drawHistogramPlot(container, cloudData, binCenters, meanCounts, errorCounts, fitInfo, modelKey);
  }).catch(err => {
    container.innerHTML = `<div class="catalog-empty-msg">Could not load density histogram for Cloud #${cloudData.cloud_id}</div>`;
  });
}

function drawHistogramPlot(container, cloudData, binCenters, meanCounts, errorCounts, fitInfo, modelKey) {
  container.innerHTML = '';

    if (binCenters.length < 2) {
      container.innerHTML = `<div class="catalog-empty-msg">Insufficient histogram data for Cloud #${cloudData.cloud_id}</div>`;
      return;
    }

    // Bin width dx (grid resolution is 0.1 in log-density)
    const dx = 0.1;

    // 1. Normalize histogram to PDF (as in utils.normalize_histogram_to_pdf)
    let totalCount = 0;
    for (let i = 0; i < meanCounts.length; i++) {
      totalCount += meanCounts[i];
    }
    const totalArea = totalCount * dx;
    if (totalArea <= 0) {
      container.innerHTML = `<div class="catalog-empty-msg">Total histogram area is zero for Cloud #${cloudData.cloud_id}</div>`;
      return;
    }

    // 2. Filter by SNR >= 5 (as in utils.filter_by_snr)
    const filteredPoints = [];
    for (let i = 0; i < binCenters.length; i++) {
      const mc = meanCounts[i];
      const ec = errorCounts[i];
      const snr = ec > 0 ? mc / ec : 0;
      if (snr >= 5.0 && mc > 0) {
        const pdf = mc / totalArea;
        const pdfErr = (ec / mc) * pdf;
        filteredPoints.push({
          s: binCenters[i],
          pdf,
          pdfErr,
          meanCount: mc,
          errorCount: ec,
          snr
        });
      }
    }

    if (filteredPoints.length === 0) {
      container.innerHTML = `<div class="catalog-empty-msg">No bins with SNR ≥ 5 found for Cloud #${cloudData.cloud_id}</div>`;
      return;
    }

    // SVG Setup - 1:1 Square Plot Area
    const svgSize = 480;
    const margin = { top: 25, right: 30, bottom: 52, left: 60 };
    const innerW = svgSize - margin.left - margin.right;
    const innerH = svgSize - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${svgSize} ${svgSize}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', '100%')
      .style('display', 'block');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Domains
    const sMin = d3.min(filteredPoints, d => d.s) - 0.5;
    const sMax = d3.max(filteredPoints, d => d.s) + 0.5;
    const maxDataPdf = d3.max(filteredPoints, d => d.pdf + d.pdfErr);

    const xScale = d3.scaleLinear().domain([sMin, sMax]).range([0, innerW]);
    const yScale = d3.scaleLog().domain([1e-4, Math.max(1.2, maxDataPdf * 1.6)]).range([innerH, 0]).clamp(true);

    // Vertical grid lines
    const xTicks = xScale.ticks(7);
    xTicks.forEach(tick => {
      g.append('line')
        .attr('x1', xScale(tick))
        .attr('x2', xScale(tick))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', 'rgba(255, 255, 255, 0.05)')
        .attr('stroke-dasharray', '2, 2');
    });

    // Horizontal grid lines
    const yGridTicks = [1e-4, 1e-3, 1e-2, 1e-1, 1e0, 1e1].filter(y => y >= yScale.domain()[0] && y <= yScale.domain()[1]);
    yGridTicks.forEach(tick => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(tick))
        .attr('y2', yScale(tick))
        .attr('stroke', 'rgba(255, 255, 255, 0.05)')
        .attr('stroke-dasharray', '2, 2');
    });

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(7);
    const yAxis = d3.axisLeft(yScale).ticks(5, '.0e');

    g.append('g')
      .attr('class', 'theory-axis')
      .attr('transform', `translate(0, ${innerH})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'theory-axis')
      .call(yAxis);

    // Axis Labels
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ba3b5')
      .attr('font-size', '12px')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .text('s = ln(ρ / ⟨ρ⟩)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -44)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ba3b5')
      .attr('font-size', '12px')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .text('p(s) [log scale]');

    // Evaluate Fitted Model Curve (if a model is active and has parameters)
    if (modelKey && fitInfo) {
      const modelMeta = MODEL_META[modelKey] || { color: '#38bdf8' };
      const numCurvePoints = 200;
      const curveStep = (sMax - sMin) / (numCurvePoints - 1);
      const curvePoints = [];

      for (let i = 0; i < numCurvePoints; i++) {
        const s = sMin + i * curveStep;
        let pVal = 0;
        if (modelKey === 'gaussian' && fitInfo.sigma) {
          pVal = lognormalPDF(s, fitInfo.sigma, fitInfo.mu);
        } else if (modelKey === 'gauss_exp' && fitInfo.sigma && fitInfo.sThresh && fitInfo.lambda) {
          pVal = piecewiseLNPL_PDF(s, fitInfo.sigma, fitInfo.sThresh, fitInfo.lambda, fitInfo.mu);
        } else if (modelKey === 'hopkins' && fitInfo.sigma && fitInfo.theta) {
          pVal = castaingHopkinsPDF(s, fitInfo.sigma, fitInfo.theta);
        } else if (modelKey === 'hopkins_exp' && fitInfo.sigma && fitInfo.theta && fitInfo.sThresh && fitInfo.lambda) {
          pVal = piecewiseCHPL_PDF(s, fitInfo.sigma, fitInfo.theta, fitInfo.sThresh, fitInfo.lambda);
        }
        curvePoints.push({ s, p: Math.max(1e-6, pVal) });
      }

      // Line generator
      const lineGen = d3.line()
        .x(d => xScale(d.s))
        .y(d => yScale(Math.max(1e-4, d.p)))
        .curve(d3.curveMonotoneX);

      // Draw Overlaid Fit Line
      g.append('path')
        .datum(curvePoints)
        .attr('fill', 'none')
        .attr('stroke', modelMeta.color || '#38bdf8')
        .attr('stroke-width', 2.2)
        .attr('d', lineGen);
    }

    // Draw Error Bars for Data Points
    const errGroup = g.append('g').attr('class', 'data-error-bars');
    filteredPoints.forEach(pt => {
      const yBottom = yScale(Math.max(1e-4, pt.pdf - pt.pdfErr));
      const yTop = yScale(Math.max(1e-4, pt.pdf + pt.pdfErr));
      const xPos = xScale(pt.s);

      errGroup.append('line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', yTop)
        .attr('y2', yBottom)
        .attr('stroke', 'rgba(255, 255, 255, 0.45)')
        .attr('stroke-width', 1.2);

      // Tick caps on error bars
      errGroup.append('line')
        .attr('x1', xPos - 2.5)
        .attr('x2', xPos + 2.5)
        .attr('y1', yTop)
        .attr('y2', yTop)
        .attr('stroke', 'rgba(255, 255, 255, 0.45)')
        .attr('stroke-width', 1.2);

      errGroup.append('line')
        .attr('x1', xPos - 2.5)
        .attr('x2', xPos + 2.5)
        .attr('y1', yBottom)
        .attr('y2', yBottom)
        .attr('stroke', 'rgba(255, 255, 255, 0.45)')
        .attr('stroke-width', 1.2);
    });

    // Draw Data Point Circles
    g.selectAll('.cloud-pdf-dot')
      .data(filteredPoints)
      .join('circle')
      .attr('class', 'cloud-pdf-dot')
      .attr('cx', d => xScale(d.s))
      .attr('cy', d => yScale(Math.max(1e-4, d.pdf)))
      .attr('r', 3.5)
      .attr('fill', '#ffffff')
      .attr('stroke', '#090b10')
      .attr('stroke-width', 1)
      .on('mouseenter', function (event, pt) {
        const hoverColor = (modelKey && MODEL_META[modelKey]?.color) || '#38bdf8';
        d3.select(this).attr('r', 6).attr('fill', hoverColor);
        showTooltip(event, `
          <div class="tooltip-title">Cloud #${cloudData.cloud_id} Data Bin</div>
          <div class="tooltip-row"><span class="label">s:</span><span class="val">${pt.s.toFixed(2)}</span></div>
          <div class="tooltip-row"><span class="label">PDF p(s):</span><span class="val">${pt.pdf.toExponential(3)} ± ${pt.pdfErr.toExponential(3)}</span></div>
          <div class="tooltip-row"><span class="label">Raw Counts:</span><span class="val">${pt.meanCount.toLocaleString()}</span></div>
          <div class="tooltip-row"><span class="label">SNR:</span><span class="val">${pt.snr.toFixed(1)}</span></div>
        `);
      })
      .on('mousemove', moveTooltip)
      .on('mouseleave', function () {
        d3.select(this).attr('r', 3.5).attr('fill', '#ffffff');
        hideTooltip();
      });
}
