/**
 * Metadata and Configuration for Density PDF Models
 * Colors: desaturated instrument-panel palette — warm, not neon
 */

export const MODEL_META = {
  gaussian: {
    key: 'gaussian',
    abbrTex: '\\mathcal{LN}',
    name: 'Log-Normal',
    fullNameTex: '\\mathcal{LN} \\text{ (Log-Normal)}',
    color: '#7C9CBF',   /* steel blue accent */
    desc: 'Pure supersonic isothermal turbulence'
  },
  hopkins: {
    key: 'hopkins',
    abbrTex: '\\mathcal{CH}',
    name: 'Castaing-Hopkins',
    fullNameTex: '\\mathcal{CH} \\text{ (Castaing-Hopkins)}',
    color: '#8FAE9E',   /* sage secondary accent */
    desc: 'Intermittent turbulent density field'
  },
  gauss_exp: {
    key: 'gauss_exp',
    abbrTex: '\\mathcal{LN}\\text{--}\\mathcal{PL}',
    name: 'LN + Power Law',
    fullNameTex: '\\mathcal{LN}\\text{--}\\mathcal{PL} \\text{ (LN + Power Law)}',
    color: '#C9A66B',   /* warm accent */
    desc: 'Log-normal core + self-gravitating tail'
  },
  hopkins_exp: {
    key: 'hopkins_exp',
    abbrTex: '\\mathcal{CH}\\text{--}\\mathcal{PL}',
    name: 'Hopkins + Power Law',
    fullNameTex: '\\mathcal{CH}\\text{--}\\mathcal{PL} \\text{ (Hopkins + Power Law)}',
    color: '#C07878',   /* dusty rose */
    desc: 'Intermittent core + self-gravitating tail'
  },
  Failed: {
    key: 'Failed',
    abbrTex: '\\text{Failed}',
    name: 'Unconstrained / Failed',
    fullNameTex: '\\text{Unconstrained / Failed}',
    color: '#4B5262',   /* muted slate */
    desc: 'Non-converged or unconstrained fit'
  }
};

export const SUCCESSFUL_MODELS = ['gaussian', 'hopkins', 'gauss_exp', 'hopkins_exp'];
