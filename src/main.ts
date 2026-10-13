import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { ShopScene } from './scenes/ShopScene';
import { GAME_H, GAME_W } from './ui/theme';

// One fixed landscape composition, scaled to fit any landscape screen.
// Portrait is handled by the rotate message in index.html (orientation can't be locked).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#fff6e8',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, ShopScene],
});
