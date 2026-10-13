import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { ShopScene } from './scenes/ShopScene';
import { LAYOUT, layoutFor, setLayout } from './ui/theme';

// Landscape screens get the side-by-side shop; portrait screens (iPhone, iPad
// held upright) get the shop on top and the register below. Each layout is a
// fixed composition scaled to fit the screen.
setLayout(layoutFor(window.innerWidth, window.innerHeight));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: LAYOUT.width,
  height: LAYOUT.height,
  backgroundColor: '#fff6e8',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, ShopScene],
});

/** Switches layout when the screen turns; the shop rebuilds from the save, like a reload. */
function applyScreenLayout(): void {
  const next = layoutFor(window.innerWidth, window.innerHeight);
  if (next.width !== LAYOUT.width || next.height !== LAYOUT.height) {
    setLayout(next);
    game.scale.setGameSize(next.width, next.height);
    if (game.scene.isActive('Shop')) game.scene.getScene('Shop').scene.restart();
  }
  game.scale.refresh();
}

// iPad and iPhone Safari report the old viewport size for a moment after load
// and after rotating, so measure again a few times once things settle.
let timers: number[] = [];
const onScreenChange = () => {
  timers.forEach(clearTimeout);
  timers = [50, 300, 800].map((ms) => window.setTimeout(applyScreenLayout, ms));
};
window.addEventListener('resize', onScreenChange);
window.addEventListener('orientationchange', onScreenChange);
window.visualViewport?.addEventListener('resize', onScreenChange);
window.addEventListener('pageshow', onScreenChange);
game.events.once(Phaser.Core.Events.READY, onScreenChange);
