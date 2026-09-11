export interface Caption {
  id: string;
  sender: string;
  text: string;
  language: string;
  timestamp: number;
}

export interface Translation {
  id: string;
  captionId: string;
  sender: string;
  originalText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  timestamp: number;
}

export interface MeetingSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  generatedAt: number;
}

export interface OfferData {
  sender: string;
  offer: RTCSessionDescriptionInit;
}

export interface AnswerData {
  sender: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidateData {
  sender: string;
  candidate: RTCIceCandidateInit;
}
