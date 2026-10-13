import Phaser from 'phaser';
import { COLORS, CSS, text } from './theme';

export type TicketMood = 'neutral' | 'happy' | 'gentle' | 'explain';

/**
 * The order ticket pinned beside the register: who ordered, the math
 * expression (big and unambiguous), the answer being typed, and a short
 * feedback line.
 */
export class OrderPanel extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private expression: Phaser.GameObjects.Text;
  private answerBox: Phaser.GameObjects.Graphics;
  private answer: Phaser.GameObjects.Text;
  private feedback: Phaser.GameObjects.Text;
  private caret: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, private boxW: number, private boxH: number) {
    super(scene, x, y);
    const w = boxW;
    const h = boxH;
    this.bg = scene.add.graphics();
    this.title = scene.add.text(w / 2, 18, '', text(26, CSS.inkSoft)).setOrigin(0.5, 0);
    this.expression = scene.add.text(w / 2, 106, '', text(68, CSS.ink)).setOrigin(0.5);
    this.answerBox = scene.add.graphics();
    this.answer = scene.add.text(w / 2, 186, '', text(60, CSS.sky)).setOrigin(0.5);
    this.caret = scene.add.rectangle(w / 2, 186, 6, 50, COLORS.skyDark).setOrigin(0.5);
    this.feedback = scene.add
      .text(w / 2, h - 36, '', text(25, CSS.ink, { align: 'center', wordWrap: { width: w - 36 } }))
      .setOrigin(0.5);
    this.add([this.bg, this.title, this.expression, this.answerBox, this.answer, this.caret, this.feedback]);
    scene.tweens.add({ targets: this.caret, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
    this.draw('neutral');
    this.clearOrder();
    scene.add.existing(this);
  }

  showOrder(title: string, expression: string): void {
    this.title.setText(title);
    this.expression.setText(`${expression} =`);
    this.setAnswer('');
    this.setFeedback('', 'neutral');
    this.expression.setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: this.expression, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  }

  clearOrder(): void {
    this.title.setText('Waiting for a customer…');
    this.expression.setText('');
    this.answer.setText('');
    this.feedback.setText('');
    this.caret.setVisible(false);
    this.answerBox.clear();
    this.draw('neutral');
  }

  setAnswer(value: string, color: string = CSS.sky): void {
    this.answer.setText(value).setColor(color);
    this.caret.setVisible(value.length === 0 && this.expression.text !== '');
    this.drawAnswerBox();
  }

  setFeedback(message: string, mood: TicketMood): void {
    this.feedback.setText(message);
    this.feedback.setColor(mood === 'happy' ? CSS.mint : mood === 'explain' ? CSS.strawberry : CSS.ink);
    this.draw(mood);
  }

  /** Little shake that says "not quite" without being scary. */
  wiggle(): void {
    this.scene.tweens.add({ targets: this.answer, x: this.answer.x + 8, duration: 60, yoyo: true, repeat: 2 });
  }

  private drawAnswerBox(): void {
    const g = this.answerBox;
    g.clear();
    if (this.expression.text === '') return;
    g.fillStyle(COLORS.white, 1).fillRoundedRect(this.boxW / 2 - 90, 148, 180, 76, 18);
    g.lineStyle(4, COLORS.skyDark, 1).strokeRoundedRect(this.boxW / 2 - 90, 148, 180, 76, 18);
  }

  private draw(mood: TicketMood): void {
    const g = this.bg;
    const border =
      mood === 'happy' ? COLORS.mintDark : mood === 'explain' ? COLORS.strawberry : mood === 'gentle' ? COLORS.peach : COLORS.lavenderDark;
    g.clear();
    g.fillStyle(COLORS.shadow, 0.12).fillRoundedRect(6, 10, this.boxW, this.boxH, 24);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(0, 0, this.boxW, this.boxH, 24);
    g.lineStyle(6, border, 1).strokeRoundedRect(0, 0, this.boxW, this.boxH, 24);
    // Ticket "tear" dots along the top.
    g.fillStyle(border, 1);
    for (let x = 24; x < this.boxW - 12; x += 28) g.fillCircle(x, 58, 3);
    this.drawAnswerBox();
  }
}

/** Speech bubble that floats above a customer's head. */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, private boxW: number, private boxH: number) {
    super(scene, x, y);
    const w = boxW;
    const h = boxH;
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(w / 2, h / 2 - 6, '', text(30, CSS.ink, { align: 'center', wordWrap: { width: w - 44 }, lineSpacing: 4 }))
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** Shows `message`, with the tail pointing at `tailX` (scene coordinates). */
  say(message: string, tailX: number): void {
    this.label.setText(message);
    const g = this.bg;
    const tail = Phaser.Math.Clamp(tailX - this.x, 40, this.boxW - 40);
    g.clear();
    g.fillStyle(COLORS.shadow, 0.1).fillRoundedRect(4, 6, this.boxW, this.boxH - 20, 26);
    g.fillStyle(COLORS.white, 1).fillRoundedRect(0, 0, this.boxW, this.boxH - 20, 26);
    g.fillTriangle(tail - 18, this.boxH - 22, tail + 18, this.boxH - 22, tail, this.boxH);
    g.lineStyle(4, COLORS.ink, 0.8).strokeRoundedRect(0, 0, this.boxW, this.boxH - 20, 26);
    g.lineBetween(tail - 18, this.boxH - 21, tail, this.boxH);
    g.lineBetween(tail + 18, this.boxH - 21, tail, this.boxH);
    this.setVisible(true).setScale(0.85).setAlpha(0);
    this.scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  }

  hide(): void {
    this.setVisible(false);
  }
}
