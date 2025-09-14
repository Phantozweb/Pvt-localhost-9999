import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageGeneratorService } from '../image-generator.service';
import { Recipient, Template } from '../models';

// Make PapaParse available in the component
declare var Papa: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private imageGenerator = inject(ImageGeneratorService);

  // State signals
  pendingRecipients = signal<Recipient[]>([]);
  sentRecipients = signal<Recipient[]>([]);
  processingRecipientId = signal<number | null>(null);
  
  // Template signals
  savedTemplates = signal<Template[]>([]);
  selectedTemplateName = signal('');

  // Computed signals for UI
  totalRecipients = computed(() => this.pendingRecipients().length + this.sentRecipients().length);
  
  progress = computed(() => {
    const total = this.totalRecipients();
    if (total === 0) return 0;
    return (this.sentRecipients().length / total) * 100;
  });

  chartData = computed(() => {
    const sent = this.sentRecipients().length;
    const pending = this.pendingRecipients().length;
    const total = sent + pending;

    let sentPathD = '';
    if (total > 0) {
      const sentAngle = (sent / total) * 360;

      // Use the robust two-arc path for a full circle.
      if (sentAngle >= 359.99) {
        sentPathD = 'M18 2.0845 a 15.9155 15.9155 0 1 1 0 31.831 a 15.9155 15.9155 0 1 1 0 -31.831';
      } else if (sentAngle > 0) {
        const radius = 15.9155;
        const centerX = 18;
        const centerY = 18;
        
        // Convert angle to radians for trigonometric functions
        const angleRad = (sentAngle * Math.PI) / 180;
        
        // Calculate the end point of the arc
        const endX = centerX + radius * Math.sin(angleRad);
        const endY = centerY - radius * Math.cos(angleRad);
        
        // Determine if the arc should be greater than 180 degrees
        const largeArcFlag = sentAngle > 180 ? 1 : 0;

        // Construct the SVG path data string
        // M -> move to start point (top of the circle)
        // A -> draw an elliptical arc
        // L -> draw a line to the center
        // Z -> close the path to form a slice
        sentPathD = `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} L ${centerX} ${centerY} Z`;
      }
    }

    return {
      sent,
      pending,
      sentPathD
    };
  });


  constructor() {
    this.loadTemplatesFromStorage();
  }

  private loadTemplatesFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('certificateTemplates');
      if (saved) {
        this.savedTemplates.set(JSON.parse(saved));
        if (this.savedTemplates().length > 0) {
          this.selectedTemplateName.set(this.savedTemplates()[0].name);
        }
      }
    }
  }

  onCsvFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.pendingRecipients.set([]);
    this.sentRecipients.set([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
      complete: (results: { data: { name: any; email: any }[], errors: any[] }) => {
        // Always reset the file input to allow re-uploading the same file
        if(input) {
            input.value = '';
        }

        if (results.errors.length) {
            console.error('CSV Parsing Errors:', results.errors);
            alert('An error occurred while parsing the CSV file. Please ensure it is correctly formatted.');
            return;
        }

        if (!results.data || results.data.length === 0) {
            alert('The CSV file is empty or could not be read.');
            return;
        }
        
        const firstRow = results.data[0];
        if (!('name' in firstRow) || !('email' in firstRow)) {
            alert('Could not find "name" and "email" columns in the CSV. Please check the file headers (they are case-insensitive).');
            return;
        }

        const validRecipients = results.data
            .map((row, index) => ({
                id: index,
                name: String(row.name || '').trim(),
                email: String(row.email || '').trim(),
                status: 'pending' as const,
            }))
            .filter(rec => rec.name && rec.email); // Filter AFTER trimming and mapping
        
        if (validRecipients.length === 0) {
            alert('No valid rows with both a name and an email were found in your CSV file.');
            return;
        }
        
        this.pendingRecipients.set(validRecipients);
        alert(`Successfully loaded ${validRecipients.length} recipients.`);
      },
      error: (error: any) => {
        console.error('CSV Parsing Error:', error);
        alert('Failed to parse the CSV file. It might be corrupted or not a valid CSV. Please check the file and try again.');
        if(input) {
            input.value = '';
        }
      }
    });
  }

  onTemplateSelected(event: Event) {
    this.selectedTemplateName.set((event.target as HTMLSelectElement).value);
  }

  async sendToRecipient(recipient: Recipient) {
    const templateName = this.selectedTemplateName();
    const template = this.savedTemplates().find(t => t.name === templateName);

    if (!template) {
      alert('Please select a valid template first.');
      return;
    }

    this.processingRecipientId.set(recipient.id);

    try {
      const blob = await this.imageGenerator.generateBlob(template, recipient.name);

      if (!blob) {
        throw new Error(`Failed to generate image for ${recipient.name}`);
      }

      // Copy to clipboard
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      
      const alertMessage = recipient.status === 'pending'
        ? `Image for ${recipient.name} copied! Paste it into the new email window.`
        : `Image for ${recipient.name} copied again! Paste it into the new email window.`;

      alert(alertMessage);

      // Prepare email
      const subject = encodeURIComponent(template.subject || 'A personalized image for you');
      const emailBody = template.emailBodyTemplate.replace(/{{name}}/g, recipient.name || 'there');
      const body = encodeURIComponent(emailBody);
      
      // Open mailto link
      window.open(`mailto:${recipient.email}?subject=${subject}&body=${body}`);

      // Update state only if it was a pending recipient
      if (recipient.status === 'pending') {
          this.pendingRecipients.update(p => p.filter(r => r.id !== recipient.id));
          this.sentRecipients.update(s => [...s, { ...recipient, status: 'sent' as const }].sort((a,b) => a.id - b.id));
      }
      
    } catch(err) {
      console.error(`Failed to process recipient ${recipient.name}:`, err);
      alert(`Could not process ${recipient.name}. Your browser might have blocked the action. Check the console for more details.`);
    } finally {
      this.processingRecipientId.set(null);
    }
  }
}
