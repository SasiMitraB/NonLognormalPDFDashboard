# Cloud Fitting Analysis Dashboard

This folder contains the interactive HTML dashboard for Run 012. The charts are generated in the browser from `data/merged_data.csv` using D3.js.

## Important: do not open `index.html` directly

Opening `index.html` by double-clicking it uses a `file://` URL. Browsers commonly block the dashboard from loading `data/merged_data.csv` in that mode.

Start a local web server instead.

## Load the dashboard locally

From the project root:

```bash
python3 -m http.server 8000 --directory dashboard
```

Then open:

```text
http://localhost:8000
```

Alternatively, run the command from inside this directory:

```bash
cd dashboard
python3 -m http.server 8000
```

Then visit the same URL:

```text
http://localhost:8000
```

Stop the server with `Ctrl+C`.

## Requirements

- Python 3, or another static web server
- Internet access for the D3.js and Google Fonts CDN resources
- A modern browser such as Chrome, Firefox, Safari, or Edge

No npm installation is required for the current version.

## Troubleshooting

### The page loads but the charts are empty

Confirm that the server was started with `dashboard` as its root directory and that this file exists:

```text
dashboard/data/merged_data.csv
```

The browser developer console will show an error if the CSV cannot be found.

### Port 8000 is already in use

Use another port:

```bash
python3 -m http.server 8080 --directory dashboard
```

Then open `http://localhost:8080`.

### The browser shows an old version

Perform a hard refresh:

- macOS: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

### The dashboard has no styling or charts

Check that the following files are served from the same dashboard root:

```text
index.html
styles.css
app.js
data/merged_data.csv
```

Also confirm that the browser can reach `https://cdn.jsdelivr.net`.

## Updating the catalog

Replace this file with a new catalog that preserves the expected column names:

```text
dashboard/data/merged_data.csv
```

The page will read the catalog when it reloads. The primary fields used for the current plots include:

```text
preferred_model
Mass_Msun
Length_Scale_pc
best_red_chi2
best_sigma
best_x_thresh1
best_lambda1
g_sigma
ge_sigma
h_sigma
he_sigma
h_theta
he_theta
ge_x_thresh
he_x_thresh
ge_lambda
he_lambda_exp
```

## GitHub Pages Deployment

The dashboard is deployed to GitHub Pages via GitHub Actions from the `main` branch.

- **Live URL**: [https://sasimitrab.github.io/NonLognormalPDFDashboard/](https://sasimitrab.github.io/NonLognormalPDFDashboard/)
- **Repository**: [https://github.com/SasiMitraB/NonLognormalPDFDashboard](https://github.com/SasiMitraB/NonLognormalPDFDashboard)

The deployment workflow is defined in `.github/workflows/deploy.yml`.

## Repository Structure

```text
NonLognormalPDFDashboard/
├── index.html                  # Main application HTML
├── app.js                      # Application orchestrator
├── styles.css                  # Custom typography, layout, and component CSS
├── js/                         # Modular ES modules (D3, Three.js, Plotly, h5wasm)
│   ├── cloudCatalog.js         # Cloud explorer & pagination
│   ├── cloudViewer3D.js        # 3D interactive volume inspector (h5wasm + Plotly)
│   ├── config.js               # Model configurations & palette constants
│   ├── donutChart.js           # Interactive D3 donut breakdown
│   ├── heroCloud.js            # Hero 3D showcase cloud visualization
│   ├── pdfMath.js              # Analytical PDF formula calculations
│   ├── scatterPlot.js          # Multi-parameter scaling scatter plot
│   ├── state.js                # Shared dashboard state
│   ├── theorySandbox.js        # Parameter slider interactive PDF sandbox
│   └── utils.js                # KaTeX rendering, formatting, and DOM helpers
├── data/
│   ├── merged_data.csv         # Complete 768-cloud catalog & fit parameters
│   ├── histograms.json         # Density distribution histograms
│   ├── hero_cloud_volume.json  # Hero cloud 3D mesh volume data
│   ├── cloud_notes.json        # Curated astronomical annotations
│   └── h5_clouds/              # Compact 3D volumetric HDF5 datasets
├── .github/workflows/deploy.yml# GitHub Pages deployment automation
└── README.md
```
