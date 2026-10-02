/**
 * KaTeX, Tooltip, Math, and Regression Utilities
 */

const tooltip = d3.select('#tooltip');

/* ── KaTeX Rendering Helpers ── */
export function renderLatex(tex, displayMode = false) {
  if (!tex) return '';
  if (typeof katex !== 'undefined' && typeof katex.renderToString === 'function') {
    try {
      return katex.renderToString(tex, {
        displayMode: displayMode,
        throwOnError: false
      });
    } catch (e) {
      console.warn('[KaTeX] renderToString error:', e);
      return tex;
    }
  }
  return displayMode ? `$$${tex}$$` : `$${tex}$`;
}

export function triggerKaTeXAutoRender(target = document.body) {
  if (typeof renderMathInElement === 'function' && target) {
    try {
      renderMathInElement(target, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn('[KaTeX] renderMathInElement error:', err);
    }
  }
}

/* ── Tooltip Helpers ── */
export function showTooltip(event, html) {
  tooltip
    .html(html)
    .style('left', `${event.clientX + 16}px`)
    .style('top', `${event.clientY + 16}px`)
    .style('opacity', 1)
    .attr('aria-hidden', 'false');
}

export function moveTooltip(event) {
  tooltip
    .style('left', `${event.clientX + 16}px`)
    .style('top', `${event.clientY + 16}px`);
}

export function hideTooltip() {
  tooltip.style('opacity', 0).attr('aria-hidden', 'true');
}

/* ── Scientific Number Formatter ── */
export function formatScientific(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (val >= 10000 || (val > 0 && val < 0.01)) {
    const exp = Math.floor(Math.log10(val));
    const mantissa = (val / Math.pow(10, exp)).toFixed(decimals);
    return `${mantissa} × 10<sup>${exp}</sup>`;
  }
  return Number(val).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/* ── Linear Regression on Log10(Length Scale) vs Log10(Mass) ── */
export function computePowerLawFit(data) {
  const validPts = data
    .map(d => ({
      x: Math.log10(d.lengthScale),
      y: Math.log10(d.mass),
      rawL: d.lengthScale,
      rawM: d.mass
    }))
    .filter(p => !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y) && p.rawL > 0 && p.rawM > 0);

  const n = validPts.length;
  if (n < 2) {
    return { slope: 0, slopeErr: 0, intercept: 0, interceptErr: 0, r2: 0, n: 0, validPts: [] };
  }

  const sumX = d3.sum(validPts, p => p.x);
  const sumY = d3.sum(validPts, p => p.y);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;

  validPts.forEach(p => {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  });

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r2 = ssXX > 0 && ssYY > 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;

  // Standard errors
  const residuals = validPts.map(p => p.y - (slope * p.x + intercept));
  const ssRes = d3.sum(residuals, r => r * r);
  const sErr = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  const slopeErr = ssXX > 0 ? sErr / Math.sqrt(ssXX) : 0;
  const sumXX = d3.sum(validPts, p => p.x * p.x);
  const interceptErr = ssXX > 0 && n > 0 ? sErr * Math.sqrt(sumXX / (n * ssXX)) : 0;

  return {
    slope,
    slopeErr,
    intercept,
    interceptErr,
    r2,
    n,
    validPts
  };
}

/* ── Dynamic Tick Calculation for Zoomed Log Axes ── */
export function getDynamicLogTicks(domain, type = 'length') {
  const [minVal, maxVal] = domain;
  let candidates;
  if (type === 'length') {
    candidates = [5, 10, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000];
  } else {
    candidates = [30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000, 3000000, 10000000];
  }

  let inRange = candidates.filter(v => v >= minVal * 1.02 && v <= maxVal * 0.98);
  if (inRange.length < 3) {
    inRange = candidates.filter(v => v >= minVal && v <= maxVal);
  }
  if (inRange.length > 6) {
    inRange = inRange.filter((_, idx) => idx % 2 === 0);
  }
  return inRange;
}

export function formatMassTick(d) {
  if (d >= 1e6) return `${(d / 1e6).toFixed(d % 1e6 === 0 ? 0 : 1)}M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(d % 1e3 === 0 ? 0 : 1)}k`;
  return `${d}`;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

