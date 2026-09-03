/**
 * Scatter Plot Component (Mass vs Length Scale with Dynamic Zoom & Power Law Fit)
 */

import { MODEL_META } from './config.js';
import { state } from './state.js';
import {
  renderLatex,
  showTooltip,
  moveTooltip,
  hideTooltip,
  formatScientific,
  computePowerLawFit,
  getDynamicLogTicks,
  formatMassTick
} from './utils.js';

let scatterSvg, scatterXScale, scatterYScale, scatterDots, scatterFitLine;
let xAxisGroup, yAxisGroup, xGridGroup, yGridGroup;
let scatterWidth, scatterHeight, scatterMargin, innerW, innerH;
const clipId = 'scatter-plot-clip';

/* ── Update Fit Telemetry Banner with LaTeX ── */
export function updateFitBanner(fitResult, modelKey) {
  const formulaEl = document.getElementById('fit-formula-text');
  const slopeEl = document.getElementById('fit-slope');
  const interceptEl = document.getElementById('fit-intercept');
  const r2El = document.getElementById('fit-r2');
  const countEl = document.getElementById('fit-count');
  const badgeEl = document.getElementById('active-model-badge');

  if (!formulaEl || !slopeEl || !interceptEl || !r2El || !countEl || !badgeEl) return;

  if (fitResult.n === 0) {
    formulaEl.innerHTML = renderLatex('\\text{No data}');
    slopeEl.textContent = '—';
    interceptEl.textContent = '—';
    r2El.textContent = '—';
    countEl.textContent = '0';
    return;
  }

  // Render LaTeX Formula: M \propto L^{\alpha \pm \Delta \alpha}
  const slopeStr = fitResult.slope.toFixed(2);
  const slopeErrStr = fitResult.slopeErr.toFixed(2);
  formulaEl.innerHTML = renderLatex(`M \\propto L^{${slopeStr} \\pm ${slopeErrStr}}`);

  slopeEl.textContent = `${fitResult.slope.toFixed(2)} ± ${fitResult.slopeErr.toFixed(2)}`;
  interceptEl.textContent = `${fitResult.intercept.toFixed(2)} ± ${fitResult.interceptErr.toFixed(2)}`;
  r2El.textContent = fitResult.r2.toFixed(3);
  countEl.textContent = fitResult.n.toLocaleString();

  if (modelKey && MODEL_META[modelKey]) {
    badgeEl.innerHTML = renderLatex(`${MODEL_META[modelKey].abbrTex} \\ (N=${fitResult.n})`);
    badgeEl.style.borderColor = MODEL_META[modelKey].color;
    badgeEl.style.color = MODEL_META[modelKey].color;
  } else {
    badgeEl.innerHTML = renderLatex(`\\text{All Models} \\ (N=${fitResult.n})`);
    badgeEl.style.borderColor = 'var(--accent-rule)';
    badgeEl.style.color = 'var(--accent-light)';
  }
}

export function initScatterPlot() {
  const container = document.querySelector('#scatter-chart');
  if (!container) return;
  container.innerHTML = '';

  const bbox = container.getBoundingClientRect();
  scatterWidth = Math.max(bbox.width || 600, 320);
  scatterHeight = Math.max(bbox.height || 440, 400);
  scatterMargin = { top: 16, right: 24, bottom: 52, left: 88 };

  innerW = scatterWidth - scatterMargin.left - scatterMargin.right;
  innerH = scatterHeight - scatterMargin.top - scatterMargin.bottom;

  scatterSvg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', scatterHeight)
    .attr('viewBox', `0 0 ${scatterWidth} ${scatterHeight}`);

  // ClipPath so points & lines stay inside the plot area
  const defs = scatterSvg.append('defs');
  defs.append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', innerW)
    .attr('height', innerH);

  const g = scatterSvg.append('g')
    .attr('transform', `translate(${scatterMargin.left}, ${scatterMargin.top})`);

  // Initial domains based on full data
  const allLengths = state.rawData.map(d => d.lengthScale).filter(v => v > 0);
  const allMasses = state.rawData.map(d => d.mass).filter(v => v > 0);

  const logMinL = Math.log10(d3.min(allLengths) || 1);
  const logMaxL = Math.log10(d3.max(allLengths) || 100);
  const padL = (logMaxL - logMinL) * 0.12;
  const xDomain = [Math.pow(10, logMinL - padL), Math.pow(10, logMaxL + padL)];

  const logMinM = Math.log10(d3.min(allMasses) || 1);
  const logMaxM = Math.log10(d3.max(allMasses) || 1000000);
  const padM = (logMaxM - logMinM) * 0.12;
  const yDomain = [Math.pow(10, logMinM - padM), Math.pow(10, logMaxM + padM)];

  scatterXScale = d3.scaleLog().domain(xDomain).range([0, innerW]);
  scatterYScale = d3.scaleLog().domain(yDomain).range([innerH, 0]);

  // Grid Groups
  xGridGroup = g.append('g').attr('class', 'scatter-grid').attr('transform', `translate(0, ${innerH})`);
  yGridGroup = g.append('g').attr('class', 'scatter-grid');

  // Axis Groups
  xAxisGroup = g.append('g').attr('class', 'scatter-axis x-axis').attr('transform', `translate(0, ${innerH})`);
  yAxisGroup = g.append('g').attr('class', 'scatter-axis y-axis');

  // Axis Titles using KaTeX ForeignObject for pure LaTeX typography
  g.append('foreignObject')
    .attr('x', 0)
    .attr('y', innerH + 34)
    .attr('width', innerW)
    .attr('height', 30)
    .append('xhtml:div')
    .attr('class', 'scatter-axis-title-latex')
    .html(renderLatex('\\text{Characteristic Length Scale } L \\ (\\text{pc}) \\ [\\text{Log Scale}]'));

  g.append('g')
    .attr('transform', 'rotate(-90)')
    .append('foreignObject')
    .attr('x', -innerH)
    .attr('y', -76)
    .attr('width', innerH)
    .attr('height', 30)
    .append('xhtml:div')
    .attr('class', 'scatter-axis-title-latex')
    .html(renderLatex('\\text{Cloud Mass } M \\ (M_\\odot) \\ [\\text{Log Scale}]'));

  // Clipped Plot Area Group
  const plotArea = g.append('g').attr('clip-path', `url(#${clipId})`);

  // Fit line
  scatterFitLine = plotArea.append('line').attr('class', 'fit-line');

  // Cloud dots
  scatterDots = plotArea.selectAll('.cloud-dot')
    .data(state.rawData)
    .join('circle')
    .attr('class', 'cloud-dot')
    .attr('cx', d => scatterXScale(Math.max(d.lengthScale, 1)))
    .attr('cy', d => scatterYScale(Math.max(d.mass, 1)))
    .attr('r', 4)
    .attr('fill', d => MODEL_META[d.preferred_model]?.color || '#64748b')
    .attr('fill-opacity', 0.75)
    .attr('stroke', d => MODEL_META[d.preferred_model]?.color || '#64748b')
    .attr('stroke-width', 0.5)
    .on('mouseenter', function (event, d) {
      d3.select(this).attr('r', 7).attr('fill-opacity', 1);
      const model = MODEL_META[d.preferred_model] || { fullNameTex: d.preferred_model, color: '#64748b' };

      showTooltip(event, `
        <div class="tooltip-title" style="color: ${model.color}">Cloud #${d.cloud_id}</div>
        <div class="tooltip-row"><span class="label">Model:</span><span class="val">${renderLatex(model.fullNameTex)}</span></div>
        <div class="tooltip-row"><span class="label">Mass:</span><span class="val">${formatScientific(d.mass)} ${renderLatex('M_\\odot')}</span></div>
        <div class="tooltip-row"><span class="label">Length Scale:</span><span class="val">${d.lengthScale.toFixed(1)} pc</span></div>
        <div class="tooltip-row"><span class="label">Turbulent ${renderLatex('\\sigma')}:</span><span class="val">${d.sigma > 0 ? d.sigma.toFixed(3) : '—'}</span></div>
        <div class="tooltip-row"><span class="label">Reduced ${renderLatex('\\chi^2')}:</span><span class="val">${d.redChi2 > 0 ? d.redChi2.toFixed(2) : '—'}</span></div>
      `);
    })
    .on('mousemove', moveTooltip)
    .on('mouseleave', function () {
      d3.select(this).attr('r', state.selectedModel ? 5 : 4).attr('fill-opacity', 0.8);
      hideTooltip();
    });

  updateScatterPlot(false);
}

/**
 * Updates Scatter Plot with Dynamic Zooming & Power-Law Fitting
 * @param {boolean} animate Whether to animate the zoom transition
 */
export function updateScatterPlot(animate = true) {
  if (!scatterXScale || !scatterYScale) return;

  const activeData = state.selectedModel
    ? state.rawData.filter(d => d.preferred_model === state.selectedModel)
    : state.rawData;

  const fitResult = computePowerLawFit(activeData);
  updateFitBanner(fitResult, state.selectedModel);

  // Calculate dynamic extent for active points to fill maximum available space
  const activeLengths = activeData.map(d => d.lengthScale).filter(v => v > 0);
  const activeMasses = activeData.map(d => d.mass).filter(v => v > 0);

  const minL = activeLengths.length > 0 ? d3.min(activeLengths) : 5;
  const maxL = activeLengths.length > 0 ? d3.max(activeLengths) : 400;
  const minM = activeMasses.length > 0 ? d3.min(activeMasses) : 30;
  const maxM = activeMasses.length > 0 ? d3.max(activeMasses) : 2000000;

  // Add 12% logarithmic padding so points comfortably fill the plot space
  const logMinL = Math.log10(minL);
  const logMaxL = Math.log10(maxL);
  const spanL = Math.max(logMaxL - logMinL, 0.4);
  const padL = spanL * 0.12;
  const xDomain = [Math.pow(10, logMinL - padL), Math.pow(10, logMaxL + padL)];

  const logMinM = Math.log10(minM);
  const logMaxM = Math.log10(maxM);
  const spanM = Math.max(logMaxM - logMinM, 0.5);
  const padM = spanM * 0.12;
  const yDomain = [Math.pow(10, logMinM - padM), Math.pow(10, logMaxM + padM)];

  scatterXScale.domain(xDomain);
  scatterYScale.domain(yDomain);

  // Dynamic Ticks
  const xTicks = getDynamicLogTicks(xDomain, 'length');
  const yTicks = getDynamicLogTicks(yDomain, 'mass');

  const xAxis = d3.axisBottom(scatterXScale).tickValues(xTicks).tickFormat(d => `${d} pc`);
  const yAxis = d3.axisLeft(scatterYScale).tickValues(yTicks).tickFormat(formatMassTick);

  const xGrid = d3.axisBottom(scatterXScale).tickValues(xTicks).tickSize(-innerH).tickFormat('');
  const yGrid = d3.axisLeft(scatterYScale).tickValues(yTicks).tickSize(-innerW).tickFormat('');

  const t = animate
    ? d3.transition().duration(550).ease(d3.easeCubicOut)
    : d3.transition().duration(0);

  // Transition Axes & Grids
  xAxisGroup.transition(t).call(xAxis);
  yAxisGroup.transition(t).call(yAxis);
  xGridGroup.transition(t).call(xGrid);
  yGridGroup.transition(t).call(yGrid);

  // Transition Scatter Points
  scatterDots.each(function (d) {
    const isMatch = !state.selectedModel || d.preferred_model === state.selectedModel;
    const circle = d3.select(this);

    circle.classed('dimmed', !isMatch);

    if (animate) {
      circle.transition(t)
        .attr('cx', scatterXScale(Math.max(d.lengthScale, xDomain[0])))
        .attr('cy', scatterYScale(Math.max(d.mass, yDomain[0])))
        .attr('r', isMatch ? (state.selectedModel ? 5 : 4) : 2.5)
        .attr('fill-opacity', isMatch ? 0.85 : 0.06)
        .attr('stroke-opacity', isMatch ? 1 : 0.06);
    } else {
      circle
        .attr('cx', scatterXScale(Math.max(d.lengthScale, xDomain[0])))
        .attr('cy', scatterYScale(Math.max(d.mass, yDomain[0])))
        .attr('r', isMatch ? (state.selectedModel ? 5 : 4) : 2.5)
        .attr('fill-opacity', isMatch ? 0.85 : 0.06)
        .attr('stroke-opacity', isMatch ? 1 : 0.06);
    }

    if (isMatch && state.selectedModel) {
      circle.raise();
    }
  });

  // Calculate & Transition Fit Line
  if (fitResult.n > 1 && fitResult.validPts.length > 0) {
    const logXVals = fitResult.validPts.map(p => p.x);
    const logX1 = d3.min(logXVals);
    const logX2 = d3.max(logXVals);

    const L1 = Math.pow(10, logX1);
    const L2 = Math.pow(10, logX2);
    const M1 = Math.pow(10, fitResult.slope * logX1 + fitResult.intercept);
    const M2 = Math.pow(10, fitResult.slope * logX2 + fitResult.intercept);

    const cx1 = scatterXScale(Math.max(L1, xDomain[0]));
    const cx2 = scatterXScale(Math.min(L2, xDomain[1]));
    const cy1 = scatterYScale(Math.min(Math.max(M1, yDomain[0]), yDomain[1]));
    const cy2 = scatterYScale(Math.min(Math.max(M2, yDomain[0]), yDomain[1]));

    const color = state.selectedModel && MODEL_META[state.selectedModel] ? MODEL_META[state.selectedModel].color : 'rgba(255,255,255,0.45)';

    scatterFitLine
      .attr('display', null)
      .attr('stroke', color)
      .style('filter', null);

    if (animate) {
      scatterFitLine.transition(t)
        .attr('x1', cx1)
        .attr('y1', cy1)
        .attr('x2', cx2)
        .attr('y2', cy2);
    } else {
      scatterFitLine
        .attr('x1', cx1)
        .attr('y1', cy1)
        .attr('x2', cx2)
        .attr('y2', cy2);
    }

    scatterFitLine.raise();
  } else {
    scatterFitLine.attr('display', 'none');
  }
}
