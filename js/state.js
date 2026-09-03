/**
 * Shared Application State
 */

export const state = {
  rawData: [],
  histograms: {},
  cloudNotes: {},
  totalClouds: 0,
  totalFitted: 0,
  selectedModel: null, // null = 'All'
  currentCatalogModel: 'gaussian',
  selectedCatalogCloudId: null,
  catalogSearchQuery: '',
  selectedInspectorModel: null,
  currentTheoryModel: 'gaussian',
  theoryParams: {
    gaussian: { sigma: 1.0 },
    hopkins: { sigma: 1.0, theta: 0.15 },
    gauss_exp: { sigma: 1.0, sThresh: 1.0, lambda: 2.0 },
    hopkins_exp: { sigma: 1.0, theta: 0.15, sThresh: 1.0, lambda: 2.0 }
  },
  showRefGaussian: true,
  useLogY: true,
  cloudInspectorViewMode: 'pdf' // 'pdf' | '3d'
};
