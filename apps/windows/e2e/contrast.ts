import type { Page } from "@playwright/test";

export type ButtonContrast = {
  name: string;
  ratio: number;
  color: string;
  background: string;
};

/** Contrast of every button against the nearest opaque background, from computed style. */
export async function readButtonContrasts(page: Page): Promise<ButtonContrast[]> {
  return page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
    type Rgba = { r: number; g: number; b: number; a: number };
    function parse(color: string): Rgba | null {
      const match = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
      if (!match) {
        return null;
      }
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4]),
      };
    }
    function channel(value: number): number {
      const unit = value / 255;
      return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    }
    function luminance(rgb: { r: number; g: number; b: number }): number {
      return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    }
    function over(front: Rgba, back: { r: number; g: number; b: number }) {
      return {
        r: front.r * front.a + back.r * (1 - front.a),
        g: front.g * front.a + back.g * (1 - front.a),
        b: front.b * front.a + back.b * (1 - front.a),
      };
    }
    function backdrop(element: Element): { r: number; g: number; b: number } {
      const layers: Rgba[] = [];
      let node: Element | null = element;
      while (node) {
        const parsed = parse(getComputedStyle(node).backgroundColor);
        if (parsed && parsed.a > 0) {
          layers.push(parsed);
          if (parsed.a >= 0.999) {
            break;
          }
        }
        node = node.parentElement;
      }
      let acc = { r: 255, g: 255, b: 255 };
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        acc = over(layers[index], acc);
      }
      return acc;
    }
    return [...document.querySelectorAll("button")].map((button) => {
      const style = getComputedStyle(button);
      const fg = parse(style.color);
      const bg = backdrop(button);
      const opacity = Number(style.opacity || "1");
      const painted = fg ? over({ ...fg, a: fg.a * opacity }, bg) : { r: 0, g: 0, b: 0 };
      const lighter = Math.max(luminance(painted), luminance(bg));
      const darker = Math.min(luminance(painted), luminance(bg));
      return {
        name: (button.textContent ?? "").trim() || button.getAttribute("aria-label") || "button",
        ratio: (lighter + 0.05) / (darker + 0.05),
        color: style.color,
        background: `rgb(${Math.round(bg.r)} ${Math.round(bg.g)} ${Math.round(bg.b)})`,
      };
    });
  });
}
