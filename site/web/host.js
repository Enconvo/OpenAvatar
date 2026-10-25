// The live avatar the pages show: the reference renderer on a canvas over the still picture, following the pointer
// the way an app's avatar does (SPEC 12.1 `pointer`). Without WebGL, or when a file can't be read, `startStage`
// throws and the picture stays.
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** A gallery avatar's document, read from its file. */
export async function documentOf(entry) {
  const response = await fetch(`/avatars/${entry.slug}.openavatar?v=${entry.revision}`);
  if (!response.ok) throw new Error(`${entry.slug}: ${response.status}`);
  return (await import('@openavatar/core')).parse(await response.text()).document;
}

/** A stage on the figure's canvas, sized to it. */
export async function startStage(figure) {
  const canvas = figure.querySelector('.stage-canvas');
  const { OpenAvatarStage } = await import('@openavatar/three');
  const stage = new OpenAvatarStage(canvas, { pixelRatio: Math.min(devicePixelRatio, 2) });
  const fit = () => {
    stage.resize(canvas.clientWidth, canvas.clientHeight);
    if (reduceMotion.matches) stage.render(0);
  };
  new ResizeObserver(fit).observe(canvas);
  fit();
  if (!reduceMotion.matches) followPointer(stage, canvas);
  return stage;
}

/** Runs the stage, or, when motion is unwelcome, draws the pose it settles into. Call again after each change. */
export function run(stage) {
  if (!reduceMotion.matches) return stage.start();
  for (let i = 0; i < 15; i++) stage.avatar?.update(.1);
  stage.render(0);
}

// Where the pointer is, relative to the avatar, from anywhere on the page.
function followPointer(stage, canvas) {
  let pending = null;
  addEventListener('pointermove', event => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      const r = canvas.getBoundingClientRect();
      const clamp = v => Math.max(-1, Math.min(1, v));
      stage.setInput({ pointer: [clamp((event.clientX - r.left - r.width / 2) / (r.width / 2)), clamp(-(event.clientY - r.top - r.height / 2) / (r.height / 2))] });
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => stage.setInput({ pointer: null }));
}
