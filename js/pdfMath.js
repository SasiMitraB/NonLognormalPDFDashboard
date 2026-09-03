/**
 * PDF Mathematical Definitions & Special Functions
 * Includes Cephes-derived i1e (scaled modified Bessel function I_1(x)*exp(-x))
 * and exact analytic implementations of Log-Normal, Castaing-Hopkins, LN-PL, and CH-PL PDFs.
 */

// ══════════════════════════════════════════════
// Cephes-derived i1e (scaled modified Bessel function of the 1st kind I_1(x) * exp(-x))
// Matches scipy.special.i1e and mcfitter/pdfs/hopkins_pdf.py to machine precision (~1e-16)
// ══════════════════════════════════════════════

const _I1E_A = [
  2.77791411276104639959e-18,
  -2.11142121435816608115e-17,
  1.55363195773620046921e-16,
  -1.10559694773538630805e-15,
  7.60068429473540693410e-15,
  -5.04218550472791168711e-14,
  3.22379336594557470981e-13,
  -1.98397439776494371520e-12,
  1.17361862988909016308e-11,
  -6.66348972350202774223e-11,
  3.62559028155211703701e-10,
  -1.88724975172282928790e-09,
  9.38153738649577178388e-09,
  -4.44505912879632808065e-08,
  2.00329475355213526229e-07,
  -8.56872026469545474066e-07,
  3.47025130813767847674e-06,
  -1.32731636560394358279e-05,
  4.78156510755005422638e-05,
  -1.61760815825896745588e-04,
  5.12285956168575772895e-04,
  -1.51357245063125314899e-03,
  4.15642294431288815669e-03,
  -1.05640848946261981558e-02,
  2.47264490306265168283e-02,
  -5.29459812080949914269e-02,
  1.02643658689847095384e-01,
  -1.76416518357834055153e-01,
  2.52587186443633654823e-01
];

const _I1E_B = [
  7.51729631084210481353e-18,
  4.41434832307170791151e-18,
  -4.65030536848935832153e-17,
  -3.20952592199342395980e-17,
  2.96262899764595013876e-16,
  3.30820231092092828324e-16,
  -1.88035477551078244854e-15,
  -3.81440307243700780478e-15,
  1.04202769841288027642e-14,
  4.27244001671195135429e-14,
  -2.10154184277266431302e-14,
  -4.08355111109219731823e-13,
  -7.19855177624590851209e-13,
  2.03562854414708950722e-12,
  1.41258074366137813316e-11,
  3.25260358301548823856e-11,
  -1.89749581235054123450e-11,
  -5.58974346219658380687e-10,
  -3.83538038596423702205e-09,
  -2.63146884688951950684e-08,
  -2.51223623787020892529e-07,
  -3.88256480887769039346e-06,
  -1.10588938762623716291e-04,
  -9.76109749136146840777e-03,
  7.78576235018280120474e-01
];

function _chbevl(x, coeffs) {
  const n = coeffs.length;
  let b0 = coeffs[0];
  let b1 = 0.0;
  let b2 = 0.0;
  for (let i = 1; i < n; i++) {
    b2 = b1;
    b1 = b0;
    b0 = x * b1 - b2 + coeffs[i];
  }
  return 0.5 * (b0 - b2);
}

export function besselI1Scaled(x) {
  if (x === 0.0) return 0.0;
  const sign = x < 0 ? -1.0 : 1.0;
  const ax = Math.abs(x);
  let z;
  if (ax <= 8.0) {
    const y = ax * 0.5 - 2.0;
    z = _chbevl(y, _I1E_A) * ax;
  } else {
    z = _chbevl(32.0 / ax - 2.0, _I1E_B) / Math.sqrt(ax);
  }
  return sign * z;
}

// Standard normal Error Function approximation
export function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

// 1. Log-Normal PDF
export function lognormalPDF(s, sigma, mu = null) {
  if (sigma <= 0) return 0;
  const mean = mu !== null ? mu : -0.5 * sigma * sigma;
  const diff = s - mean;
  return (1.0 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

// Log-Normal CDF
export function lognormalCDF(s, sigma, mu = null) {
  if (sigma <= 0) return s >= 0 ? 1 : 0;
  const mean = mu !== null ? mu : -0.5 * sigma * sigma;
  return 0.5 * (1 + erf((s - mean) / (sigma * Math.SQRT2)));
}

// 2. Castaing-Hopkins (Log-Poisson) PDF
export function castaingHopkinsPDF(s, sigma, theta) {
  if (sigma <= 0 || theta <= 0.001) {
    return lognormalPDF(s, sigma);
  }
  const lambda = (sigma * sigma) / (2 * theta * theta);
  const u = lambda / (1 + theta) - s / theta;
  if (u <= 0) return 0.0;

  const arg = 2 * Math.sqrt(lambda * u);
  const i1eVal = besselI1Scaled(arg);
  if (i1eVal <= 0) return 0.0;

  // Exact Hopkins formulation
  const factor = Math.sqrt(lambda / (theta * theta * u));
  const diff = Math.sqrt(lambda) - Math.sqrt(u);
  const exponent = -diff * diff;
  return factor * i1eVal * Math.exp(exponent);
}

// Numerical CDF via Trapezoidal Integration
export function numericalCDF(pdfFunc, sVal, sMin = -12, steps = 120) {
  if (sVal <= sMin) return 0;
  const ds = (sVal - sMin) / steps;
  let sum = 0.5 * (pdfFunc(sMin) + pdfFunc(sVal));
  for (let i = 1; i < steps; i++) {
    sum += pdfFunc(sMin + i * ds);
  }
  return Math.min(1.0, Math.max(0.0, sum * ds));
}

// 3. Piecewise Log-Normal + Power Law (Gravoturbulent)
export function piecewiseLNPL_PDF(s, sigma, sThresh, lambda, mu = null) {
  if (sigma <= 0 || lambda <= 0) return 0;
  const F_thresh = lognormalCDF(sThresh, sigma, mu);
  const f_thresh = lognormalPDF(sThresh, sigma, mu);
  const A = 1.0 / (F_thresh + f_thresh / lambda);

  if (s < sThresh) {
    return A * lognormalPDF(s, sigma, mu);
  } else {
    return A * f_thresh * Math.exp(-lambda * (s - sThresh));
  }
}

// 4. Piecewise Castaing-Hopkins + Power Law (Gravoturbulent)
export function piecewiseCHPL_PDF(s, sigma, theta, sThresh, lambda) {
  if (sigma <= 0 || lambda <= 0) return 0;
  const hopkinsBase = sVal => castaingHopkinsPDF(sVal, sigma, theta);
  const F_thresh = numericalCDF(hopkinsBase, sThresh);
  const f_thresh = hopkinsBase(sThresh);
  const A = 1.0 / (F_thresh + f_thresh / lambda);

  if (s < sThresh) {
    return A * castaingHopkinsPDF(s, sigma, theta);
  } else {
    return A * f_thresh * Math.exp(-lambda * (s - sThresh));
  }
}
