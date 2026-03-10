// Microsoft Calendar Integration Types

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: {
    displayName: string;
    address?: {
      street: string;
      city: string;
      postalCode: string;
      countryOrRegion?: string;
    };
  };
  isAllDay: boolean;
  bodyPreview?: string;
  webLink?: string;
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
}

export interface MicrosoftConnection {
  userId: string;
  microsoftAccountEmail: string;
  connectedAt: Date;
  isActive: boolean;
}
