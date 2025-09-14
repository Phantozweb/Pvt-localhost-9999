import { Component, ChangeDetectionStrategy, signal, viewChild, ElementRef, AfterViewInit, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Template } from '../models';
import { ImageGeneratorService } from '../image-generator.service';

@Component({
  selector: 'app-creator',
  templateUrl: './creator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class CreatorComponent implements AfterViewInit {
  private imageGenerator = inject(ImageGeneratorService);

  // Input signals
  recipientName = signal('Jane Doe');
  recipientEmail = signal('');
  
  // Customization signals
  fontSize = signal(80);
  fontColor = signal('#000000');
  yPosition = signal(50); // Represents percentage from the top
  selectedFont = signal('Great Vibes');
  emailSubject = signal('A personalized image for you');
  emailBodyTemplate = signal(`Hi {{name}},\n\nHere is your personalized image. Just paste it into this email!\n\nBest regards,`);

  // State signals
  uploadedImage = signal<HTMLImageElement | null>(null);

  // Template signals
  newTemplateName = signal('');
  savedTemplates = signal<Template[]>([]);
  selectedTemplate = signal(''); // Holds the name of the selected template

  canvas = viewChild<ElementRef<HTMLCanvasElement>>('certificateCanvas');
  
  fonts = ['Great Vibes', 'Poppins', 'Merriweather', 'Playfair Display'];

  isEmailValid = computed(() => {
    const email = this.recipientEmail();
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  constructor() {
    this.loadTemplatesFromStorage();
    
    // Effect to save templates to local storage whenever they change
    effect(() => {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('certificateTemplates', JSON.stringify(this.savedTemplates()));
      }
    });

    // Redraw canvas when any customizable property changes
    effect(() => {
      const img = this.uploadedImage();
      const canvas = this.canvas(); // Read canvas to establish dependency
      
      // These signal reads also establish dependencies for the effect.
      this.recipientName();
      this.fontSize();
      this.fontColor();
      this.yPosition();
      this.selectedFont();
      
      if (img && canvas) {
        this.drawCertificate();
      }
    });
  }

  async ngAfterViewInit() {
    await document.fonts.ready;
    if (this.uploadedImage()) {
      await this.drawCertificate();
    }
  }

  private loadTemplatesFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('certificateTemplates');
      if (saved) {
        this.savedTemplates.set(JSON.parse(saved));
      }
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const img = new Image();
          img.onload = () => {
            this.uploadedImage.set(img);
          };
          img.onerror = () => {
            console.error("Error loading image.");
            alert("There was an error loading the image file. Please try another one.");
          }
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select a valid image file.');
      }
    }
  }


  private async drawCertificate() {
    const img = this.uploadedImage();
    const canvas = this.canvas();
    if (!img || !canvas) return;

    const canvasEl = canvas.nativeElement;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    
    const template: Omit<Template, 'name' | 'imageDataUrl' | 'subject'> = {
        textOnImage: this.recipientName(),
        fontSize: this.fontSize(),
        fontColor: this.fontColor(),
        yPosition: this.yPosition(),
        selectedFont: this.selectedFont(),
        emailBodyTemplate: this.emailBodyTemplate(),
    };

    await this.imageGenerator.drawOnCanvas(canvasEl, img, template, this.recipientName());
  }

  onNameInput(event: Event) {
    this.recipientName.set((event.target as HTMLInputElement).value);
  }

  onEmailInput(event: Event) {
    this.recipientEmail.set((event.target as HTMLInputElement).value);
  }

  onEmailSubjectInput(event: Event) {
    this.emailSubject.set((event.target as HTMLInputElement).value);
  }
  
  onEmailBodyInput(event: Event) {
    this.emailBodyTemplate.set((event.target as HTMLTextAreaElement).value);
  }

  onFontSizeChange(event: Event) {
    this.fontSize.set(Number((event.target as HTMLInputElement).value));
  }

  onFontColorChange(event: Event) {
    this.fontColor.set((event.target as HTMLInputElement).value);
  }

  onYPositionChange(event: Event) {
    this.yPosition.set(Number((event.target as HTMLInputElement).value));
  }

  onFontChange(event: Event) {
    this.selectedFont.set((event.target as HTMLSelectElement).value);
  }
  
  adjustFontSize(amount: number) {
    this.fontSize.update(currentSize => {
      const newSize = currentSize + amount;
      return Math.max(10, Math.min(300, newSize));
    });
  }

  adjustYPosition(amount: number) {
    this.yPosition.update(currentPos => {
      const newPos = currentPos + amount;
      return Math.max(0, Math.min(100, newPos));
    });
  }

  onNewTemplateNameInput(event: Event) {
    this.newTemplateName.set((event.target as HTMLInputElement).value);
  }
  
  onTemplateSelected(event: Event) {
    const templateName = (event.target as HTMLSelectElement).value;
    this.loadTemplate(templateName);
  }

  saveTemplate() {
    const name = this.newTemplateName().trim();
    const image = this.uploadedImage();
    if (!name || !image) {
      alert('Please provide a template name and upload an image before saving.');
      return;
    }

    const newTemplate: Template = {
      name,
      imageDataUrl: image.src,
      textOnImage: this.recipientName(),
      fontSize: this.fontSize(),
      fontColor: this.fontColor(),
      yPosition: this.yPosition(),
      selectedFont: this.selectedFont(),
      subject: this.emailSubject(),
      emailBodyTemplate: this.emailBodyTemplate(),
    };

    this.savedTemplates.update(templates => {
      const existingIndex = templates.findIndex(t => t.name === name);
      if (existingIndex > -1) {
        templates[existingIndex] = newTemplate;
        return [...templates];
      }
      return [...templates, newTemplate];
    });

    this.newTemplateName.set('');
    this.selectedTemplate.set(name);
    alert(`Template '${name}' saved successfully!`);
  }

  loadTemplate(templateName: string) {
    if (!templateName) {
      this.selectedTemplate.set('');
      return;
    };

    const template = this.savedTemplates().find(t => t.name === templateName);
    if (!template) {
      console.error(`Template "${templateName}" not found.`);
      return;
    }

    this.recipientName.set(template.textOnImage);
    this.fontSize.set(template.fontSize);
    this.fontColor.set(template.fontColor);
    this.yPosition.set(template.yPosition);
    this.selectedFont.set(template.selectedFont);
    this.emailSubject.set(template.subject || 'A personalized image for you');
    this.emailBodyTemplate.set(template.emailBodyTemplate);
    this.selectedTemplate.set(template.name);

    const img = new Image();
    img.onload = () => this.uploadedImage.set(img);
    img.onerror = () => alert('Error loading image from template.');
    img.src = template.imageDataUrl;
  }
  
  deleteSelectedTemplate() {
    const templateName = this.selectedTemplate();
    if (!templateName) {
      alert('Please select a template to delete.');
      return;
    }
    
    if (confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
        this.savedTemplates.update(templates => templates.filter(t => t.name !== templateName));
        this.selectedTemplate.set('');
    }
  }

  exportSelectedTemplate() {
    const templateName = this.selectedTemplate();
    if (!templateName) {
      alert('Please select a template to export.');
      return;
    }

    const template = this.savedTemplates().find(t => t.name === templateName);
    if (!template) {
      alert('Could not find the selected template to export.');
      return;
    }

    const { imageDataUrl, ...settingsToExport } = template;

    const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${templateName.replace(/\s/g, '_')}-settings.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onTemplateImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File content is not readable.');
        }
        const settings = JSON.parse(text) as Omit<Template, 'imageDataUrl'>;
        
        // Validate imported settings
        if (!settings.name || !settings.fontSize || !settings.fontColor) {
           throw new Error('Invalid template file. Missing required properties.');
        }
        
        // Apply settings
        this.recipientName.set(settings.textOnImage);
        this.fontSize.set(settings.fontSize);
        this.fontColor.set(settings.fontColor);
        this.yPosition.set(settings.yPosition);
        this.selectedFont.set(settings.selectedFont);
        this.emailSubject.set(settings.subject || 'A personalized image for you');
        this.emailBodyTemplate.set(settings.emailBodyTemplate);

        alert(`Successfully imported settings from "${settings.name}". These settings have been applied to your current image.`);

      } catch (err) {
        console.error('Failed to import template:', err);
        alert(`Could not import template. Please make sure it's a valid settings file exported from this tool.`);
      } finally {
        // Reset file input to allow re-uploading the same file
        input.value = '';
      }
    };
    reader.onerror = () => {
        alert('An error occurred while reading the file.');
        input.value = '';
    };
    reader.readAsText(file);
  }

  private async getCanvasBlob(): Promise<Blob | null> {
    const canvas = this.canvas();
    if (!canvas) return Promise.resolve(null);
    const canvasEl = canvas.nativeElement;
    return new Promise<Blob | null>((resolve) =>
        canvasEl.toBlob(resolve, 'image/png')
      );
  }

  async copyImage() {
    try {
      const blob = await this.getCanvasBlob();
      if (!blob) throw new Error('Could not create image blob.');

      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
      alert('Image copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy image:', err);
      alert('Could not copy image to clipboard. Your browser might not support this feature or permission was denied.');
    }
  }

  async downloadCertificate() {
    const canvas = this.canvas();
    if (!canvas) return;
    const canvasEl = canvas.nativeElement;
    const dataUrl = canvasEl.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    const safeName = this.recipientName().replace(/\s/g, '_') || 'personalized_image';
    link.download = `Personalized-${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async sendViaEmail() {
    try {
      const blob = await this.getCanvasBlob();
      if (!blob) throw new Error('Could not create image blob.');

      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
      alert('Image copied to clipboard! Ready to paste into your email.');
      
      const recipient = this.recipientEmail();
      const subject = encodeURIComponent(this.emailSubject());
      const emailBody = this.emailBodyTemplate().replace(/{{name}}/g, this.recipientName() || 'there');
      const body = encodeURIComponent(emailBody);
      
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`);
    } catch (err) {
      console.error('Failed to copy image or send email:', err);
      alert('Could not copy image to clipboard. Please try downloading and attaching it manually.');
    }
  }
}
