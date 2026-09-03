/**
 * Interactive Theory Sandbox & PDF Simulator Component
 */

import { state } from './state.js';
import { renderLatex, triggerKaTeXAutoRender, showTooltip, hideTooltip } from './utils.js';
import {
  lognormalPDF,
  castaingHopkinsPDF,
  piecewiseLNPL_PDF,
  piecewiseCHPL_PDF
} from './pdfMath.js';

// Theory Configuration & Model Metadata
export const THEORY_CONFIG = {
  gaussian: {
    key: 'gaussian',
    title: 'Lognormal PDF',
    badgeTex: '\\mathcal{LN}',
    badgeClass: 'badge-ln',
    themeClass: 'theme-gaussian',
    color: '#38bdf8',
    subtitle: 'Turbulent Model I · Lognormal PDF',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathrm{LN}}', label: 'Dispersion (σ_LN)', min: 0.3, max: 2.5, step: 0.05, default: 1.0, desc: 'Turbulent density dispersion.' }
    ],
    evaluate: (s, p) => lognormalPDF(s, p.sigma),
    formulaTex: '\\mathrm{PDF}(s) = \\frac{1}{\\sigma_{\\mathrm{LN}} \\sqrt{2\\pi}} \\exp\\left( -\\frac{(s - \\mu_s)^2}{2 \\sigma_{\\mathrm{LN}}^2} \\right)',
    paramsTex: '\\mu_s = -\\frac{1}{2}\\sigma_{\\mathrm{LN}}^2 \\quad \\text{(Mean density preservation: } \\langle \\rho/\\rho_0 \\rangle = 1\\text{)}',
    blocks: [
      {
        heading: 'Multiplicative Perturbations & Central Limit Theorem',
        text: 'The lognormal model of the density PDF (Vazquez-Semadeni 1994; Federrath et al. 2008) begins with the idea that the perturbations in the density field are multiplicative, and the logarithm of the density field is a sum of these perturbations. Assuming infinitely many identically distribtued perturbations, the central limit therorem gives a normal distribution for the PDF of $s = \\ln(\\rho / \\rho_0)$.'
      },
      {
        heading: "Current Status",
        text: "This model has been widely tested against simulations (Federrath et al. 2008). When workign with column density observations, the PDF of column density is assumed to follow a Lognormal Distribution (Schneider et al. 2022; Burkhart 2018)."
      }
    ]
  },
  hopkins: {
    key: 'hopkins',
    title: 'Castaing-Hopkins PDF',
    badgeTex: '\\mathcal{CH}',
    badgeClass: 'badge-ch',
    themeClass: 'theme-hopkins',
    color: '#34d399',
    subtitle: 'Turbulent Model II · Log-Poisson Model',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathcal{CH}}', label: 'Dispersion (σ_CH)', min: 0.3, max: 2.5, step: 0.05, default: 1.0, desc: 'Base turbulent dispersion across the cloud volume.' },
      { id: 'theta', nameTex: '\\theta_{\\mathcal{CH}}', label: 'Intermittency (θ_CH)', min: 0.001, max: 0.40, step: 0.01, default: 0.15, desc: 'Intermittency parameter capturing non-Gaussian skewness.' }
    ],
    evaluate: (s, p) => castaingHopkinsPDF(s, p.sigma, p.theta),
    formulaTex: '\\mathrm{PDF}(s) = \\sqrt{\\frac{\\lambda}{\\theta^2 \\omega}} \\, \\tilde{I}_1(2\\sqrt{\\lambda \\omega}) \\exp\\left[-\\left(\\sqrt{\\lambda} - \\sqrt{\\omega}\\right)^2\\right]',
    paramsTex: '\\lambda = \\frac{\\sigma_{\\mathrm{CH}}^2}{2\\theta_{\\mathrm{CH}}^2}, \\quad \\omega = \\frac{\\lambda}{1+\\theta_{\\mathrm{CH}}} - \\frac{s}{\\theta_{\\mathrm{CH}}}, \\quad \\tilde{I}_1(x) = I_1(x) e^{-x}',
    blocks: [
      {
        heading: 'Intermittent Cascade & Skewed PDF',
        text: 'Postulating that Density Statistics should more closely follow the velocity statistics proposed in Castaing (1996), Hopkins (2013) proposed this model. This introduces a new parameter, intermittency ($\theta_\\mathcal{CH}$), which captures the deviation from lognormality. In the limit of small intermittency ($\theta_\\mathcal{CH} \\to 0$), the model smoothly converges to the standard lognormal PDF.'
      },
      {
        heading: 'Maximum Allowed Turbulent Density)',
        text: 'A unique feature of this model, that isn\'t seen in the Lognormal Model is the maximum allowed density.The mathematical constraint $\\omega > 0$ enforces an upper bound on density generated purely by turbulent compression: $$s_{\\mathrm{max}} = \\frac{\\lambda \\theta_\\mathcal{CH}}{1+\\theta_\\mathcal{CH}}$$ Beyond $s_{\\mathrm{max}}$, the probability strictly vanishes, producing a finite, sharp high-density cutoff.'
      },
      {
        heading: "Current Status",
        text: "The model is tested widely against simulations (Hopkins 2013; Squire & Hopkins 2017). However, it is not seen observationally due to the reliance of column density PDFs, which are integrated along the line of sight, washing out the intermittency and the asymmetry of the true PDF."
      }
    ]
  },
  gauss_exp: {
    key: 'gauss_exp',
    title: 'LN + Power Law (Gravoturbulent)',
    badgeTex: '\\mathcal{LN}\\text{–}\\mathcal{PL}',
    badgeClass: 'badge-lnpl',
    themeClass: 'theme-gauss_exp',
    color: '#fbbf24',
    subtitle: 'Gravoturbulent Model · Lognormal core + self-gravitating tail',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathrm{LN}}', label: 'Core Dispersion (σ_LN)', min: 0.3, max: 2.2, step: 0.05, default: 1.0, desc: 'Dispersion of the turbulent lognormal core.' },
      { id: 'sThresh', nameTex: 's_{\\mathrm{thresh}}', label: 'Transition Threshold (s_thresh)', min: -0.5, max: 3.0, step: 0.1, default: 1.0, desc: 'Density where self-gravity overcomes turbulent support.' },
      { id: 'lambda', nameTex: '\\Lambda', label: 'Power-Law Slope (Λ)', min: 0.5, max: 4.0, step: 0.1, default: 2.0, desc: 'Decay slope of high-density tail (shallower = faster collapse).' }
    ],
    evaluate: (s, p) => piecewiseLNPL_PDF(s, p.sigma, p.sThresh, p.lambda),
    formulaTex: '\\mathrm{PDF}(s) = \\begin{cases} A \\cdot \\frac{1}{\\sigma_{\\mathrm{LN}} \\sqrt{2\\pi}} \\exp\\left( -\\frac{(s - \\mu_s)^2}{2 \\sigma_{\\mathrm{LN}}^2} \\right) & \\text{if } s < s_{\\mathrm{thresh}}, \\\\[8pt] C \\cdot f_{\\mathrm{LN}}(s_{\\mathrm{thresh}})\\, e^{-\\Lambda (s - s_{\\mathrm{thresh}})} & \\text{if } s \\geq s_{\\mathrm{thresh}} \\end{cases}',
    paramsTex: 'A = \\left[ F(s_{\\mathrm{thresh}}) + \\frac{f(s_{\\mathrm{thresh}})}{\\Lambda} \\right]^{-1} \\quad \\text{(C determined by continuity constraint)}',
    blocks: [
      {
        heading: 'Gravitational Collapse & Power-Law Tails',
        text: 'Gravity affects the density PDF by creating a power-law decay at higher densities in $\\rho$, which manifests as an exponential decay in $s$ (Klessen 2001). In general, above a given threshold density $s_\\mathrm{thresh}$, the PDF can be modelled as: $PDF(s) \\propto e^{-\\Lambda s}$ where $\\Lambda$ is the power-law slope. The turbulent PDF core ($\\mathcal{LN}$ here), is extended in a piecewise continious manner.'
      },
    ]
  },
  hopkins_exp: {
    key: 'hopkins_exp',
    title: 'Hopkins + Power Law (Gravoturbulent)',
    badgeTex: '\\mathcal{CH}\\text{–}\\mathcal{PL}',
    badgeClass: 'badge-chpl',
    themeClass: 'theme-hopkins_exp',
    color: '#f87171',
    subtitle: 'Gravoturbulent Model · Intermittent core + self-gravitating tail',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathrm{CH}}', label: 'Core Dispersion (σ_CH)', min: 0.3, max: 2.2, step: 0.05, default: 1.0, desc: 'Dispersion of the intermittent turbulent base.' },
      { id: 'theta', nameTex: '\\theta_{\\mathrm{CH}}', label: 'Intermittency (θ_CH)', min: 0.001, max: 0.40, step: 0.01, default: 0.15, desc: 'Intermittency parameter of the turbulent core.' },
      { id: 'sThresh', nameTex: 's_{\\mathrm{thresh}}', label: 'Transition Threshold (s_thresh)', min: -0.5, max: 3.0, step: 0.1, default: 1.0, desc: 'Density where self-gravity takes over the intermittent core.' },
      { id: 'lambda', nameTex: '\\Lambda', label: 'Power-Law Slope (Λ)', min: 0.5, max: 4.0, step: 0.1, default: 2.0, desc: 'Decay slope of the gravitational power-law tail.' }
    ],
    evaluate: (s, p) => piecewiseCHPL_PDF(s, p.sigma, p.theta, p.sThresh, p.lambda),
    formulaTex: '\\mathrm{PDF}(s) = \\begin{cases} A \\cdot \\sqrt{\\frac{\\lambda}{\\theta_{\\mathrm{CH}}^2 \\omega}} \\, \\tilde{I}_1(2\\sqrt{\\lambda \\omega}) \\exp\\left[-\\left(\\sqrt{\\lambda} - \\sqrt{\\omega}\\right)^2\\right] & \\text{if } s < s_{\\mathrm{thresh}}, \\\\[8pt] C \\cdot f_{\\mathrm{CH}}(s_{\\mathrm{thresh}})\\, e^{-\\Lambda (s - s_{\\mathrm{thresh}})} & \\text{if } s \\geq s_{\\mathrm{thresh}} \\end{cases}',
    paramsTex: 'A = \\left[ F_{\\mathrm{CH}}(s_{\\mathrm{thresh}}) + \\frac{f_{\\mathrm{CH}}(s_{\\mathrm{thresh}})}{\\Lambda} \\right]^{-1} \\quad \\text{(C determined by continuity constraint)}',
    blocks: [
      {
        heading: 'Gravitational Collapse & Power-Law Tails',
        text: 'Gravity affects the density PDF by creating a power-law decay at higher densities in $\\rho$, which manifests as an exponential decay in $s$ (Klessen 2001). In general, above a given threshold density $s_\\mathrm{thresh}$, the PDF can be modelled as: $PDF(s) \\propto e^{-\\Lambda s}$ where $\\Lambda$ is the power-law slope. The turbulent PDF core ($\\mathcal{CH}$ here), is extended in a piecewise continious manner.'
      }
    ]
  }
};

// D3 Theory Plot elements
let theorySvg, theoryG, theoryXScale, theoryYScale, theoryXAxisG, theoryYAxisG;
let theoryAreaPath, theoryLinePath, theoryRefLinePath, theoryMarkerG, theoryCrosshairG;
const theoryMargin = { top: 24, right: 30, bottom: 45, left: 60 };

export function initTheorySandbox() {
  const container = document.querySelector('#theory-plot');
  if (!container) return;

  setupTheoryNavigation();
  setupDisplayOptions();
  buildTheoryPlotSVG();
  renderActiveTheoryModel(false);
}

function setupTheoryNavigation() {
  const navButtons = document.querySelectorAll('.theory-nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modelKey = btn.getAttribute('data-theory-model');
      if (modelKey && THEORY_CONFIG[modelKey]) {
        navButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.currentTheoryModel = modelKey;
        renderActiveTheoryModel(true);
      }
    });
  });
}

function setupDisplayOptions() {
  const toggleRef = document.querySelector('#toggle-ref-gaussian');
  if (toggleRef) {
    toggleRef.checked = state.showRefGaussian;
    toggleRef.addEventListener('change', e => {
      state.showRefGaussian = e.target.checked;
      updateTheoryPlot(false);
    });
  }

  const toggleLog = document.querySelector('#toggle-log-y');
  if (toggleLog) {
    toggleLog.checked = state.useLogY;
    toggleLog.addEventListener('change', e => {
      state.useLogY = e.target.checked;
      updateTheoryPlot(true);
    });
  }
}

function buildTheoryPlotSVG() {
  const container = d3.select('#theory-plot');
  container.selectAll('*').remove();

  const width = container.node().getBoundingClientRect().width || 800;
  const height = 320;

  theorySvg = container.append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Defs for Gradients
  const defs = theorySvg.append('defs');

  Object.keys(THEORY_CONFIG).forEach(key => {
    const config = THEORY_CONFIG[key];
    const grad = defs.append('linearGradient')
      .attr('id', `theory-area-grad-${key}`)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', config.color).attr('stop-opacity', 0.45);
    grad.append('stop').attr('offset', '100%').attr('stop-color', config.color).attr('stop-opacity', 0.02);
  });

  theoryG = theorySvg.append('g')
    .attr('transform', `translate(${theoryMargin.left}, ${theoryMargin.top})`);

  // Grid lines group
  theoryG.append('g').attr('class', 'grid-group');

  // Axes groups
  theoryXAxisG = theoryG.append('g').attr('class', 'x-axis');
  theoryYAxisG = theoryG.append('g').attr('class', 'y-axis');

  // Axis Labels
  theoryG.append('text')
    .attr('class', 'axis-label x-axis-label')
    .attr('text-anchor', 'middle')
    .attr('fill', '#9ba3b5')
    .attr('font-size', '12px')
    .attr('font-family', 'Plus Jakarta Sans, sans-serif')
    .text('Logarithmic Normalized Density, s = ln(ρ / ⟨ρ⟩)');

  theoryG.append('text')
    .attr('class', 'axis-label y-axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .attr('fill', '#9ba3b5')
    .attr('font-size', '12px')
    .attr('font-family', 'Plus Jakarta Sans, sans-serif')
    .text('Probability Density, p(s)');

  // Reference Gaussian Path
  theoryRefLinePath = theoryG.append('path')
    .attr('class', 'theory-ref-line')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255, 255, 255, 0.45)')
    .attr('stroke-width', 1.8)
    .attr('stroke-dasharray', '5, 4');

  // Area under curve path
  theoryAreaPath = theoryG.append('path').attr('class', 'theory-area-fill');

  // Main PDF Curve Path
  theoryLinePath = theoryG.append('path')
    .attr('class', 'theory-main-line')
    .attr('fill', 'none')
    .attr('stroke-width', 2.8);

  // Markers (Threshold & Cutoff)
  theoryMarkerG = theoryG.append('g').attr('class', 'theory-markers');

  // Interactive Hover Crosshair
  theoryCrosshairG = theoryG.append('g').attr('class', 'theory-crosshair').style('display', 'none');
  theoryCrosshairG.append('line')
    .attr('class', 'crosshair-vline')
    .attr('stroke', 'rgba(255, 255, 255, 0.25)')
    .attr('stroke-dasharray', '3, 3');
  theoryCrosshairG.append('circle')
    .attr('class', 'crosshair-dot')
    .attr('r', 5)
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2);

  // Overlay for Mouse Events
  const overlay = theoryG.append('rect')
    .attr('class', 'theory-overlay')
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair')
    .attr('pointer-events', 'all');

  overlay
    .on('mousemove', onTheoryPlotMouseMove)
    .on('mouseleave', () => {
      theoryCrosshairG.style('display', 'none');
      hideTooltip();
    });
}

export function resizeTheoryPlot() {
  const container = document.querySelector('#theory-plot');
  if (!container || !theorySvg) return;
  const width = container.getBoundingClientRect().width || 800;
  theorySvg.attr('viewBox', `0 0 ${width} 320`);
  updateTheoryPlot(false);
}

export function renderActiveTheoryModel(animate = false) {
  const config = THEORY_CONFIG[state.currentTheoryModel];
  if (!config) return;

  // 1. Update Sim Panel Header
  const titleEl = document.querySelector('#sim-active-title');
  const badgeEl = document.querySelector('#sim-active-badge');
  const subtitleEl = document.querySelector('#sim-active-subtitle');

  if (titleEl) titleEl.textContent = `${config.title} Simulator`;
  if (badgeEl) {
    badgeEl.innerHTML = `${renderLatex(config.badgeTex)} Live`;
    badgeEl.style.borderColor = config.color;
    badgeEl.style.color = config.color;
  }
  if (subtitleEl) subtitleEl.textContent = config.subtitle;

  // 2. Populate Sliders
  const slidersContainer = document.querySelector('#sim-sliders-container');
  if (slidersContainer) {
    slidersContainer.innerHTML = '';
    config.params.forEach(param => {
      const curVal = state.theoryParams[state.currentTheoryModel][param.id] !== undefined
        ? state.theoryParams[state.currentTheoryModel][param.id]
        : param.default;

      const card = document.createElement('div');
      card.className = 'sim-slider-card';
      card.innerHTML = `
        <div class="slider-header">
          <span class="slider-label">${renderLatex(param.nameTex)}</span>
          <span class="slider-val-badge" id="val-${state.currentTheoryModel}-${param.id}" style="color: ${config.color}; border-color: ${config.color}55;">
            ${curVal.toFixed(param.id === 'theta' ? 3 : 2)}
          </span>
        </div>
        <div class="slider-input-wrap">
          <span>${param.min}</span>
          <input type="range" class="sim-range-input" id="slider-${state.currentTheoryModel}-${param.id}"
            min="${param.min}" max="${param.max}" step="${param.step}" value="${curVal}" />
          <span>${param.max}</span>
        </div>
        <span class="slider-desc">${param.desc}</span>
      `;

      const input = card.querySelector(`#slider-${state.currentTheoryModel}-${param.id}`);
      const badge = card.querySelector(`#val-${state.currentTheoryModel}-${param.id}`);

      input.addEventListener('input', e => {
        const val = parseFloat(e.target.value);
        state.theoryParams[state.currentTheoryModel][param.id] = val;
        badge.textContent = val.toFixed(param.id === 'theta' ? 3 : 2);
        updateTheoryPlot(false);
      });

      slidersContainer.appendChild(card);
    });
  }

  // 3. Populate Theory Info Panel
  const infoContainer = document.querySelector('#theory-info-container');
  if (infoContainer) {
    infoContainer.className = `panel theory-info-panel ${config.themeClass}`;
    infoContainer.innerHTML = `
      <div class="theory-info-header">
        <div>
          <span class="theory-badge ${config.badgeClass}">${renderLatex(config.badgeTex)} Formulation</span>
          <h3 class="panel-title">${config.title}</h3>
          <p class="panel-subtitle">${config.subtitle}</p>
        </div>
      </div>

      <div class="theory-formula-box">
        <div class="formula-label">Analytical Probability Density Function</div>
        <div class="formula-math">${renderLatex(config.formulaTex, true)}</div>
        ${config.paramsTex ? `<div class="formula-params">${renderLatex(config.paramsTex, false)}</div>` : ''}
      </div>

      <div class="theory-body-grid">
        ${config.blocks.map(b => `
          <div class="theory-block">
            <h4 class="theory-section-heading">${b.heading}</h4>
            <p>${b.text}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 4. Update Plot
  updateTheoryPlot(animate);

  // 5. Trigger LaTeX rendering
  triggerKaTeXAutoRender();
}

export function updateTheoryPlot(animate = false) {
  if (!theorySvg) return;

  const container = document.querySelector('#theory-plot');
  const totalWidth = container ? container.getBoundingClientRect().width || 800 : 800;
  const totalHeight = 320;

  const width = Math.max(260, totalWidth - theoryMargin.left - theoryMargin.right);
  const height = Math.max(160, totalHeight - theoryMargin.top - theoryMargin.bottom);

  // Position axis labels & overlay
  theoryG.select('.x-axis-label')
    .attr('x', width / 2)
    .attr('y', height + 38);

  theoryG.select('.y-axis-label')
    .attr('x', -height / 2)
    .attr('y', -42);

  theoryG.select('.theory-overlay')
    .attr('width', width)
    .attr('height', height);

  // Domain of s
  const sMin = -6.0;
  const sMax = 6.0;
  const numPoints = 280;
  const sStep = (sMax - sMin) / (numPoints - 1);

  const config = THEORY_CONFIG[state.currentTheoryModel];
  const params = state.theoryParams[state.currentTheoryModel];

  // Generate data points
  const points = [];
  const refPoints = [];
  let maxY = 0;

  for (let i = 0; i < numPoints; i++) {
    const s = sMin + i * sStep;
    const p = config.evaluate(s, params);
    points.push({ s, p: Math.max(0, p) });
    if (p > maxY) maxY = p;

    if (state.showRefGaussian) {
      const pRef = lognormalPDF(s, 1.0, -0.5);
      refPoints.push({ s, p: pRef });
      if (pRef > maxY) maxY = pRef;
    }
  }

  // Scales
  theoryXScale = d3.scaleLinear().domain([sMin, sMax]).range([0, width]);

  if (state.useLogY) {
    const minLog = 1e-4;
    const maxLog = Math.max(1.2, maxY * 1.6);
    theoryYScale = d3.scaleLog().domain([minLog, maxLog]).range([height, 0]).clamp(true);
  } else {
    theoryYScale = d3.scaleLinear().domain([0, Math.max(0.65, maxY * 1.18)]).range([height, 0]);
  }

  // Grid
  const xTicks = theoryXScale.ticks(8);
  const gridG = theoryG.select('.grid-group');
  gridG.selectAll('*').remove();

  xTicks.forEach(tick => {
    gridG.append('line')
      .attr('x1', theoryXScale(tick))
      .attr('x2', theoryXScale(tick))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', 'rgba(255, 255, 255, 0.05)')
      .attr('stroke-dasharray', '2, 2');
  });

  // Axes
  const xAxis = d3.axisBottom(theoryXScale).ticks(8);
  const yAxis = state.useLogY
    ? d3.axisLeft(theoryYScale).ticks(5, '.0e')
    : d3.axisLeft(theoryYScale).ticks(6);

  theoryXAxisG.attr('transform', `translate(0, ${height})`).call(xAxis);
  theoryYAxisG.call(yAxis);

  // Line & Area Generators
  const lineGen = d3.line()
    .x(d => theoryXScale(d.s))
    .y(d => theoryYScale(state.useLogY ? Math.max(1e-4, d.p) : d.p))
    .curve(d3.curveMonotoneX);

  const areaGen = d3.area()
    .x(d => theoryXScale(d.s))
    .y0(height)
    .y1(d => theoryYScale(state.useLogY ? Math.max(1e-4, d.p) : d.p))
    .curve(d3.curveMonotoneX);

  // Update Main Line & Area
  const t = animate ? theoryG.transition().duration(400) : theoryG;

  theoryAreaPath
    .attr('fill', `url(#theory-area-grad-${state.currentTheoryModel})`)
    .datum(points)
    .attr('d', areaGen);

  theoryLinePath
    .attr('stroke', config.color)
    .datum(points)
    .attr('d', lineGen);

  // Update Reference Gaussian Line
  if (state.showRefGaussian) {
    theoryRefLinePath
      .style('display', null)
      .datum(refPoints)
      .attr('d', lineGen);
  } else {
    theoryRefLinePath.style('display', 'none');
  }

  // Update Markers (s_thresh, s_max)
  theoryMarkerG.selectAll('*').remove();

  if (params.sThresh !== undefined) {
    const xThresh = theoryXScale(params.sThresh);
    if (xThresh >= 0 && xThresh <= width) {
      theoryMarkerG.append('line')
        .attr('x1', xThresh).attr('x2', xThresh)
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', '#f87171')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4, 3');

      theoryMarkerG.append('text')
        .attr('x', xThresh + 6)
        .attr('y', 16)
        .attr('fill', '#f87171')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('font-family', 'Plus Jakarta Sans, sans-serif')
        .text(`s_thresh = ${params.sThresh.toFixed(1)}`);
    }
  }

  if ((state.currentTheoryModel === 'hopkins' || state.currentTheoryModel === 'hopkins_exp') && params.theta > 0.001) {
    const sMaxHopkins = (params.sigma * params.sigma) / (2 * params.theta * (1 + params.theta));
    const xCutoff = theoryXScale(sMaxHopkins);
    if (xCutoff >= 0 && xCutoff <= width) {
      theoryMarkerG.append('line')
        .attr('x1', xCutoff).attr('x2', xCutoff)
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', '#34d399')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2, 2');

      theoryMarkerG.append('text')
        .attr('x', xCutoff - 6)
        .attr('y', 32)
        .attr('text-anchor', 'end')
        .attr('fill', '#34d399')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('font-family', 'Plus Jakarta Sans, sans-serif')
        .text(`s_max = ${sMaxHopkins.toFixed(1)}`);
    }
  }
}

function onTheoryPlotMouseMove(event) {
  if (!theoryXScale || !theoryYScale) return;

  const [mouseX] = d3.pointer(event);
  const sVal = theoryXScale.invert(mouseX);

  const config = THEORY_CONFIG[state.currentTheoryModel];
  const params = state.theoryParams[state.currentTheoryModel];
  const pVal = config.evaluate(sVal, params);
  const rhoRatio = Math.exp(sVal);

  const cy = theoryYScale(state.useLogY ? Math.max(1e-4, pVal) : pVal);

  theoryCrosshairG
    .style('display', null)
    .attr('transform', `translate(${mouseX}, 0)`);

  theoryCrosshairG.select('.crosshair-vline')
    .attr('y1', 0)
    .attr('y2', theoryYScale.range()[0]);

  theoryCrosshairG.select('.crosshair-dot')
    .attr('cy', cy)
    .attr('fill', config.color);

  showTooltip(event, `
    <div class="tooltip-title">${config.title}</div>
    <div class="tooltip-row"><span class="label">Log Density (s):</span><span class="val">${sVal.toFixed(2)}</span></div>
    <div class="tooltip-row"><span class="label">Density Ratio (ρ / ⟨ρ⟩):</span><span class="val">${rhoRatio < 0.01 ? rhoRatio.toExponential(2) : rhoRatio.toFixed(2)}</span></div>
    <div class="tooltip-row"><span class="label">Probability Density p(s):</span><span class="val">${pVal.toFixed(4)}</span></div>
  `);
}
