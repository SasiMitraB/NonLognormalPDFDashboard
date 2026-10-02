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

// Theory Configuration & Model Metadata (notation follows Behara & Seta 2026, Sec. 2)
export const THEORY_CONFIG = {
  gaussian: {
    key: 'gaussian',
    title: 'Lognormal PDF',
    badgeTex: '\\mathcal{LN}',
    badgeClass: 'badge-ln',
    themeClass: 'theme-gaussian',
    color: '#7C9CBF',
    subtitle: 'Turbulent model I · Lognormal (Eq. 1)',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathcal{LN}}', label: 'Standard deviation ($\\sigma_{\\mathcal{LN}}$)', min: 0.3, max: 2.5, step: 0.05, default: 1.0, desc: 'Standard deviation of s. The mean is fixed by mass conservation.' }
    ],
    evaluate: (s, p) => lognormalPDF(s, p.sigma),
    formulaTex: '\\mathrm{PDF}(s) = \\frac{1}{\\sigma_{\\mathcal{LN}} \\sqrt{2\\pi}} \\exp\\left( -\\frac{(s - \\mu_s)^2}{2 \\sigma_{\\mathcal{LN}}^2} \\right)',
    paramsTex: '\\mu_s = -\\sigma_{\\mathcal{LN}}^2 / 2 \\quad \\text{(mass conservation, } \\textstyle\\int e^{s}\\,\\mathrm{PDF}(s)\\,\\mathrm{d}s = 1\\text{)}',
    blocks: [
      {
        heading: 'Multiplicative perturbations and the central limit theorem',
        text: 'The lognormal model of the density PDF (Vazquez-Semadeni 1994; Federrath et al. 2008) begins with the idea that the perturbations in the density field are multiplicative, and the logarithm of the density field is a sum of these perturbations. Assuming infinitely many identically distributed perturbations, the central limit theorem gives a normal distribution for the PDF of $s$, where $\\sigma_{\\mathcal{LN}}$ is the standard deviation and $\\mu_s$ the mean of $s$. Enforcing mass conservation gives $\\mu_s = -\\sigma_{\\mathcal{LN}}^2/2$, removing $\\mu_s$ as a free parameter.'
      },
      {
        heading: 'Use in the literature',
        text: 'The lognormal model has been widely studied and applied in simulations (Federrath et al. 2008), column density observations (Burkhart 2018; Schneider et al. 2022), and observationally derived number density across the ISM phases (Seta & McClure-Griffiths 2025).'
      }
    ]
  },
  hopkins: {
    key: 'hopkins',
    title: 'Castaing-Hopkins PDF',
    badgeTex: '\\mathcal{CH}',
    badgeClass: 'badge-ch',
    themeClass: 'theme-hopkins',
    color: '#8FAE9E',
    subtitle: 'Turbulent model II · Castaing-Hopkins, non-lognormal (Eq. 2)',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathcal{CH}}', label: 'Width ($\\sigma_{\\mathcal{CH}}$)', min: 0.3, max: 2.5, step: 0.05, default: 1.0, desc: 'Width parameter of the Castaing-Hopkins distribution.' },
      { id: 'theta', nameTex: '\\theta_{\\mathcal{CH}}', label: 'Intermittency ($\\theta_{\\mathcal{CH}}$)', min: 0.001, max: 0.40, step: 0.01, default: 0.15, desc: 'Deviation from lognormality; θ → 0 recovers the lognormal.' }
    ],
    evaluate: (s, p) => castaingHopkinsPDF(s, p.sigma, p.theta),
    formulaTex: '\\mathrm{PDF}(s \\mid \\sigma_{\\mathcal{CH}}, \\theta_{\\mathcal{CH}}) = \\sqrt{\\frac{\\lambda_{\\mathcal{CH}}}{\\theta_{\\mathcal{CH}}^2\\, \\omega}} \\, I_1^{*}\\!\\left(2\\sqrt{\\lambda_{\\mathcal{CH}}\\, \\omega}\\right) \\exp\\left[-\\left(\\sqrt{\\lambda_{\\mathcal{CH}}} - \\sqrt{\\omega}\\right)^2\\right]',
    paramsTex: '\\lambda_{\\mathcal{CH}} = \\frac{\\sigma_{\\mathcal{CH}}^2}{2\\theta_{\\mathcal{CH}}^2}, \\quad \\omega = \\frac{\\lambda_{\\mathcal{CH}}}{1+\\theta_{\\mathcal{CH}}} - \\frac{s}{\\theta_{\\mathcal{CH}}}, \\quad I_1^{*}(x) = I_1(x)\\, e^{-x}',
    blocks: [
      {
        heading: 'Intermittency and an asymmetric PDF',
        text: 'The Castaing-Hopkins model proposed by Hopkins (2013) is a non-lognormal, more general model that postulates that the density statistics should more closely follow the velocity statistics proposed in Castaing (1996). It introduces a new parameter, the intermittency $\\theta_{\\mathcal{CH}}$, which captures the deviation from lognormality; in the limit $\\theta_{\\mathcal{CH}} \\to 0$ the model reduces to the lognormal distribution. The model is asymmetric, with a preference for lower densities than higher densities: the higher $\\theta_{\\mathcal{CH}}$, the larger the asymmetry. It also satisfies mass conservation, $\\int e^{s}\\,\\mathrm{PDF}(s)\\,\\mathrm{d}s = 1$. Here $I_1$ is the modified Bessel function of the first kind.'
      },
      {
        heading: 'Maximum turbulent density',
        text: 'The constraint $\\omega > 0$ leads to a maximum density allowed by turbulence, $$s_{\\mathrm{max}} = \\frac{\\lambda_{\\mathcal{CH}}\\, \\theta_{\\mathcal{CH}}}{1+\\theta_{\\mathcal{CH}}},$$ producing a progressively sharper high-density cutoff as $\\theta_{\\mathcal{CH}}$ increases.'
      },
      {
        heading: 'Use in the literature',
        text: 'The model has been extremely successful when tested against simulations (Hopkins 2013; Squire & Hopkins 2017; Hennebelle et al. 2024; Brucy et al. 2024). However, it had not been tested against observations, probably since column densities wash out the intermittency and the asymmetry of the PDF (Brunt et al. 2010; Burkhart & Lazarian 2012).'
      }
    ]
  },
  gauss_exp: {
    key: 'gauss_exp',
    title: 'LN + Power Law',
    badgeTex: '\\mathcal{LN}-\\mathcal{PL}',
    badgeClass: 'badge-lnpl',
    themeClass: 'theme-gauss_exp',
    color: '#C9A66B',
    subtitle: 'Combined piecewise model · Lognormal core + power-law tail (Eq. 4)',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathcal{LN}}', label: 'Standard deviation ($\\sigma_{\\mathcal{LN}}$)', min: 0.3, max: 2.2, step: 0.05, default: 1.0, desc: 'Standard deviation of the lognormal (turbulent) part.' },
      { id: 'sThresh', nameTex: 's_{\\mathrm{thresh}}', label: 'Transition point ($s_{\\mathrm{thresh}}$)', min: -0.5, max: 3.0, step: 0.1, default: 1.0, desc: 'Transition from the turbulence- to the gravity-dominated regime.' },
      { id: 'lambda', nameTex: '\\Lambda', label: 'Power-law slope ($\\Lambda$)', min: 0.5, max: 4.0, step: 0.1, default: 2.0, desc: 'Slope of the power-law tail at high density.' }
    ],
    evaluate: (s, p) => piecewiseLNPL_PDF(s, p.sigma, p.sThresh, p.lambda),
    formulaTex: '\\mathrm{PDF}(s) = \\begin{cases} A\\, f_{\\mathcal{LN}}(s) & \\text{if } s < s_{\\mathrm{thresh}}, \\\\[6pt] N_{\\mathrm{PL}}\\, e^{-\\Lambda s} & \\text{if } s \\geq s_{\\mathrm{thresh}} \\end{cases}',
    paramsTex: 'A = \\left[ F(s_{\\mathrm{thresh}}) + \\frac{f(s_{\\mathrm{thresh}})}{\\Lambda} \\right]^{-1}, \\quad N_{\\mathrm{PL}}\\, e^{-\\Lambda s_{\\mathrm{thresh}}} = A\\, f(s_{\\mathrm{thresh}})',
    blocks: [
      {
        heading: 'Gravity: power-law decay at higher densities',
        text: 'Gravity affects the density PDF by creating a power-law profile at higher densities in $\\rho$, which manifests as an exponential decay in $s$ (Klessen 2001). Above a threshold density $s_{\\mathrm{thresh}}$, the PDF can be modelled as $\\mathrm{PDF}(s) = N_{\\mathrm{PL}}\\, e^{-\\Lambda s}$, where $\\Lambda$ is the slope of the power-law tail. The transition point $s_{\\mathrm{thresh}}$ is often associated with the transition to gravity-dominated gas, and $\\Lambda$ is also used to estimate the star formation efficiency (Burkhart 2018).'
      },
      {
        heading: 'Combined piecewise model',
        text: 'The turbulent part $f(s)$, here the normalised lognormal with cumulative distribution $F(s)$, is joined to the power-law tail at $s_{\\mathrm{thresh}}$. The constant $A$ makes the total area under the PDF equal to 1, and $N_{\\mathrm{PL}}$ ensures continuity at the transition (Appendix A), so both are fixed by the other parameters.'
      }
    ]
  },
  hopkins_exp: {
    key: 'hopkins_exp',
    title: 'CH + Power Law',
    badgeTex: '\\mathcal{CH}-\\mathcal{PL}',
    badgeClass: 'badge-chpl',
    themeClass: 'theme-hopkins_exp',
    color: '#C07878',
    subtitle: 'Combined piecewise model · Castaing-Hopkins core + power-law tail (Eq. 4)',
    params: [
      { id: 'sigma', nameTex: '\\sigma_{\\mathcal{CH}}', label: 'Width ($\\sigma_{\\mathcal{CH}}$)', min: 0.3, max: 2.2, step: 0.05, default: 1.0, desc: 'Width of the Castaing-Hopkins (turbulent) part.' },
      { id: 'theta', nameTex: '\\theta_{\\mathcal{CH}}', label: 'Intermittency ($\\theta_{\\mathcal{CH}}$)', min: 0.001, max: 0.40, step: 0.01, default: 0.15, desc: 'Intermittency of the turbulent part.' },
      { id: 'sThresh', nameTex: 's_{\\mathrm{thresh}}', label: 'Transition point ($s_{\\mathrm{thresh}}$)', min: -0.5, max: 3.0, step: 0.1, default: 1.0, desc: 'Transition from the turbulence- to the gravity-dominated regime.' },
      { id: 'lambda', nameTex: '\\Lambda', label: 'Power-law slope ($\\Lambda$)', min: 0.5, max: 4.0, step: 0.1, default: 2.0, desc: 'Slope of the power-law tail at high density.' }
    ],
    evaluate: (s, p) => piecewiseCHPL_PDF(s, p.sigma, p.theta, p.sThresh, p.lambda),
    formulaTex: '\\mathrm{PDF}(s) = \\begin{cases} A\\, f_{\\mathcal{CH}}(s) & \\text{if } s < s_{\\mathrm{thresh}}, \\\\[6pt] N_{\\mathrm{PL}}\\, e^{-\\Lambda s} & \\text{if } s \\geq s_{\\mathrm{thresh}} \\end{cases}',
    paramsTex: 'A = \\left[ F(s_{\\mathrm{thresh}}) + \\frac{f(s_{\\mathrm{thresh}})}{\\Lambda} \\right]^{-1}, \\quad N_{\\mathrm{PL}}\\, e^{-\\Lambda s_{\\mathrm{thresh}}} = A\\, f(s_{\\mathrm{thresh}})',
    blocks: [
      {
        heading: 'Gravity: power-law decay at higher densities',
        text: 'Gravity affects the density PDF by creating a power-law profile at higher densities in $\\rho$, which manifests as an exponential decay in $s$ (Klessen 2001). Above a threshold density $s_{\\mathrm{thresh}}$, the PDF can be modelled as $\\mathrm{PDF}(s) = N_{\\mathrm{PL}}\\, e^{-\\Lambda s}$, where $\\Lambda$ is the slope of the power-law tail. The transition point $s_{\\mathrm{thresh}}$ is often associated with the transition to gravity-dominated gas, and $\\Lambda$ is also used to estimate the star formation efficiency (Burkhart 2018).'
      },
      {
        heading: 'Combined piecewise model',
        text: 'The turbulent part $f(s)$, here the Castaing-Hopkins distribution with cumulative distribution $F(s)$ evaluated numerically, is joined to the power-law tail at $s_{\\mathrm{thresh}}$. The constant $A$ makes the total area under the PDF equal to 1, and $N_{\\mathrm{PL}}$ ensures continuity at the transition (Appendix A), so both are fixed by the other parameters.'
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
    grad.append('stop').attr('offset', '0%').attr('stop-color', config.color).attr('stop-opacity', 0.18);
    grad.append('stop').attr('offset', '100%').attr('stop-color', config.color).attr('stop-opacity', 0);
  });

  theoryG = theorySvg.append('g')
    .attr('transform', `translate(${theoryMargin.left}, ${theoryMargin.top})`);

  // Grid lines group
  theoryG.append('g').attr('class', 'grid-group');

  // Axes groups
  theoryXAxisG = theoryG.append('g').attr('class', 'x-axis');
  theoryYAxisG = theoryG.append('g').attr('class', 'y-axis');

  // Axis Labels using ForeignObject KaTeX
  theoryG.append('foreignObject')
    .attr('class', 'x-axis-foreign')
    .attr('height', 28)
    .append('xhtml:div')
    .attr('class', 'scatter-axis-title-latex')
    .html(renderLatex('s = \\ln(\\rho / \\rho_0)'));

  const yForeignG = theoryG.append('g')
    .attr('class', 'y-axis-foreign-group')
    .attr('transform', 'rotate(-90)');

  yForeignG.append('foreignObject')
    .attr('class', 'y-axis-foreign')
    .attr('height', 28)
    .append('xhtml:div')
    .attr('class', 'scatter-axis-title-latex')
    .html(renderLatex('\\mathrm{PDF}(s)'));

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
    .attr('stroke-width', 2);

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

  if (titleEl) titleEl.textContent = config.title;
  if (badgeEl) {
    badgeEl.innerHTML = renderLatex(config.badgeTex);
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
          <span class="slider-val-badge" id="val-${state.currentTheoryModel}-${param.id}">
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
          <span class="theory-badge ${config.badgeClass}">${renderLatex(config.badgeTex)}</span>
          <h3 class="panel-title">${config.title}</h3>
          <p class="panel-subtitle">${config.subtitle}</p>
        </div>
      </div>

      <div class="theory-formula-box">
        <div class="formula-label">Probability density function</div>
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
  theoryG.select('.x-axis-foreign')
    .attr('x', 0)
    .attr('y', height + 24)
    .attr('width', width);

  theoryG.select('.y-axis-foreign')
    .attr('x', -height)
    .attr('y', -52)
    .attr('width', height);

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
        .attr('stroke', '#C07878')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4, 3');

      theoryMarkerG.append('text')
        .attr('x', xThresh + 6)
        .attr('y', 16)
        .attr('fill', '#C07878')
        .attr('font-size', '11px')
        .attr('font-family', 'IBM Plex Mono, monospace')
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
        .attr('stroke', '#8FAE9E')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '2, 2');

      theoryMarkerG.append('text')
        .attr('x', xCutoff - 6)
        .attr('y', 32)
        .attr('text-anchor', 'end')
        .attr('fill', '#8FAE9E')
        .attr('font-size', '11px')
        .attr('font-family', 'IBM Plex Mono, monospace')
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
    <div class="tooltip-row"><span class="label">$s$:</span><span class="val">${sVal.toFixed(2)}</span></div>
    <div class="tooltip-row"><span class="label">$\\rho / \\rho_0$:</span><span class="val">${rhoRatio < 0.01 ? rhoRatio.toExponential(2) : rhoRatio.toFixed(2)}</span></div>
    <div class="tooltip-row"><span class="label">$\\mathrm{PDF}(s)$:</span><span class="val">${pVal.toFixed(4)}</span></div>
  `);
}
