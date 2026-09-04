/**
 * Hero Section 3D Cloud Volumetric Visualization
 * Uses Plotly WebGL Volume & Isosurface rendering on true 3D grid data
 * with smooth orbital camera auto-rotation.
 */

export function initHeroCloud(cloudId = 441) {
  const container = document.getElementById('hero-cloud-canvas-container');
  if (!container) return;

  if (typeof Plotly === 'undefined') {
    console.warn('[heroCloud] Plotly is not loaded.');
    return;
  }

  const plotDivId = 'hero-cloud-plotly-mount';
  container.innerHTML = `
    <div id="${plotDivId}" style="width: 100%; height: 100%; min-height: 480px; position: relative;"></div>
    <div class="hero-cloud-badge" id="hero-cloud-badge">
      <div class="hero-cloud-badge-title">
        <span class="hero-cloud-live-dot"></span>
        <span>Cloud #${cloudId} (3D Volumetric Field)</span>
      </div>
      <div class="hero-cloud-badge-stats">
        <span id="hero-stat-shape">24×25×23 grid</span>
        <span>·</span>
        <span id="hero-stat-box">75×78.1×71.9 pc</span>
      </div>
    </div>
  `;

  const jsonUrl = 'data/hero_cloud_volume.json';
  let animId = null;
  let isUserInteracting = false;
  let userInteractionTimeout = null;
  let phi = 0.8;
  const radius = 2.1;
  const heightZ = 1.1;

  async function loadAndRender() {
    try {
      const resp = await fetch(jsonUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const plotDiv = document.getElementById(plotDivId);
      if (!plotDiv) return;

      // Update badge stats if needed
      const statShape = document.getElementById('hero-stat-shape');
      const statBox = document.getElementById('hero-stat-box');
      if (statShape && data.grid_shape) statShape.textContent = `${data.grid_shape.join('×')} grid`;
      if (statBox && data.box_size_pc) statBox.textContent = `${data.box_size_pc.join('×')} pc`;

      // True 3D Volume raycast trace with Cividis colormap
      const trace = {
        type: 'volume',
        x: data.x,
        y: data.y,
        z: data.z,
        value: data.values,
        isomin: data.isomin || 0.35,
        isomax: data.isomax || 3.5,
        opacity: 0.22,
        surface: { count: 20 },
        colorscale: 'Cividis',
        colorbar: {
          title: {
            text: '<i>n</i><sub>H</sub> (cm<sup>-3</sup>)',
            font: { color: '#e0d9d0', family: 'IBM Plex Mono, monospace', size: 18 }
          },
          tickfont: { color: '#8c8680', family: 'IBM Plex Mono, monospace', size: 16 },
          len: 0.65,
          thickness: 10,
          x: 0.95,
          y: 0.5,
          bgcolor: 'rgba(0,0,0,0)',
          outlinecolor: 'rgba(255,255,255,0.08)'
        },
        slices: {
          z: { show: false }
        },
        caps: {
          x: { show: false },
          y: { show: false },
          z: { show: false }
        },
        hoverinfo: 'none',
        hovertemplate: '',
        lighting: {
          ambient: 0.72,
          diffuse: 0.85
        }
      };

      const layout = {
        hovermode: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
        scene: {
          xaxis: {
            visible: true,
            title: { text: 'X [pc]', font: { color: '#8c8680', family: 'IBM Plex Mono, monospace', size: 10 } },
            tickfont: { color: '#5a5650', family: 'IBM Plex Mono, monospace', size: 9 },
            showbackground: true,
            backgroundcolor: 'rgba(13, 12, 11, 0.4)',
            gridcolor: 'rgba(46, 43, 39, 0.6)',
            zerolinecolor: 'rgba(200, 120, 74, 0.2)'
          },
          yaxis: {
            visible: true,
            title: { text: 'Y [pc]', font: { color: '#8c8680', family: 'IBM Plex Mono, monospace', size: 10 } },
            tickfont: { color: '#5a5650', family: 'IBM Plex Mono, monospace', size: 9 },
            showbackground: true,
            backgroundcolor: 'rgba(13, 12, 11, 0.4)',
            gridcolor: 'rgba(46, 43, 39, 0.6)',
            zerolinecolor: 'rgba(200, 120, 74, 0.2)'
          },
          zaxis: {
            visible: true,
            title: { text: 'Z [pc]', font: { color: '#8c8680', family: 'IBM Plex Mono, monospace', size: 10 } },
            tickfont: { color: '#5a5650', family: 'IBM Plex Mono, monospace', size: 9 },
            showbackground: true,
            backgroundcolor: 'rgba(13, 12, 11, 0.4)',
            gridcolor: 'rgba(46, 43, 39, 0.6)',
            zerolinecolor: 'rgba(200, 120, 74, 0.2)'
          },
          aspectmode: 'data',
          camera: {
            eye: {
              x: radius * Math.cos(phi),
              y: radius * Math.sin(phi),
              z: heightZ
            },
            center: { x: 0, y: 0, z: 0 },
            up: { x: 0, y: 0, z: 1 }
          }
        },
        showlegend: false
      };

      const config = {
        responsive: true,
        displayModeBar: false // Keep hero pristine and distraction-free
      };

      await Plotly.newPlot(plotDiv, [trace], layout, config);

      // Listen for user interaction to temporarily pause automatic turntable rotation
      plotDiv.addEventListener('mousedown', () => {
        isUserInteracting = true;
      });
      window.addEventListener('mouseup', () => {
        if (isUserInteracting) {
          clearTimeout(userInteractionTimeout);
          userInteractionTimeout = setTimeout(() => {
            // Read current camera angle to avoid jumping
            if (plotDiv._fullLayout?.scene?._scene?.camera) {
              const eye = plotDiv._fullLayout.scene._scene.camera.eye;
              phi = Math.atan2(eye[1], eye[0]);
            }
            isUserInteracting = false;
          }, 2500);
        }
      });

      // Smooth camera orbital rotation animation loop
      let lastTime = performance.now();
      function rotateLoop(now) {
        animId = requestAnimationFrame(rotateLoop);

        const delta = (now - lastTime) / 1000;
        lastTime = now;

        if (!isUserInteracting && plotDiv && plotDiv._fullLayout?.scene) {
          phi += delta * 0.22; // ~13 deg/sec steady turntable rotation
          const newEyeX = radius * Math.cos(phi);
          const newEyeY = radius * Math.sin(phi);

          Plotly.relayout(plotDiv, {
            'scene.camera.eye': {
              x: newEyeX,
              y: newEyeY,
              z: heightZ
            }
          });
        }
      }

      animId = requestAnimationFrame(rotateLoop);

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (plotDiv) Plotly.Plots.resize(plotDiv);
      });
      ro.observe(container);

    } catch (err) {
      console.warn('[heroCloud] Volumetric plot error:', err);
    }
  }

  loadAndRender();
}
