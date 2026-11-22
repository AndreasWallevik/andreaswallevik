type Mode = 'oscilloscope' | 'psychedelic' | 'artwork';
type Levels = { bass: number; mids: number; highs: number };

export function initRadioVisualizer(audio: HTMLAudioElement, radio: HTMLElement) {
  const root = radio.querySelector<HTMLElement>('[data-radio-visualizer]')!;
  const stage = root.querySelector<HTMLElement>('[data-visualizer-stage]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-visualizer-canvas]')!;
  const image = root.querySelector<HTMLImageElement>('[data-artwork]')!;
  const toggle = root.querySelector<HTMLButtonElement>('[data-visualizer-toggle]')!;
  const modeSelect = root.querySelector<HTMLSelectElement>('[data-visualizer-mode]')!;
  const paint = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 760px)');
  const listeners = new AbortController();

  let enabled = false;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let frequencies: Uint8Array<ArrayBuffer> | null = null;
  let waveform: Uint8Array<ArrayBuffer> | null = null;
  let frame = 0;
  let lastFrame = 0;
  let destroyed = false;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    stage.dataset.running = 'false';
    delete stage.dataset.bands;
    image.style.transform = '';
    image.style.filter = '';
    paint?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resize() {
    if (!paint) return;
    const { width, height } = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.5 : 2);
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function band(lowHz: number, highHz: number) {
    if (!analyser || !context || !frequencies) return 0;
    const hzPerBin = context.sampleRate / analyser.fftSize;
    const first = Math.max(1, Math.floor(lowHz / hzPerBin));
    const last = Math.min(frequencies.length, Math.ceil(highHz / hzPerBin));
    let total = 0;
    for (let index = first; index < last; index += 1) total += frequencies[index];
    return Math.min(1, (total / Math.max(1, last - first)) / 255);
  }

  function drawOscilloscope(width: number, height: number, levels: Levels) {
    if (!paint || !waveform) return;
    const samples = waveform;
    paint.fillStyle = '#101c18';
    paint.fillRect(0, 0, width, height);
    paint.strokeStyle = 'rgba(209, 223, 142, .12)';
    paint.lineWidth = 1;
    for (let x = 0; x < width; x += 32) { paint.beginPath(); paint.moveTo(x, 0); paint.lineTo(x, height); paint.stroke(); }
    for (let y = 0; y < height; y += 32) { paint.beginPath(); paint.moveTo(0, y); paint.lineTo(width, y); paint.stroke(); }

    paint.beginPath();
    samples.forEach((sample, index) => {
      const x = index / (samples.length - 1) * width;
      const y = height / 2 + ((sample - 128) / 128) * height * .39;
      if (index === 0) paint!.moveTo(x, y);
      else paint!.lineTo(x, y);
    });
    paint.strokeStyle = '#d1df8e';
    paint.lineWidth = 1.5 + levels.bass * 2;
    paint.shadowColor = '#d1df8e';
    paint.shadowBlur = 10 + levels.mids * 20;
    paint.stroke();
    paint.shadowBlur = 0;
    paint.fillStyle = '#d1df8e';
    paint.font = '700 11px monospace';
    paint.fillText('SKRRR / AUDIO SIGNAL', 18, 26);
    paint.fillText(`LOW ${Math.round(levels.bass * 100)}  MID ${Math.round(levels.mids * 100)}  HIGH ${Math.round(levels.highs * 100)}`, 18, 44);
  }

  function drawPsychedelic(width: number, height: number, levels: Levels, seconds: number) {
    if (!paint || !frequencies) return;
    paint.fillStyle = '#101c18';
    paint.fillRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const unit = Math.min(width, height);
    paint.globalCompositeOperation = 'screen';
    for (let layer = 2; layer >= 0; layer -= 1) {
      paint.beginPath();
      const base = unit * (.14 + layer * .07) + levels.bass * unit * .09;
      for (let point = 0; point <= 96; point += 1) {
        const angle = point / 96 * Math.PI * 2;
        const sample = frequencies[Math.floor(point / 97 * frequencies.length)] / 255;
        const ripple = Math.sin(angle * (4 + layer) + seconds * (layer % 2 ? -1 : 1)) * (5 + levels.mids * 25);
        const radius = base + ripple + sample * unit * (.04 + levels.highs * .05);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (point === 0) paint.moveTo(x, y);
        else paint.lineTo(x, y);
      }
      paint.closePath();
      paint.fillStyle = [
        `rgba(189, 106, 68, ${.2 + levels.bass * .38})`,
        `rgba(109, 155, 121, ${.2 + levels.mids * .35})`,
        `rgba(209, 223, 142, ${.25 + levels.highs * .5})`,
      ][layer];
      paint.fill();
      paint.strokeStyle = ['#bd6a44', '#709b79', '#d1df8e'][layer];
      paint.lineWidth = 1 + levels.highs * 3;
      paint.stroke();
    }
    paint.globalCompositeOperation = 'source-over';
    for (let index = 0; index < 18; index += 1) {
      const angle = index / 18 * Math.PI * 2 + seconds * .12;
      const radius = unit * (.35 + levels.bass * .09);
      const size = 1 + levels.highs * 6;
      paint.fillStyle = '#d1df8e';
      paint.beginPath();
      paint.arc(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, size, 0, Math.PI * 2);
      paint.fill();
    }
  }

  function drawArtwork(width: number, height: number, levels: Levels, seconds: number) {
    if (!paint) return;
    paint.clearRect(0, 0, width, height);
    image.style.transform = `scale(${1 + levels.bass * .075}) rotate(${(levels.mids - .2) * 1.5}deg)`;
    image.style.filter = `saturate(${1 + levels.mids * .9}) contrast(${1 + levels.highs * .28})`;
    paint.strokeStyle = `rgba(209, 223, 142, ${.2 + levels.highs * .5})`;
    paint.lineWidth = 1 + levels.mids * 3;
    for (let index = 0; index < 3; index += 1) {
      paint.beginPath();
      paint.arc(width / 2, height / 2, Math.min(width, height) * (.24 + index * .14 + levels.bass * .05), seconds * .2 + index, seconds * .2 + index + Math.PI * (1 + levels.highs));
      paint.stroke();
    }
  }

  function draw(time: number) {
    frame = 0;
    if (reducedMotion.matches && enabled) updateMotion();
    if (!enabled || reducedMotion.matches || audio.paused || document.hidden || context?.state !== 'running' || !analyser || !frequencies || !waveform || !paint) { stop(); return; }
    const interval = mobile.matches ? 1000 / 30 : 1000 / 45;
    if (time - lastFrame >= interval) {
      lastFrame = time;
      resize();
      analyser.getByteFrequencyData(frequencies);
      analyser.getByteTimeDomainData(waveform);
      const levels = { bass: band(35, 180), mids: band(180, 2000), highs: band(2000, 8000) };
      stage.dataset.bands = `${levels.bass.toFixed(2)},${levels.mids.toFixed(2)},${levels.highs.toFixed(2)}`;
      const ratio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.5 : 2);
      const width = canvas.width / ratio;
      const height = canvas.height / ratio;
      switch (modeSelect.value as Mode) {
        case 'oscilloscope': drawOscilloscope(width, height, levels); break;
        case 'psychedelic': drawPsychedelic(width, height, levels, time / 1000); break;
        case 'artwork': drawArtwork(width, height, levels, time / 1000); break;
      }
    }
    frame = requestAnimationFrame(draw);
  }

  function refresh() {
    if (!enabled || reducedMotion.matches || audio.paused || document.hidden || context?.state !== 'running') { stop(); return; }
    stage.dataset.running = 'true';
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function fail() {
    enabled = false;
    stop();
    toggle.disabled = true;
    toggle.textContent = 'Visualizer unavailable';
    toggle.setAttribute('aria-pressed', 'false');
  }

  function prepareForPlayback() {
    if (!enabled || reducedMotion.matches || !paint || destroyed) return;
    if (!context) {
      try {
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = .72;
        source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);
        frequencies = new Uint8Array(analyser.frequencyBinCount);
        waveform = new Uint8Array(analyser.fftSize);
        context.addEventListener('statechange', refresh, { signal: listeners.signal });
      } catch {
        fail();
        return;
      }
    }
    if (context.state === 'suspended') void context.resume().then(refresh).catch(fail);
    else refresh();
  }

  toggle.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    enabled = !enabled;
    toggle.textContent = enabled ? 'Visualizer on' : 'Visualizer off';
    toggle.setAttribute('aria-pressed', String(enabled));
    if (enabled) prepareForPlayback();
    else stop();
  }, { signal: listeners.signal });

  modeSelect.addEventListener('change', () => {
    stage.dataset.mode = modeSelect.value;
    image.style.transform = '';
    image.style.filter = '';
    refresh();
  }, { signal: listeners.signal });

  const updateMotion = () => {
    if (reducedMotion.matches) { enabled = false; stop(); }
    toggle.disabled = reducedMotion.matches || !paint;
    modeSelect.disabled = reducedMotion.matches || !paint;
    toggle.textContent = reducedMotion.matches ? 'Visualizer off · reduced motion' : 'Visualizer off';
    toggle.setAttribute('aria-pressed', 'false');
  };
  reducedMotion.addEventListener('change', updateMotion, { signal: listeners.signal });
  audio.addEventListener('play', refresh, { signal: listeners.signal });
  audio.addEventListener('pause', stop, { signal: listeners.signal });
  audio.addEventListener('ended', stop, { signal: listeners.signal });
  document.addEventListener('visibilitychange', refresh, { signal: listeners.signal });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stop();
    resizeObserver.disconnect();
    listeners.abort();
    if (context) void context.close();
  };
  window.addEventListener('pagehide', (event) => { if (event.persisted) stop(); else destroy(); }, { signal: listeners.signal });
  window.addEventListener('pageshow', refresh, { signal: listeners.signal });
  stage.dataset.mode = modeSelect.value;
  updateMotion();
  return { prepareForPlayback };
}
