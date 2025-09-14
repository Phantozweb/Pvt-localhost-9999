export interface Template {
  name: string;
  imageDataUrl: string;
  textOnImage: string;
  fontSize: number;
  fontColor: string;
  yPosition: number;
  selectedFont: string;
  subject: string;
  emailBodyTemplate: string;
}

export interface Recipient {
  id: number;
  name: string;
  email: string;
  status: 'pending' | 'sent';
}
