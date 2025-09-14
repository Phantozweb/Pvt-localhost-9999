import { Injectable } from '@angular/core';
import { Template } from './models';

type DrawableTemplate = Omit<Template, 'name' | 'imageDataUrl' | 'subject'>;

@Injectable({ providedIn: 'root' })
export class ImageGeneratorService {

  /**
   * Generates an image and returns it as a Blob.
   */
  async generateBlob(template: Template, name: string): Promise<Blob | null> {
    const img = await this.loadImage(template.imageDataUrl);
    if (!img) return null;

    const canvas = document.createElement('canvas');
    await this.drawOnCanvas(canvas, img, template, name);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  /**
   * Draws a personalized image directly onto a provided canvas element.
   */
  async drawOnCanvas(canvasEl: HTMLCanvasElement, image: HTMLImageElement, template: DrawableTemplate, name: string) {
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    const fontSize = template.fontSize;
    const fontFamily = template.selectedFont;
    
    // Ensure the font is loaded before trying to use it
    try {
      await document.fonts.load(`${fontSize}px "${fontFamily}"`);
    } catch (err) {
      console.warn(`Could not load font: ${fontFamily}. It may not render correctly.`, err);
    }

    canvasEl.width = image.width;
    canvasEl.height = image.height;
    ctx.drawImage(image, 0, 0);

    const fontFallbacks: { [key: string]: string } = {
        'Great Vibes': 'cursive',
        'Poppins': 'sans-serif',
        'Merriweather': 'serif',
        'Playfair Display': 'serif'
    };
    const fallback = fontFallbacks[fontFamily] || 'sans-serif';

    ctx.fillStyle = template.fontColor;
    ctx.font = `${fontSize}px "${fontFamily}", ${fallback}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const textToDraw = name.trim() || template.textOnImage;
    const yPos = canvasEl.height * (template.yPosition / 100);

    ctx.fillText(textToDraw, canvasEl.width / 2, yPos);
  }

  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.error("Error loading image from data URL.");
        resolve(null);
      };
      // For images from templates, they might be cross-origin if loaded differently.
      // This is good practice, though data URLs don't have this issue.
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }
}
