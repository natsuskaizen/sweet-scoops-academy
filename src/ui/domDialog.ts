/**
 * Plain HTML dialogs for the grown-ups area (Characters, Players), used where
 * a screen needs the device's own keyboard, text fields or a file picker.
 * They share one look, scoped under the .ssa-dialog class.
 */
export const DIALOG_STYLE = `
.ssa-dialog { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background: rgba(74, 58, 88, .45); font: 600 18px "Trebuchet MS", "Avenir Next Rounded", system-ui, sans-serif;
  color: #4a3a58; -webkit-user-select: text; user-select: text; touch-action: manipulation; }
.ssa-dialog .panel { background: #fff6e8; border: 5px solid #9b84d1; border-radius: 24px; padding: 20px 24px;
  width: min(640px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; box-sizing: border-box; }
.ssa-dialog h2 { margin: 0 0 12px; font-size: 28px; display: flex; justify-content: space-between; align-items: center; }
.ssa-dialog button { font: inherit; border: 3px solid #4a3a58; border-radius: 14px; background: #fff; padding: 8px 14px;
  min-height: 48px; color: inherit; }
.ssa-dialog button.main { background: #9ee6c4; } .ssa-dialog button.warn { background: #ffc9a8; }
.ssa-dialog .row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 2px dotted #c7b3f0;
  flex-wrap: wrap; }
.ssa-dialog .row .who { flex: 1 1 200px; } .ssa-dialog .row small { display: block; color: #7a6a88; font-weight: 500; }
.ssa-dialog canvas { image-rendering: pixelated; background: #f3e2c7; border-radius: 8px; }
.ssa-dialog label { display: block; margin: 10px 0 4px; }
.ssa-dialog input, .ssa-dialog select, .ssa-dialog textarea { font: inherit; width: 100%; box-sizing: border-box;
  border: 2px solid #9b84d1; border-radius: 10px; padding: 8px; background: #fff; }
.ssa-dialog .error { color: #e0607e; margin: 8px 0; } .ssa-dialog .hint { color: #7a6a88; font-weight: 500; }
.ssa-dialog .buttons { display: flex; gap: 12px; margin-top: 16px; justify-content: flex-end; }`;

export type Children = (Node | string | null)[];

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: Children = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c): c is Node | string => c !== null));
  return node;
}

/** Puts a dialog over the game, and keeps its taps from reaching the game underneath. */
export function openDialog(className: string, panel: HTMLElement): HTMLDivElement {
  const root = el('div', { className: `ssa-dialog ${className}` }, [el('style', { textContent: DIALOG_STYLE }), panel]);
  // Phaser also listens for releases on the window.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
    root.addEventListener(type, (e) => e.stopPropagation());
  }
  document.body.append(root);
  return root;
}
