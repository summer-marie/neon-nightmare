// ====================================================================
// NEON NIGHTMARE VISUALIZER - Main JavaScript
// ====================================================================
//
// APP STRUCTURE:
// 1. DOM Element References (lines 8-25)
// 2. State Object - holds all app data (lines 27-62)
// 3. Initialization & Event Listeners (lines 64-110)
// 4. File Upload Handler (lines 112-130)
// 5. Playback Controls (lines 132-175)
// 6. Web Audio API Setup (lines 177-193)
// 7. Main Animation Loop (lines 195-220)
// 8. Audio Data Reading & Processing (lines 222-285)
// 9. Background Painting (lines 287-320)
// 10. 3D Sphere Drawing with Rotation (lines 322-460)
// 11. Ripple Effects System (lines 462-525)
// 12. Particle System (lines 527-645)
// 13. Idle State Display (lines 647-685)
// 14. Utility Functions (lines 687-730)
// 15. Dev Theme Lab (lines 732-end)
//
// ====================================================================

// ========== DOM ELEMENT REFERENCES ==========
const audioUpload = document.getElementById("audioUpload");
const audioPlayer = document.getElementById("audioPlayer");
const playPauseButton = document.getElementById("playPauseButton");
const statusText = document.getElementById("statusText");
const fileName = document.getElementById("fileName");
const visualMode = document.getElementById("visualMode");
const particleStyle = document.getElementById("particleStyle");
const colorPreset = document.getElementById("colorPreset");
const sensitivity = document.getElementById("sensitivity");
const bassSensitivity = document.getElementById("bassSensitivity");
const ringSize = document.getElementById("ringSize");
const particleCount = document.getElementById("particleCount");
const sensitivityValue = document.getElementById("sensitivityValue");
const bassSensitivityValue = document.getElementById("bassSensitivityValue");
const ringSizeValue = document.getElementById("ringSizeValue");
const particleCountValue = document.getElementById("particleCountValue");
const glowToggle = document.getElementById("glowToggle");
const glowToggleHint = document.getElementById("glowToggleHint");
const glowIntensity = document.getElementById("glowIntensity");
const glowIntensityValue = document.getElementById("glowIntensityValue");
const canvas = document.getElementById("visualizerCanvas");
const ctx = canvas.getContext("2d");

// ========== GLOBAL STATE OBJECT ==========
// Holds all application state, audio data, and visualization settings
const state = {
  // Web Audio API objects
  audioContext: null,
  sourceNode: null,
  analyser: null,
  frequencyData: null,  // Frequency spectrum data (bass, mid, treble)
  timeData: null,       // Waveform data
  
  // File handling
  objectUrl: null,      // Blob URL for uploaded file
  
  // Playback state flags
  isAudioReady: false,
  isPlaying: false,
  animationStarted: false,
  
  // Audio reactive values
  lastPeak: 0,
  lastRippleAt: 0,
  sphereRotationY: 0,   // Y-axis rotation for 3D sphere
  sphereRotationX: 0,   // X-axis rotation for 3D sphere
  smoothedVolume: 0,    // Smoothed overall volume
  smoothedBass: 0,      // Smoothed bass level
  
  // Visual effects arrays
  ripples: [],          // Active ripple animations
  particles: [],        // Floating particle objects
  
  // User controls (synced with UI)
  controls: {
    mode: visualMode.value,
    particleStyle: particleStyle.value,
    theme: colorPreset.value,
    sensitivity: Number(sensitivity.value),
    bassSensitivity: Number(bassSensitivity.value),
    ringSize: Number(ringSize.value),
    particleCount: Number(particleCount.value),
    glowOn: true,
    glowIntensity: 1.0
  },
  
  // Current theme colors (updated from CSS variables)
  colors: {
    accent: "#ff2fd6",
    accentTwo: "#22e8ff",
    accentRgb: [255, 47, 214],
    accentTwoRgb: [34, 232, 255]
  }
};

// Bar smoothing buffer for zone-specific response
state.barSmooth = new Float32Array(64).fill(0);

// ========== INITIALIZATION ==========
// Sets up canvas, controls, and all event listeners
function init() {
  updateCanvasSize();
  updateControlReadouts();
  updateThemeColors();
  syncParticles();
  state.animationStarted = true;
  drawFrame();  // Start animation loop

  // File upload event
  audioUpload.addEventListener("change", handleFileUpload);
  
  // Playback control events
  playPauseButton.addEventListener("click", togglePlayback);
  audioPlayer.addEventListener("play", handleAudioPlay);
  audioPlayer.addEventListener("pause", handleAudioPause);
  audioPlayer.addEventListener("ended", handleAudioPause);
  
  // Window resize
  window.addEventListener("resize", handleResize);

  // Visual mode control (rings/ripples/both)
  visualMode.addEventListener("change", () => {
    state.controls.mode = visualMode.value;
  });

  // Particle style control (bubbles/dust/sparks)
  particleStyle.addEventListener("change", () => {
    state.controls.particleStyle = particleStyle.value;
    resetParticles();
  });

  // Color preset switcher (changes CSS theme)
  colorPreset.addEventListener("change", () => {
    state.controls.theme = colorPreset.value;
    document.documentElement.dataset.theme = colorPreset.value;
    updateThemeColors();
  });

  // Slider controls - all update live
  sensitivity.addEventListener("input", () => {
    state.controls.sensitivity = Number(sensitivity.value);
    updateControlReadouts();
  });

  bassSensitivity.addEventListener("input", () => {
    state.controls.bassSensitivity = Number(bassSensitivity.value);
    updateControlReadouts();
  });

  ringSize.addEventListener("input", () => {
    state.controls.ringSize = Number(ringSize.value);
    updateControlReadouts();
  });

  particleCount.addEventListener("input", () => {
    state.controls.particleCount = Number(particleCount.value);
    updateControlReadouts();
    syncParticles();
  });

  glowToggle.addEventListener("click", () => {
    state.controls.glowOn = !state.controls.glowOn;
    glowToggle.classList.toggle("is-on", state.controls.glowOn);
    glowToggle.classList.toggle("is-off", !state.controls.glowOn);
    glowToggle.textContent = state.controls.glowOn ? "ON" : "OFF";
    glowToggle.setAttribute("aria-pressed", String(state.controls.glowOn));
    glowToggleHint.textContent = state.controls.glowOn
      ? "Glow is active"
      : "Glow is off";
  });

  glowIntensity.addEventListener("input", () => {
    state.controls.glowIntensity = Number(glowIntensity.value);
    updateControlReadouts();
  });
}

// ========== FILE UPLOAD HANDLER ==========
// Loads selected audio file into the HTML5 audio player
function handleFileUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }

  state.objectUrl = URL.createObjectURL(file);
  audioPlayer.src = state.objectUrl;
  audioPlayer.load();
  state.isAudioReady = true;
  state.ripples = [];
  state.lastPeak = 0;
  state.smoothedVolume = 0;
  state.smoothedBass = 0;
  if (state.barSmooth) state.barSmooth.fill(0);
  fileName.textContent = file.name;
  statusText.textContent = "Loaded: " + file.name;
  playPauseButton.textContent = "Play";
  playPauseButton.classList.remove("is-playing");
}

// ========== PLAYBACK CONTROLS ==========
// Toggle play/pause and handle audio state changes

async function togglePlayback() {
  if (!state.isAudioReady) {
    statusText.textContent = "Choose a local audio file first.";
    return;
  }

  await setupAudioGraph();

  if (audioPlayer.paused) {
    try {
      await state.audioContext.resume();
      await audioPlayer.play();
    } catch (error) {
      statusText.textContent = "Playback could not start. Try pressing play again.";
    }
  } else {
    audioPlayer.pause();
  }
}

async function handleAudioPlay() {
  if (!state.isAudioReady) {
    return;
  }

  await setupAudioGraph();
  await state.audioContext.resume();
  state.isPlaying = true;
  playPauseButton.textContent = "Pause";
  playPauseButton.classList.add("is-playing");
  statusText.textContent = "Signal active. Visualizer responding in real time.";
}

function handleAudioPause() {
  state.isPlaying = false;
  playPauseButton.textContent = "Play";
  playPauseButton.classList.remove("is-playing");

  if (state.isAudioReady) {
    statusText.textContent = "Signal paused. Press play to resume.";
  }
}

// ========== WEB AUDIO API SETUP ==========
// Creates AudioContext, Analyser, and connects audio graph
// Only runs once - subsequent calls reuse existing nodes
async function setupAudioGraph() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 1024;
    state.analyser.smoothingTimeConstant = 0.82;
    state.frequencyData = new Uint8Array(state.analyser.frequencyBinCount);
    state.timeData = new Uint8Array(state.analyser.fftSize);
  }

  if (!state.sourceNode) {
    state.sourceNode = state.audioContext.createMediaElementSource(audioPlayer);
    state.sourceNode.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
  }
}

// ========== MAIN ANIMATION LOOP ==========
// Runs 60fps, handles all drawing and audio-reactive effects
function drawFrame(now = 0) {
  updateCanvasSize();

  // Get current audio data (frequency + waveform)
  const audio = readAudioData();
  
  // Draw layers in order:
  paintBackground(audio);     // Radial gradient background
  drawParticles(audio);       // Floating particles

  // If no file loaded, show idle state
  if (!state.isAudioReady) {
    drawIdleState(now);
  } else {
    // Draw based on selected mode
    if (state.controls.mode === "bars") {
      drawBars(audio);

    } else if (state.controls.mode === "bars-rings") {
      // Layer order: bars at bottom, then sphere/rings, then ripples on top
      drawBars(audio);

      if (typeof drawSphere === "function") {
        drawSphere(audio, 1);
      } else if (typeof drawRings === "function") {
        drawRings(audio, 1);
      }

      updateRipples(audio, now);
      drawRipples(audio, 0.6);

    } else {
      if (state.controls.mode === "rings" || state.controls.mode === "both") {
        if (typeof drawSphere === "function") {
          drawSphere(audio, state.controls.mode === "both" ? 0.86 : 1);
        } else if (typeof drawRings === "function") {
          drawRings(audio, state.controls.mode === "both" ? 0.86 : 1);
        }
      }

      if (state.controls.mode === "ripples" || state.controls.mode === "both") {
        updateRipples(audio, now);
        drawRipples(audio, state.controls.mode === "both" ? 0.75 : 1);
      }
    }
  }

  requestAnimationFrame(drawFrame);  // Loop
}

// ========== AUDIO DATA READING ==========
// Reads frequency/waveform data from Web Audio API
// Returns: { volume, bass, treble } object
// If no audio playing, returns idle pulse values
function readAudioData() {
  let volume = 0;
  let bass = 0;
  let treble = 0;

  if (state.analyser && state.frequencyData && state.timeData && state.isPlaying) {
    state.analyser.getByteFrequencyData(state.frequencyData);
    state.analyser.getByteTimeDomainData(state.timeData);

    let frequencyTotal = 0;
    let bassTotal = 0;
    let trebleTotal = 0;
    const bassBins = Math.max(6, Math.floor(state.frequencyData.length * 0.09));
    const trebleStart = Math.floor(state.frequencyData.length * 0.62);

    for (let i = 0; i < state.frequencyData.length; i += 1) {
      const value = state.frequencyData[i] / 255;
      frequencyTotal += value;

      if (i < bassBins) {
        bassTotal += value;
      }

      if (i >= trebleStart) {
        trebleTotal += value;
      }
    }

    let waveTotal = 0;
    for (let i = 0; i < state.timeData.length; i += 1) {
      const centered = (state.timeData[i] - 128) / 128;
      waveTotal += centered * centered;
    }

    const rms = Math.sqrt(waveTotal / state.timeData.length);
    volume = Math.min(1, (frequencyTotal / state.frequencyData.length) * 1.35 + rms * 0.7);
    bass = Math.min(1, (bassTotal / bassBins) * 1.18);
    treble = Math.min(1, (trebleTotal / (state.frequencyData.length - trebleStart)) * 1.3);
  } else {
    const idlePulse = 0.06 + Math.sin(performance.now() * 0.0012) * 0.025;
    volume = idlePulse;
    bass = idlePulse * 0.7;
    treble = idlePulse * 0.5;
  }

  const scaledVolume = Math.min(1, volume * state.controls.sensitivity);
  const scaledBass = Math.min(1, bass * state.controls.sensitivity
    * state.controls.bassSensitivity);
  state.smoothedVolume += (scaledVolume - state.smoothedVolume) * 0.14;
  state.smoothedBass += (scaledBass - state.smoothedBass) * 0.18;

  return {
    volume: state.smoothedVolume,
    bass: state.smoothedBass,
    treble
  };
}

// ========== BACKGROUND PAINTING ==========
// Draws audio-reactive radial gradient + diagonal grid lines
function paintBackground(audio) {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;

  if (state.controls.glowOn) {
    ctx.globalAlpha = state.controls.glowIntensity;
    const glowRadius = Math.max(width, height) * (0.46 + audio.bass * 0.12);
    const background = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);

    background.addColorStop(0, rgba(state.colors.accentRgb, 0.13 + audio.volume * 0.16));
    background.addColorStop(0.34, rgba(state.colors.accentTwoRgb, 0.07 + audio.bass * 0.12));
    background.addColorStop(1, "rgba(2, 2, 6, 0.96)");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(2, 2, 6, 0.96)";
    ctx.fillRect(0, 0, width, height);
  }

  if (state.controls.glowOn) {
    ctx.save();
    ctx.globalAlpha = (0.15 + audio.treble * 0.12) * state.controls.glowIntensity;
    ctx.strokeStyle = rgba(state.colors.accentTwoRgb, 0.3);
    ctx.lineWidth = 1;

    const spacing = Math.max(28, Math.floor(width / 22));
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + audio.bass * 18, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + audio.volume * 10);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ========== 3D SPHERE DRAWING ==========
// Renders rotating wireframe sphere with audio-reactive spikes
// Creates 3D effect using rotation matrices and depth sorting
function drawSphere(audio, intensity) {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const latSteps = 10;
  const lonSteps = 18;
  const scale = Math.min(Math.min(width, height) * 0.36 * state.controls.ringSize, Math.min(width, height) * 0.40);
  const pulse = 1 + audio.bass * 0.25;
  const sphereScale = scale * pulse;
  const edgeAlpha = (0.12 + audio.volume * 0.42) * intensity;
  const spikeBaseLength = scale * 0.16;
  const spikeLength = spikeBaseLength * (1 + audio.bass * 3.5 + audio.volume * 1.5);

  state.sphereRotationY += 0.004 + audio.bass * 0.018;
  state.sphereRotationX = Math.sin(performance.now() * 0.0004) * 0.28;

  const vertices = [];

  for (let lat = 0; lat < latSteps; lat += 1) {
    const theta = -Math.PI / 2 + (Math.PI * lat) / (latSteps - 1);
    const row = [];

    for (let lon = 0; lon < lonSteps; lon += 1) {
      const phi = (Math.PI * 2 * lon) / lonSteps;
      const baseX = Math.cos(theta) * Math.cos(phi);
      const baseY = Math.sin(theta);
      const baseZ = Math.cos(theta) * Math.sin(phi);
      const point = rotatePoint(baseX, baseY, baseZ, state.sphereRotationX, state.sphereRotationY);

      row.push({
        x: point.x,
        y: point.y,
        z: point.z,
        sx: centerX + point.x * sphereScale,
        sy: centerY + point.y * sphereScale,
        index: lat * lonSteps + lon
      });
    }

    vertices.push(row);
  }

  const shadow = getThemeShadow(0.7 + audio.volume * 0.8);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = shadow.primaryBlur * (1 + audio.bass * 1.2);
  ctx.shadowColor = shadow.primaryColor;

  for (let lat = 0; lat < latSteps; lat += 1) {
    for (let lon = 0; lon < lonSteps; lon += 1) {
      const current = vertices[lat][lon];
      const right = vertices[lat][(lon + 1) % lonSteps];

      drawSphereEdge(current, right, current.index, edgeAlpha, audio);

      if (lat < latSteps - 1) {
        const below = vertices[lat + 1][lon];
        drawSphereEdge(current, below, current.index + lonSteps, edgeAlpha, audio);
      }
    }
  }

  for (let lat = 0; lat < latSteps; lat += 1) {
    for (let lon = 0; lon < lonSteps; lon += 1) {
      const vertex = vertices[lat][lon];

      if (vertex.z <= 0 || vertex.index % 2 !== 0) {
        continue;
      }

      const outwardLength = spikeLength * (0.72 + ((vertex.index % 7) / 7) * 0.56);
      const endX = vertex.sx + vertex.x * outwardLength;
      const endY = vertex.sy + vertex.y * outwardLength;
      const rgb = vertex.index % 4 === 0 ? state.colors.accentRgb : state.colors.accentTwoRgb;
      const color = vertex.index % 4 === 0 ? state.colors.accent : state.colors.accentTwo;
      const alpha = (0.16 + audio.volume * 0.36 + audio.treble * 0.28) * intensity * Math.min(1, vertex.z + 0.18);

      ctx.beginPath();
      ctx.moveTo(vertex.sx, vertex.sy);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = rgba(rgb, alpha);
      ctx.lineWidth = 0.8 + audio.treble * 3.2 + audio.volume * 1.2;
      ctx.shadowBlur = shadow.spikeBlur * (1 + audio.bass * 1.5);
      ctx.shadowColor = shadow.secondaryColor;
      ctx.stroke();
    }
  }

  const coreRadius = 18 + audio.bass * 46;
  const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 2.8);
  core.addColorStop(0, rgba(state.colors.accentTwoRgb, 0.7));
  core.addColorStop(0.42, rgba(state.colors.accentRgb, 0.22));
  core.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = core;
  ctx.shadowBlur = shadow.coreBlur * (1 + audio.bass * 0.8);
  ctx.shadowColor = shadow.primaryColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius * 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ========== 3D ROTATION HELPER ==========
// Rotates a 3D point around X and Y axes
function rotatePoint(x, y, z, rotationX, rotationY) {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const rotatedX = x * cosY - z * sinY;
  const rotatedZ = x * sinY + z * cosY;
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);

  return {
    x: rotatedX,
    y: y * cosX - rotatedZ * sinX,
    z: y * sinX + rotatedZ * cosX
  };
}

// ========== SPHERE EDGE DRAWING ==========
// Draws individual wireframe edge between two sphere vertices
// Skips edges facing away from camera (negative Z)
function drawSphereEdge(start, end, index, edgeAlpha, audio) {
  const frontEpsilon = -0.04;

  if (start.z <= frontEpsilon || end.z <= frontEpsilon) {
    return;
  }

  const depthAlpha = Math.min(1, Math.max(0.12, (start.z + end.z) * 0.5 + 0.22));
  const rgb = index % 2 === 0 ? state.colors.accentRgb : state.colors.accentTwoRgb;
  const color = index % 2 === 0 ? state.colors.accent : state.colors.accentTwo;

  ctx.beginPath();
  ctx.moveTo(start.sx, start.sy);
  ctx.lineTo(end.sx, end.sy);
  ctx.strokeStyle = rgba(rgb, edgeAlpha * depthAlpha);
  ctx.lineWidth = 0.85 + audio.volume * 2.1 + audio.bass * 1.4;
  ctx.shadowColor = color;
  ctx.stroke();
}

// ========== RIPPLE SYSTEM ==========
// Creates new ripples on bass peaks, updates and filters existing ones
function updateRipples(audio, now) {
  const peak = audio.volume * 0.65 + audio.bass * 0.7;
  const minimumGap = 170 - Math.min(90, audio.bass * 90);
  const threshold = 0.34;

  if (state.isPlaying && peak > threshold && peak > state.lastPeak + 0.035 && now - state.lastRippleAt > minimumGap) {
    state.ripples.push({
      radius: 16,
      speed: 2.8 + audio.bass * 8.2,
      alpha: 0.55 + audio.volume * 0.3,
      width: 1.2 + audio.bass * 4.6,
      wobble: Math.random() * Math.PI * 2,
      color: Math.random() > 0.5 ? "accent" : "accentTwo"
    });
    state.lastRippleAt = now;
  }

  state.lastPeak = peak;

  const maxRadius = Math.hypot(canvas.width, canvas.height) * 0.58;
  state.ripples = state.ripples
    .map((ripple) => ({
      ...ripple,
      radius: ripple.radius + ripple.speed,
      alpha: ripple.alpha * 0.965,
      speed: ripple.speed * 0.992
    }))
    .filter((ripple) => ripple.alpha > 0.018 && ripple.radius < maxRadius);
}

// ========== RIPPLE DRAWING ==========
// Renders all active ripple circles with audio-reactive distortion
function drawRipples(audio, intensity) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const shadow = getThemeShadow(0.6 + audio.volume * 0.5);

  ctx.save();
  ctx.translate(centerX, centerY);

  for (const ripple of state.ripples) {
    const rgb = ripple.color === "accent" ? state.colors.accentRgb : state.colors.accentTwoRgb;
    const distortion = Math.sin(ripple.radius * 0.025 + ripple.wobble) * 5 * audio.bass;

    ctx.beginPath();
    ctx.arc(0, 0, ripple.radius + distortion, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(rgb, ripple.alpha * intensity);
    ctx.lineWidth = ripple.width;
    ctx.shadowBlur = shadow.secondaryBlur * (1 + audio.bass * 0.6);
    ctx.shadowColor = shadow.secondaryColor;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, ripple.radius * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(rgb, ripple.alpha * 0.24 * intensity);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function getThemeShadow(intensity = 1) {
  const theme = state.controls.theme;
  const [r, g, b] = state.colors.accentRgb;
  const [r2, g2, b2] = state.colors.accentTwoRgb;

  const profiles = {
    "magenta-cyan": {
      primaryBlur:   22 * intensity,
      secondaryBlur: 16 * intensity,
      primaryColor:  `rgba(${r},${g},${b},0.95)`,
      secondaryColor:`rgba(${r2},${g2},${b2},0.85)`,
      coreBlur:      38 * intensity,
      spikeBlur:     20 * intensity,
    },
    "toxic-aqua": {
      primaryBlur:   28 * intensity,
      secondaryBlur: 18 * intensity,
      primaryColor:  `rgba(${r},${g},${b},0.98)`,
      secondaryColor:`rgba(${r2},${g2},${b2},0.88)`,
      coreBlur:      44 * intensity,
      spikeBlur:     26 * intensity,
    },
    "blood-violet": {
      primaryBlur:   18 * intensity,
      secondaryBlur: 14 * intensity,
      primaryColor:  `rgba(${r},${g},${b},0.9)`,
      secondaryColor:`rgba(${r2},${g2},${b2},0.8)`,
      coreBlur:      32 * intensity,
      spikeBlur:     16 * intensity,
    },
    "acid-shadow": {
      primaryBlur:   32 * intensity,
      secondaryBlur: 20 * intensity,
      primaryColor:  `rgba(${r},${g},${b},1.0)`,
      secondaryColor:`rgba(${r2},${g2},${b2},0.9)`,
      coreBlur:      50 * intensity,
      spikeBlur:     30 * intensity,
    },
  };

  return profiles[theme] || profiles["magenta-cyan"];
}

function drawBars(audio) {
  if (!state.analyser || !state.frequencyData) return;

  state.analyser.getByteFrequencyData(state.frequencyData);

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  // Number of bars — use fewer bins for chunkier visible bars
  const totalBars = 64;
  const binStep = Math.floor(state.frequencyData.length / totalBars);
  const barW = (W * 0.82) / totalBars;
  const gap = barW * 0.18;
  const maxBarH = Math.min(H - 20, H * 0.80);
  const bassBoost = state.controls.bassSensitivity ?? 1.5;
  const sens = state.controls.sensitivity;

  const half = Math.floor(totalBars / 2);

  for (let i = 0; i < half; i++) {
    // Get raw frequency value for this bar index i
    let sum = 0;
    for (let k = 0; k < binStep; k++) {
      sum += state.frequencyData[i * binStep + k] || 0;
    }
    const raw = sum / binStep / 255;

    // Zone-based smoothing factor
    // i=0 is center (bass), i=half-1 is edge (treble)
    // Bass zone (i < 6): smoothing 0.18 — fast, punchy
    // Mid zone (i 6-14): smoothing 0.38 — moderate
    // Treble zone (i >= 15): smoothing 0.55 — slow, calm
    let smoothFactor;
    if (i < 6) {
      smoothFactor = 0.18;
    } else if (i < 15) {
      smoothFactor = 0.38;
    } else {
      smoothFactor = 0.55;
    }

    // Apply smoothing: blend toward new value at smoothFactor rate
    // Higher smoothFactor = slower to change = less jumpy
    state.barSmooth[i] = state.barSmooth[i] * (1 - smoothFactor)
      + raw * smoothFactor;

    const smoothed = state.barSmooth[i];
    const isBass = i < 6;
    const boosted = Math.min(1,
      smoothed * sens * (isBass ? bassBoost * 1.6 : 1));
    const maxAllowedH = Math.min(H - 8, H * 0.80);
    const barH = Math.max(3, Math.min(boosted * maxBarH, maxAllowedH - 4));

    const t = i / half;
    const [r1, g1, b1] = state.colors.accentRgb;
    const [r2, g2, b2] = state.colors.accentTwoRgb;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    const shadow = getThemeShadow(0.8 + boosted * 0.6);
    ctx.shadowBlur = isBass
      ? shadow.coreBlur * (1 + boosted * 0.5)
      : shadow.primaryBlur * (0.6 + boosted * 0.4);
    ctx.shadowColor = isBass
      ? shadow.primaryColor
      : shadow.secondaryColor;

    // Right side bar (mirror index from center going right)
    const xRight = cx + i * barW;
    const yBar = H - 8 - barH;

    const gradR = ctx.createLinearGradient(xRight, yBar, xRight, yBar + barH);
    gradR.addColorStop(0,   `rgba(${r},${g},${b},${0.85 + boosted * 0.15})`);
    gradR.addColorStop(0.6, `rgba(${r},${g},${b},0.5)`);
    gradR.addColorStop(1,   `rgba(${r},${g},${b},0.08)`);
    ctx.fillStyle = gradR;
    ctx.beginPath();
    ctx.roundRect(xRight + gap / 2, yBar, barW - gap, barH, [3, 3, 0, 0]);
    ctx.fill();

    // Top cap right
    ctx.shadowBlur = shadow.primaryBlur * 0.7;
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.beginPath();
    ctx.arc(xRight + barW / 2, yBar, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Left side bar (mirror of right, going left from center)
    const xLeft = cx - (i + 1) * barW;

    const gradL = ctx.createLinearGradient(xLeft, yBar, xLeft, yBar + barH);
    gradL.addColorStop(0,   `rgba(${r},${g},${b},${0.85 + boosted * 0.15})`);
    gradL.addColorStop(0.6, `rgba(${r},${g},${b},0.5)`);
    gradL.addColorStop(1,   `rgba(${r},${g},${b},0.08)`);
    ctx.fillStyle = gradL;
    ctx.beginPath();
    ctx.roundRect(xLeft + gap / 2, yBar, barW - gap, barH, [3, 3, 0, 0]);
    ctx.fill();

    // Top cap left
    ctx.shadowBlur = shadow.primaryBlur * 0.7;
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.beginPath();
    ctx.arc(xLeft + barW / 2, yBar, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Baseline divider line
  ctx.shadowBlur = 0;
  const baseY = H - 8;
  const totalWidth = totalBars * barW;
  ctx.strokeStyle = `rgba(${state.colors.accentRgb[0]},
    ${state.colors.accentRgb[1]},${state.colors.accentRgb[2]},0.2)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - totalWidth / 2, baseY);
  ctx.lineTo(cx + totalWidth / 2, baseY);
  ctx.stroke();

  ctx.restore();
}

// ========== PARTICLE MANAGEMENT ==========
// Adds or removes particles to match target count
function syncParticles() {
  const target = state.controls.particleCount;

  while (state.particles.length < target) {
    state.particles.push(createParticle());
  }

  if (state.particles.length > target) {
    state.particles.length = target;
  }
}

function resetParticles() {
  state.particles = [];
  syncParticles();
}

// Creates a new particle with random properties
function createParticle() {
  const style = state.controls.particleStyle;
  const baseSize = style === "bubbles" ? randomBetween(4, 16) : style === "sparks" ? randomBetween(1, 4) : randomBetween(1, 3);

  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: baseSize,
    speedX: randomBetween(-0.22, 0.22),
    speedY: style === "bubbles" ? randomBetween(-0.45, -0.12) : randomBetween(-0.18, 0.24),
    alpha: style === "sparks" ? randomBetween(0.28, 0.78) : randomBetween(0.12, 0.48),
    flicker: Math.random() * Math.PI * 2,
    colorShift: Math.random() > 0.5
  };
}

// ========== PARTICLE DRAWING ==========
// Updates and renders all particles based on selected style
function drawParticles(audio) {
  syncParticles();
  const style = state.controls.particleStyle;

  ctx.save();

  for (const particle of state.particles) {
    const driftBoost = 1 + audio.volume * 1.8;
    particle.x += particle.speedX * driftBoost;
    particle.y += particle.speedY * driftBoost;
    particle.flicker += 0.035 + audio.treble * 0.06;

    if (particle.x < -20) particle.x = canvas.width + 20;
    if (particle.x > canvas.width + 20) particle.x = -20;
    if (particle.y < -20) particle.y = canvas.height + 20;
    if (particle.y > canvas.height + 20) particle.y = -20;

    const rgb = particle.colorShift ? state.colors.accentRgb : state.colors.accentTwoRgb;
    const flicker = 0.72 + Math.sin(particle.flicker) * 0.28;
    const alpha = Math.min(0.9, particle.alpha * flicker + audio.volume * 0.08);

    if (style === "bubbles") {
      drawBubbleParticle(particle, rgb, alpha);
    } else if (style === "sparks") {
      drawSparkParticle(particle, rgb, alpha, audio);
    } else {
      drawDustParticle(particle, rgb, alpha);
    }
  }

  ctx.restore();
}

// Draws bubble-style particle (soft gradient with outline)
function drawBubbleParticle(particle, rgb, alpha) {
  const bubble = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 1.8);
  bubble.addColorStop(0, rgba(rgb, alpha * 0.34));
  bubble.addColorStop(0.58, rgba(rgb, alpha * 0.12));
  bubble.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = bubble;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(rgb, alpha * 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.stroke();
}

// Draws dust-style particle (simple glowing dot)
function drawDustParticle(particle, rgb, alpha) {
  ctx.shadowBlur = 12;
  ctx.shadowColor = rgba(rgb, 0.8);
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();
}

// Draws spark-style particle (digital glitch rectangles)
function drawSparkParticle(particle, rgb, alpha, audio) {
  const width = particle.size * (2.2 + audio.treble * 2);
  const height = Math.max(1, particle.size * 0.9);

  ctx.shadowBlur = 10 + audio.treble * 18;
  ctx.shadowColor = rgba(rgb, 0.9);
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.fillRect(Math.round(particle.x), Math.round(particle.y), width, height);

  if (Math.sin(particle.flicker * 2.4) > 0.78) {
    ctx.fillStyle = rgba(state.colors.accentTwoRgb, alpha * 0.62);
    ctx.fillRect(Math.round(particle.x - width * 1.2), Math.round(particle.y + 4), width * 0.8, 1);
  }
}

// ========== IDLE STATE DISPLAY ==========
// Shows pulsing rings + text when no audio file is loaded
function drawIdleState(now) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const base = Math.min(canvas.width, canvas.height) * 0.18;
  const pulse = 1 + Math.sin(now * 0.002) * 0.06;

  ctx.save();
  ctx.translate(centerX, centerY);

  for (let i = 0; i < 4; i += 1) {
    const radius = base * pulse + i * 34;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0
      ? rgba(state.colors.accentRgb, 0.18 - i * 0.025)
      : rgba(state.colors.accentTwoRgb, 0.16 - i * 0.02);
    ctx.lineWidth = 1.4;
    ctx.shadowBlur = 18;
    ctx.shadowColor = i % 2 === 0 ? state.colors.accent : state.colors.accentTwo;
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(244, 247, 251, 0.86)";
  ctx.shadowBlur = 18;
  ctx.shadowColor = state.colors.accentTwo;
  ctx.font = getIdleFont();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Awaiting local audio signal", 0, 0);

  ctx.fillStyle = "rgba(170, 179, 199, 0.78)";
  ctx.shadowBlur = 0;
  ctx.font = getIdleSubFont();
  ctx.fillText("Upload a file to wake the system", 0, 30);

  ctx.restore();
}

// ========== UTILITY FUNCTIONS ==========

// Updates canvas size based on container and device pixel ratio
function updateCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(320, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function handleResize() {
  updateCanvasSize();
  resetParticles();
}

// Updates slider readout values in UI
function updateControlReadouts() {
  sensitivityValue.textContent = Number(sensitivity.value).toFixed(2);
  bassSensitivityValue.textContent =
    Number(bassSensitivity.value).toFixed(2);
  ringSizeValue.textContent = Number(ringSize.value).toFixed(2);
  particleCountValue.textContent = particleCount.value;
  glowIntensityValue.textContent = Number(glowIntensity.value).toFixed(2);
}

// Reads CSS custom properties and updates state.colors
function updateThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  state.colors.accent = styles.getPropertyValue("--accent").trim();
  state.colors.accentTwo = styles.getPropertyValue("--accent-two").trim();
  state.colors.accentRgb = parseRgbVariable(styles.getPropertyValue("--accent-rgb"));
  state.colors.accentTwoRgb = parseRgbVariable(styles.getPropertyValue("--accent-two-rgb"));
}

// Parses "R, G, B" string into [R, G, B] array
function parseRgbVariable(value) {
  return value
    .split(",")
    .map((channel) => Number(channel.trim()))
    .filter((channel) => Number.isFinite(channel));
}

// Helper: Creates rgba() string from RGB array + alpha
function rgba(rgb, alpha) {
  return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")";
}

// Helper: Random number between min and max
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Responsive font size for idle text
function getIdleFont() {
  const size = Math.max(18, Math.min(28, canvas.width / 34));
  return "800 " + size + "px Inter, system-ui, sans-serif";
}

function getIdleSubFont() {
  const size = Math.max(13, Math.min(17, canvas.width / 54));
  return "500 " + size + "px Inter, system-ui, sans-serif";
}

// Start the app!
init();

// ========== DEV THEME LAB ==========
// Hidden panel for live color customization and CSS export
(function devThemeLab() {
  const toggle = document.getElementById("devThemeToggle");
  const panel = document.getElementById("devThemePanel");
  const closeBtn = document.getElementById("devPanelClose");
  const resetBtn = document.getElementById("devResetColors");
  const copyBtn = document.getElementById("devCopyCSS");
  const cssOutput = document.getElementById("devCSSOutput");

  const fields = [
    { colorId: "dev-accent",        hexId: "dev-accent-hex",
      cssVar: "--accent",           label: "--accent" },
    { colorId: "dev-accent-two",    hexId: "dev-accent-two-hex",
      cssVar: "--accent-two",       label: "--accent-two" },
    { colorId: "dev-bg-deep",       hexId: "dev-bg-deep-hex",
      cssVar: "--bg-deep",          label: "--bg-deep" },
    { colorId: "dev-bg-mid",        hexId: "dev-bg-mid-hex",
      cssVar: "--bg-mid",           label: "--bg-mid" },
    { colorId: "dev-panel-bg",      hexId: "dev-panel-bg-hex",
      cssVar: "--panel-bg-solid",   label: "--panel-bg (solid base)" },
    { colorId: "dev-panel-border",  hexId: "dev-panel-border-hex",
      cssVar: "--panel-border-solid", label: "--panel-border (solid base)" },
    { colorId: "dev-text-primary",  hexId: "dev-text-primary-hex",
      cssVar: "--text-primary",     label: "--text-primary" },
    { colorId: "dev-text-muted",    hexId: "dev-text-muted-hex",
      cssVar: "--text-muted",       label: "--text-muted" },
  ];

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return r + ", " + g + ", " + b;
  }

  function applyColor(cssVar, hex) {
    document.documentElement.style.setProperty(cssVar, hex);
    if (cssVar === "--accent") {
      document.documentElement.style.setProperty("--accent-rgb", hexToRgb(hex));
      updateThemeColors();
    }
    if (cssVar === "--accent-two") {
      document.documentElement.style.setProperty("--accent-two-rgb", hexToRgb(hex));
      updateThemeColors();
    }
  }

  function syncHexToColor(field) {
    const colorInput = document.getElementById(field.colorId);
    const hexInput = document.getElementById(field.hexId);
    colorInput.addEventListener("input", () => {
      hexInput.value = colorInput.value;
      applyColor(field.cssVar, colorInput.value);
    });
    hexInput.addEventListener("input", () => {
      const val = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        colorInput.value = val;
        applyColor(field.cssVar, val);
      }
    });
  }

  fields.forEach(syncHexToColor);

  toggle.addEventListener("click", () => {
    panel.hidden = false;
    cssOutput.hidden = true;
  });

  closeBtn.addEventListener("click", () => {
    panel.hidden = true;
  });

  resetBtn.addEventListener("click", () => {
    const styles = getComputedStyle(document.documentElement);
    fields.forEach(field => {
      document.documentElement.style.removeProperty(field.cssVar);
      if (field.cssVar === "--accent" || field.cssVar === "--accent-two") {
        document.documentElement.style.removeProperty(field.cssVar + "-rgb");
      }
    });
    updateThemeColors();
    cssOutput.hidden = true;
  });

  copyBtn.addEventListener("click", () => {
    const themeName = "my-custom-theme";
    let block = "[data-theme=\"" + themeName + "\"] {\n";
    fields.forEach(field => {
      const colorInput = document.getElementById(field.colorId);
      block += "  " + field.cssVar + ": " + colorInput.value + ";\n";
      if (field.cssVar === "--accent") {
        block += "  --accent-rgb: " + hexToRgb(colorInput.value) + ";\n";
      }
      if (field.cssVar === "--accent-two") {
        block += "  --accent-two-rgb: " + hexToRgb(colorInput.value) + ";\n";
      }
    });
    block += "}";
    cssOutput.textContent = block;
    cssOutput.hidden = false;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(block).catch(() => {});
    }
  });
})();
