/**
 * Metadata and Configuration for Density PDF Models
 * Colors: desaturated instrument-panel palette — warm, not neon
 */

export const MODEL_META = {
  gaussian: {
    key: 'gaussian',
    abbrTex: '\\mathcal{LN}',
    name: 'Lognormal',
    fullNameTex: '\\mathcal{LN} \\text{ (Lognormal)}',
    color: '#7C9CBF',   /* steel blue accent */
    desc: 'Turbulent model I'
  },
  hopkins: {
    key: 'hopkins',
    abbrTex: '\\mathcal{CH}',
    name: 'Castaing-Hopkins',
    fullNameTex: '\\mathcal{CH} \\text{ (Castaing-Hopkins)}',
    color: '#8FAE9E',   /* sage secondary accent */
    desc: 'Turbulent model II (non-lognormal)'
  },
  gauss_exp: {
    key: 'gauss_exp',
    abbrTex: '\\mathcal{LN}-\\mathcal{PL}',
    name: 'LN + Power Law',
    fullNameTex: '\\mathcal{LN}-\\mathcal{PL} \\text{ (LN + Power Law)}',
    color: '#C9A66B',   /* warm accent */
    desc: 'Lognormal + power-law tail'
  },
  hopkins_exp: {
    key: 'hopkins_exp',
    abbrTex: '\\mathcal{CH}-\\mathcal{PL}',
    name: 'CH + Power Law',
    fullNameTex: '\\mathcal{CH}-\\mathcal{PL} \\text{ (CH + Power Law)}',
    color: '#C07878',   /* dusty rose */
    desc: 'Castaing-Hopkins + power-law tail'
  },
  Failed: {
    key: 'Failed',
    abbrTex: '\\text{Failed}',
    name: 'No acceptable fit',
    fullNameTex: '\\text{Failed}',
    color: '#4B5262',   /* muted slate */
    desc: 'No model with reduced χ² ≤ 3'
  }
};

export const SUCCESSFUL_MODELS = ['gaussian', 'hopkins', 'gauss_exp', 'hopkins_exp'];
