/**
 * WhatsApp Voice Integration Wrapper for Twilio Voice SDK
 * Integrates WhatsApp Business Calling with WebRTC functionality
 */

import { Device, Call, DeviceOptions } from './twilio';
import { TwilioError } from './twilio/errors';

export interface WhatsAppVoiceConfig extends DeviceOptions {
  whatsappSender: string; // WhatsApp sender number (e.g., "whatsapp:+1234567890")
  enableConference?: boolean;
  maxConcurrentCalls?: number;
}

export interface WhatsAppCallOptions {
  to: string; // WhatsApp number (e.g., "whatsapp:+1234567890")
  from?: string; // WhatsApp sender (optional, uses default if not provided)
  customParameters?: Record<string, string>;
}

export interface ConferenceOptions {
  conferenceId: string;
  participants: string[];
  moderator?: boolean;
  muted?: boolean;
  hold?: boolean;
}

export class WhatsAppVoice {
  private device: Device;
  private config: WhatsAppVoiceConfig;
  private activeCalls: Map<string, Call> = new Map();
  private activeConferences: Map<string, ConferenceSession> = new Map();

  constructor(token: string, config: WhatsAppVoiceConfig) {
    this.config = config;
    this.device = new Device(token, {
      ...config,
      sounds: {
        ...config.sounds,
        incoming: config.sounds?.incoming,
        outgoing: config.sounds?.outgoing,
        disconnect: config.sounds?.disconnect,
      },
    });

    this.setupEventListeners();
  }

  /**
   * Initialize the WhatsApp Voice device
   */
  async initialize(): Promise<void> {
    try {
      await this.device.register();
      console.log('WhatsApp Voice device registered successfully');
    } catch (error) {
      console.error('Failed to register WhatsApp Voice device:', error);
      throw error;
    }
  }

  /**
   * Make an outbound WhatsApp voice call
   */
  async makeCall(options: WhatsAppCallOptions): Promise<Call> {
    try {
      // Validate WhatsApp number format
      if (!options.to.startsWith('whatsapp:')) {
        throw new Error('Invalid WhatsApp number format. Must start with "whatsapp:"');
      }

      const callOptions = {
        params: {
          To: options.to,
          From: options.from || this.config.whatsappSender,
          ...options.customParameters,
        },
      };

      const call = await this.device.connect(callOptions);
      this.activeCalls.set(call.parameters.CallSid, call);

      return call;
    } catch (error) {
      console.error('Failed to make WhatsApp call:', error);
      throw error;
    }
  }

  /**
   * Create or join a 2-legged conference call
   */
  async createConference(options: ConferenceOptions): Promise<ConferenceSession> {
    try {
      const conference = new ConferenceSession(
        options.conferenceId,
        this.device,
        this.config.whatsappSender
      );

      // Initialize the conference
      await conference.initialize(options);
      this.activeConferences.set(options.conferenceId, conference);

      return conference;
    } catch (error) {
      console.error('Failed to create conference:', error);
      throw error;
    }
  }

  /**
   * Join an existing conference
   */
  async joinConference(conferenceId: string, participant: string): Promise<void> {
    const conference = this.activeConferences.get(conferenceId);
    if (!conference) {
      throw new Error(`Conference ${conferenceId} not found`);
    }

    await conference.addParticipant(participant);
  }

  /**
   * End a conference call
   */
  async endConference(conferenceId: string): Promise<void> {
    const conference = this.activeConferences.get(conferenceId);
    if (conference) {
      await conference.end();
      this.activeConferences.delete(conferenceId);
    }
  }

  /**
   * Get active calls
   */
  getActiveCalls(): Call[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get active conferences
   */
  getActiveConferences(): ConferenceSession[] {
    return Array.from(this.activeConferences.values());
  }

  /**
   * Disconnect a specific call
   */
  async disconnectCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (call) {
      call.disconnect();
      this.activeCalls.delete(callSid);
    }
  }

  /**
   * Destroy the device and clean up resources
   */
  destroy(): void {
    // End all active calls
    this.activeCalls.forEach(call => call.disconnect());
    this.activeCalls.clear();

    // End all active conferences
    this.activeConferences.forEach(conference => conference.end());
    this.activeConferences.clear();

    // Destroy the device
    if (this.device) {
      this.device.destroy();
    }
  }

  private setupEventListeners(): void {
    // Handle incoming WhatsApp calls
    this.device.on('incoming', (call: Call) => {
      console.log('Incoming WhatsApp call from:', call.parameters.From);
      this.activeCalls.set(call.parameters.CallSid, call);
      
      // Handle call events
      call.on('accept', () => {
        console.log('WhatsApp call accepted:', call.parameters.CallSid);
      });

      call.on('disconnect', () => {
        console.log('WhatsApp call disconnected:', call.parameters.CallSid);
        this.activeCalls.delete(call.parameters.CallSid);
      });

      call.on('error', (error: TwilioError) => {
        console.error('WhatsApp call error:', error);
        this.activeCalls.delete(call.parameters.CallSid);
      });
    });

    // Handle device events
    this.device.on('ready', () => {
      console.log('WhatsApp Voice device is ready');
    });

    this.device.on('error', (error: TwilioError) => {
      console.error('WhatsApp Voice device error:', error);
    });

    this.device.on('offline', () => {
      console.log('WhatsApp Voice device went offline');
    });
  }
}

/**
 * Conference Session class for managing 2-legged conference calls
 */
export class ConferenceSession {
  private conferenceId: string;
  private device: Device;
  private whatsappSender: string;
  private participants: Map<string, Call> = new Map();
  private conferenceCall?: Call;

  constructor(conferenceId: string, device: Device, whatsappSender: string) {
    this.conferenceId = conferenceId;
    this.device = device;
    this.whatsappSender = whatsappSender;
  }

  async initialize(options: ConferenceOptions): Promise<void> {
    try {
      // Create the conference room by making a call to the conference endpoint
      const conferenceCallOptions = {
        params: {
          ConferenceName: this.conferenceId,
          From: this.whatsappSender,
          Action: 'create_conference',
          Moderator: options.moderator ? 'true' : 'false',
        },
      };

      this.conferenceCall = await this.device.connect(conferenceCallOptions);

      // Add initial participants
      for (const participant of options.participants) {
        await this.addParticipant(participant);
      }
    } catch (error) {
      console.error('Failed to initialize conference:', error);
      throw error;
    }
  }

  async addParticipant(whatsappNumber: string): Promise<void> {
    try {
      if (!whatsappNumber.startsWith('whatsapp:')) {
        throw new Error('Invalid WhatsApp number format. Must start with "whatsapp:"');
      }

      const participantCallOptions = {
        params: {
          To: whatsappNumber,
          From: this.whatsappSender,
          ConferenceName: this.conferenceId,
          Action: 'join_conference',
        },
      };

      const participantCall = await this.device.connect(participantCallOptions);
      this.participants.set(whatsappNumber, participantCall);

      console.log(`Added participant ${whatsappNumber} to conference ${this.conferenceId}`);
    } catch (error) {
      console.error(`Failed to add participant ${whatsappNumber}:`, error);
      throw error;
    }
  }

  async removeParticipant(whatsappNumber: string): Promise<void> {
    const call = this.participants.get(whatsappNumber);
    if (call) {
      call.disconnect();
      this.participants.delete(whatsappNumber);
      console.log(`Removed participant ${whatsappNumber} from conference ${this.conferenceId}`);
    }
  }

  async muteParticipant(whatsappNumber: string): Promise<void> {
    const call = this.participants.get(whatsappNumber);
    if (call) {
      call.mute();
      console.log(`Muted participant ${whatsappNumber} in conference ${this.conferenceId}`);
    }
  }

  async unmuteParticipant(whatsappNumber: string): Promise<void> {
    const call = this.participants.get(whatsappNumber);
    if (call) {
      call.mute(false);
      console.log(`Unmuted participant ${whatsappNumber} in conference ${this.conferenceId}`);
    }
  }

  getParticipants(): string[] {
    return Array.from(this.participants.keys());
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  async end(): Promise<void> {
    // Disconnect all participants
    for (const [number, call] of this.participants) {
      call.disconnect();
    }
    this.participants.clear();

    // End the conference call
    if (this.conferenceCall) {
      this.conferenceCall.disconnect();
    }

    console.log(`Conference ${this.conferenceId} ended`);
  }
}

// Export utility functions
export const WhatsAppVoiceUtils = {
  /**
   * Format a phone number for WhatsApp calling
   */
  formatWhatsAppNumber: (phoneNumber: string): string => {
    // Remove any existing whatsapp: prefix
    const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
    
    // Ensure the number starts with +
    const formattedNumber = cleanNumber.startsWith('+') ? cleanNumber : `+${cleanNumber}`;
    
    return `whatsapp:${formattedNumber}`;
  },

  /**
   * Validate WhatsApp number format
   */
  isValidWhatsAppNumber: (number: string): boolean => {
    const whatsappRegex = /^whatsapp:\+[1-9]\d{1,14}$/;
    return whatsappRegex.test(number);
  },

  /**
   * Extract phone number from WhatsApp format
   */
  extractPhoneNumber: (whatsappNumber: string): string => {
    return whatsappNumber.replace(/^whatsapp:/, '');
  },
};
