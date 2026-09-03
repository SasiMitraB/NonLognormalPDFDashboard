/**
 * Supplementary Material for Behara & Seta 2026
 * Interactive Astrophysical Dashboard for 3D Turbulent Cloud Density PDF Fitting
 * Main Application Orchestrator
 */

import { SUCCESSFUL_MODELS } from './js/config.js';
import { state } from './js/state.js';
import { triggerKaTeXAutoRender } from './js/utils.js';
import { initDonutChart, renderLegend, updateDonutVisuals, updateLegendVisuals, setModelFilterCallback } from './js/donutChart.js';
import { initScatterPlot, updateScatterPlot } from './js/scatterPlot.js';
import { initTheorySandbox, resizeTheoryPlot } from './js/theorySandbox.js';
import { initCloudCatalog } from './js/cloudCatalog.js';
import { initHeroCloud } from './js/heroCloud.js';

/* ── Toggle Model Filter ── */
export function toggleModelFilter(modelKey) {
  if (state.selectedModel === modelKey) {
    state.selectedModel = null; // toggle off -> All Models
  } else {
    state.selectedModel = modelKey;
  }

  updateDonutVisuals();
  updateLegendVisuals();
  updateScatterPlot(true);
}

// Connect donut/legend click events to model filter toggling
setModelFilterCallback(toggleModelFilter);

/* ── App Initialization ── */
export function initDashboard() {
  const statusDot = document.querySelector('#status-dot');
  const loadStatus = document.querySelector('#load-status');
  if (statusDot) statusDot.className = 'status-dot loading';
  if (loadStatus) loadStatus.textContent = 'Loading catalog data…';

  // Trigger initial LaTeX rendering for static elements
  triggerKaTeXAutoRender();

  // Initialize rotating 3D cloud in Hero section (Cloud #441)
  initHeroCloud(441);

  Promise.all([
    d3.csv('data/merged_data.csv'),
    d3.json('data/histograms.json').catch(err => {
      console.warn('[app.js] Notice: Could not load data/histograms.json.', err);
      return {};
    }),
    d3.json('data/cloud_notes.json').catch(err => {
      console.warn('[app.js] Notice: Could not load data/cloud_notes.json (using default empty notes).', err);
      return {};
    })
  ]).then(([data, histograms, notes]) => {
    state.histograms = histograms || {};
    state.cloudNotes = (notes && typeof notes === 'object') ? notes : {};
    state.rawData = data.map(d => {
      let model = d.preferred_model && d.preferred_model.trim() !== '' ? d.preferred_model.trim() : 'Failed';
      const hTheta = parseFloat(d.h_theta);
      const heTheta = parseFloat(d.he_theta);

      // Reshuffle models when Hopkins intermittency parameter theta < 0.01 (limiting case -> Log-Normal)
      if (model === 'hopkins' && !isNaN(hTheta) && hTheta < 0.01) {
        model = 'gaussian';
      } else if (model === 'hopkins_exp' && !isNaN(heTheta) && heTheta < 0.01) {
        model = 'gauss_exp';
      }

      const mass = parseFloat(d.Mass_Msun) || 0;
      const lengthScale = parseFloat(d.Length_Scale_pc) || 0;
      const sigma = parseFloat(d.best_sigma) || 0;
      const redChi2 = parseFloat(d.best_red_chi2) || 0;

      // Model-specific fit parameters and reduced chi-squares
      const modelFits = {
        gaussian: {
          success: d.g_success === 'True' || d.g_success === true,
          redChi2: parseFloat(d.g_red_chi2) || null,
          chi2: parseFloat(d.g_chi2) || null,
          aic: parseFloat(d.g_aic) || null,
          bic: parseFloat(d.g_bic) || null,
          sigma: parseFloat(d.g_sigma) || null,
          mu: parseFloat(d.g_mu) || null,
          A: parseFloat(d.g_A) || null
        },
        gauss_exp: {
          success: d.ge_success === 'True' || d.ge_success === true,
          redChi2: parseFloat(d.ge_red_chi2) || null,
          chi2: parseFloat(d.ge_chi2) || null,
          aic: parseFloat(d.ge_aic) || null,
          bic: parseFloat(d.ge_bic) || null,
          sigma: parseFloat(d.ge_sigma) || null,
          mu: parseFloat(d.ge_mu) || null,
          sThresh: parseFloat(d.ge_x_thresh) || null,
          lambda: parseFloat(d.ge_lambda) || null,
          A: parseFloat(d.ge_A) || null
        },
        hopkins: {
          success: d.h_success === 'True' || d.h_success === true,
          redChi2: parseFloat(d.h_red_chi2) || null,
          chi2: parseFloat(d.h_chi2) || null,
          aic: parseFloat(d.h_aic) || null,
          bic: parseFloat(d.h_bic) || null,
          sigma: parseFloat(d.h_sigma) || null,
          theta: parseFloat(d.h_theta) || null
        },
        hopkins_exp: {
          success: d.he_success === 'True' || d.he_success === true,
          redChi2: parseFloat(d.he_red_chi2) || null,
          chi2: parseFloat(d.he_chi2) || null,
          aic: parseFloat(d.he_aic) || null,
          bic: parseFloat(d.he_bic) || null,
          sigma: parseFloat(d.he_sigma) || null,
          theta: parseFloat(d.he_theta) || null,
          sThresh: parseFloat(d.he_x_thresh) || null,
          lambda: parseFloat(d.he_lambda_exp) || null
        }
      };

      return {
        ...d,
        cloud_id: d.cloud_id || d.file_name?.replace(/[^0-9]/g, '') || '—',
        mass,
        lengthScale,
        sigma,
        redChi2,
        preferred_model: model,
        modelFits
      };
    });

    state.totalClouds = state.rawData.length;
    const fittedData = state.rawData.filter(d => SUCCESSFUL_MODELS.includes(d.preferred_model));
    state.totalFitted = fittedData.length;
    const failedClouds = state.totalClouds - state.totalFitted;

    const powerLawCount = state.rawData.filter(d => d.preferred_model === 'gauss_exp' || d.preferred_model === 'hopkins_exp').length;
    const hopkinsCount = state.rawData.filter(d => d.preferred_model === 'hopkins' || d.preferred_model === 'hopkins_exp').length;

    const fittedPct = ((state.totalFitted / state.totalClouds) * 100).toFixed(1);
    const powerLawPct = state.totalFitted > 0 ? ((powerLawCount / state.totalFitted) * 100).toFixed(1) : 0;
    const hopkinsPct = state.totalFitted > 0 ? ((hopkinsCount / state.totalFitted) * 100).toFixed(1) : 0;

    // Populate Executive Metrics
    const statTotal = document.querySelector('#stat-total-clouds');
    const statFitted = document.querySelector('#stat-fitted-clouds');
    const statFittedPctBadge = document.querySelector('#stat-fitted-pct-badge');
    const statFittedMeta = document.querySelector('#stat-fitted-meta');
    const statPowerLawCount = document.querySelector('#stat-powerlaw-count');
    const statPowerLawPct = document.querySelector('#stat-powerlaw-pct');
    const statHopkinsCount = document.querySelector('#stat-hopkins-count');
    const statHopkinsPct = document.querySelector('#stat-hopkins-pct');

    if (statTotal) statTotal.textContent = state.totalClouds.toLocaleString();
    if (statFitted) statFitted.textContent = state.totalFitted.toLocaleString();
    if (statFittedPctBadge) statFittedPctBadge.textContent = `${fittedPct}%`;
    if (statFittedMeta) statFittedMeta.textContent = `${fittedPct}% converged (${failedClouds} failed / unconstrained)`;

    if (statPowerLawCount) statPowerLawCount.textContent = powerLawCount.toLocaleString();
    if (statPowerLawPct) statPowerLawPct.textContent = `${powerLawPct}%`;

    if (statHopkinsCount) statHopkinsCount.textContent = hopkinsCount.toLocaleString();
    if (statHopkinsPct) statHopkinsPct.textContent = `${hopkinsPct}%`;

    // Aggregate counts for Donut and Legend
    const countsMap = d3.rollup(state.rawData, v => v.length, d => d.preferred_model);
    const allModelsList = ['gaussian', 'hopkins', 'gauss_exp', 'hopkins_exp', 'Failed'];
    const distributionData = allModelsList.map(m => ({
      model: m,
      count: countsMap.get(m) || 0
    })).filter(d => d.count > 0);

    // Render Components
    initDonutChart(distributionData);
    renderLegend(distributionData);
    initScatterPlot();
    initTheorySandbox();
    initCloudCatalog();

    // Re-render LaTeX for dynamic elements
    triggerKaTeXAutoRender();

    // Reset button
    const resetBtn = document.querySelector('#btn-reset-filter');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.selectedModel = null;
        updateDonutVisuals();
        updateLegendVisuals();
        updateScatterPlot(true);
      });
    }

    // Handle Window Resize
    window.addEventListener('resize', () => {
      initDonutChart(distributionData);
      updateDonutVisuals();
      initScatterPlot();
      resizeTheoryPlot();
    });

    if (statusDot) statusDot.className = 'status-dot';
    if (loadStatus) loadStatus.textContent = 'Catalog loaded';
  }).catch(err => {
    console.error('[app.js] Error loading catalog CSV:', err);
    if (statusDot) statusDot.className = 'status-dot error';
    if (loadStatus) loadStatus.textContent = 'Failed to load catalog data';
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);
