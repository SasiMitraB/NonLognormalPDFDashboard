/**
 * Donut Chart and Legend Components
 */

import { MODEL_META } from './config.js';
import { state } from './state.js';
import { renderLatex, showTooltip, moveTooltip, hideTooltip } from './utils.js';

let donutSvg, donutArcs, donutPie, donutArcGenerator, donutArcHover;
let onFilterChangeCallback = null;

export function setModelFilterCallback(cb) {
  onFilterChangeCallback = cb;
}

export function initDonutChart(distributionData) {
  const container = document.querySelector('#pie-chart');
  if (!container) return;

  // Keep the overlay element intact
  d3.select(container).selectAll('svg').remove();

  const width = Math.min(container.clientWidth || 240, 240);
  const height = 240;
  const margin = 12;
  const radius = Math.min(width, height) / 2 - margin;
  const innerRadius = radius * 0.64;

  donutSvg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  donutPie = d3.pie()
    .value(d => d.count)
    .sort((a, b) => {
      const order = ['gaussian', 'hopkins', 'gauss_exp', 'hopkins_exp', 'Failed'];
      return order.indexOf(a.model) - order.indexOf(b.model);
    })
    .padAngle(0.03);

  donutArcGenerator = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(radius)
    .cornerRadius(3);

  donutArcHover = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(radius + 6)
    .cornerRadius(4);

  const arcsData = donutPie(distributionData);

  donutArcs = donutSvg.selectAll('.slice')
    .data(arcsData)
    .join('path')
    .attr('class', 'slice')
    .attr('d', donutArcGenerator)
    .attr('fill', d => MODEL_META[d.data.model]?.color || '#64748b')
    .attr('stroke', '#16191d')
    .attr('stroke-width', 2)
    .on('mouseenter', function (event, d) {
      if (state.selectedModel && state.selectedModel !== d.data.model) return;
      d3.select(this).transition().duration(180).attr('d', donutArcHover);

      const info = MODEL_META[d.data.model] || { fullNameTex: d.data.model, color: '#64748b' };
      const fp = state.totalFitted > 0 ? ((d.data.count / state.totalFitted) * 100).toFixed(1) : 0;
      const tp = ((d.data.count / state.totalClouds) * 100).toFixed(1);

      showTooltip(event, `
        <div class="tooltip-title" style="color: ${info.color}">${renderLatex(info.fullNameTex)}</div>
        <div class="tooltip-row"><span class="label">Count:</span><span class="val">${d.data.count} clouds</span></div>
        <div class="tooltip-row"><span class="label">Fitted Share:</span><span class="val">${d.data.model === 'Failed' ? 'N/A' : `${fp}%`}</span></div>
        <div class="tooltip-row"><span class="label">Total Share:</span><span class="val">${tp}%</span></div>
      `);
    })
    .on('mousemove', moveTooltip)
    .on('mouseleave', function (event, d) {
      if (state.selectedModel !== d.data.model) {
        d3.select(this).transition().duration(180).attr('d', donutArcGenerator);
      }
      hideTooltip();
    })
    .on('click', function (event, d) {
      if (onFilterChangeCallback) {
        onFilterChangeCallback(d.data.model);
      }
    });

  updateDonutVisuals();
}

export function updateDonutVisuals() {
  if (!donutArcs) return;

  donutArcs.each(function (d) {
    const isSelected = state.selectedModel === d.data.model;
    const isDimmed = state.selectedModel && state.selectedModel !== d.data.model;

    d3.select(this)
      .classed('dimmed', isDimmed)
      .transition().duration(250)
      .attr('d', isSelected ? donutArcHover : donutArcGenerator);
  });

  const centerValEl = document.querySelector('#donut-center-val');
  const centerLblEl = document.querySelector('#donut-center-lbl');

  if (centerValEl && centerLblEl) {
    if (state.selectedModel && MODEL_META[state.selectedModel]) {
      const modelClouds = state.rawData.filter(d => d.preferred_model === state.selectedModel).length;
      centerValEl.textContent = modelClouds.toLocaleString();
      centerLblEl.innerHTML = renderLatex(MODEL_META[state.selectedModel].abbrTex);
    } else {
      centerValEl.textContent = state.totalFitted.toLocaleString();
      centerLblEl.textContent = 'Fitted Clouds';
    }
  }
}

export function renderLegend(distributionData) {
  const legendWrap = d3.select('#pie-legend');
  if (legendWrap.empty()) return;
  legendWrap.selectAll('*').remove();

  distributionData.forEach(item => {
    const info = MODEL_META[item.model] || { fullNameTex: item.model, color: '#64748b', desc: '' };
    const pct = item.model === 'Failed'
      ? ((item.count / state.totalClouds) * 100).toFixed(1) + '% total'
      : ((item.count / state.totalFitted) * 100).toFixed(1) + '% fitted';

    const card = legendWrap.append('div')
      .datum(item)
      .attr('class', 'legend-card')
      .attr('id', `legend-card-${item.model}`)
      .on('click', () => {
        if (onFilterChangeCallback) {
          onFilterChangeCallback(item.model);
        }
      });

    card.html(`
      <div class="legend-card-left">
        <div class="legend-pill-color" style="background: ${info.color}; color: ${info.color}"></div>
        <div class="legend-card-info">
          <span class="legend-card-name">
            <span class="legend-card-abbr">${renderLatex(info.abbrTex)}</span>
            <span>${info.name}</span>
          </span>
          <span class="legend-card-desc">${info.desc}</span>
        </div>
      </div>
      <div class="legend-card-right">
        <span class="legend-card-count">${item.count}</span>
        <span class="legend-card-pct">${pct}</span>
      </div>
    `);
  });
}

export function updateLegendVisuals() {
  d3.selectAll('.legend-card').each(function (d) {
    const isSelected = state.selectedModel === d.model;
    const isDimmed = state.selectedModel && state.selectedModel !== d.model;

    d3.select(this)
      .classed('selected', isSelected)
      .classed('dimmed', isDimmed);
  });

  const resetBtn = d3.select('#btn-reset-filter');
  if (!resetBtn.empty()) {
    resetBtn.classed('active', state.selectedModel === null);
  }
}
