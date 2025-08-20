/**
 * WhatsApp Voice Integration Client Example
 * Frontend implementation using the WhatsApp Voice wrapper
 */

import { WhatsAppVoice, WhatsAppVoiceUtils, ConferenceSession } from '../lib/whatsapp-voice';
import { Call } from '../lib/twilio';

class WhatsAppVoiceClient {
  private whatsappVoice: WhatsAppVoice;
  private currentCall?: Call;
  private currentConference?: ConferenceSession;

  constructor() {
    // Initialize UI elements
    this.initializeUI();
  }

  /**
   * Initialize the WhatsApp Voice client with access token
   */
  async initialize(accessToken: string, whatsappSender: string): Promise<void> {
    try {
      // Create WhatsApp Voice instance
      this.whatsappVoice = new WhatsAppVoice(accessToken, {
        whatsappSender: whatsappSender,
        enableConference: true,
        maxConcurrentCalls: 5,
        sounds: {
          incoming: '/sounds/incoming.mp3',
          outgoing: '/sounds/outgoing.mp3',
          disconnect: '/sounds/disconnect.mp3'
        },
        // Enable debug logging
        logLevel: 'debug'
      });

      // Initialize the device
      await this.whatsappVoice.initialize();

      console.log('WhatsApp Voice client initialized successfully');
      this.updateStatus('Ready for WhatsApp calls');
      this.enableCallControls();

    } catch (error) {
      console.error('Failed to initialize WhatsApp Voice client:', error);
      this.updateStatus('Failed to initialize - check credentials');
    }
  }

  /**
   * Make an outbound WhatsApp call
   */
  async makeCall(phoneNumber: string): Promise<void> {
    try {
      // Format and validate WhatsApp number
      const whatsappNumber = WhatsAppVoiceUtils.formatWhatsAppNumber(phoneNumber);
      
      if (!WhatsAppVoiceUtils.isValidWhatsAppNumber(whatsappNumber)) {
        throw new Error('Invalid WhatsApp number format');
      }

      this.updateStatus(`Calling ${whatsappNumber}...`);
      
      // Make the call
      this.currentCall = await this.whatsappVoice.makeCall({
        to: whatsappNumber,
        customParameters: {
          caller_name: 'Business Assistant',
          call_reason: 'customer_support'
        }
      });

      this.setupCallEventHandlers(this.currentCall);
      this.updateCallUI('calling');

    } catch (error) {
      console.error('Failed to make call:', error);
      this.updateStatus(`Call failed: ${error.message}`);
    }
  }

  /**
   * Create a 2-legged conference call
   */
  async createConference(participants: string[]): Promise<void> {
    try {
      // Validate all participants
      const validParticipants = participants.map(num => {
        const whatsappNum = WhatsAppVoiceUtils.formatWhatsAppNumber(num);
        if (!WhatsAppVoiceUtils.isValidWhatsAppNumber(whatsappNum)) {
          throw new Error(`Invalid WhatsApp number: ${num}`);
        }
        return whatsappNum;
      });

      if (validParticipants.length < 2) {
        throw new Error('At least 2 participants required for conference');
      }

      const conferenceId = `conf_${Date.now()}`;
      this.updateStatus(`Creating conference with ${validParticipants.length} participants...`);

      // Create conference
      this.currentConference = await this.whatsappVoice.createConference({
        conferenceId,
        participants: validParticipants,
        moderator: true,
        muted: false
      });

      this.setupConferenceEventHandlers(this.currentConference);
      this.updateConferenceUI('active', validParticipants);

    } catch (error) {
      console.error('Failed to create conference:', error);
      this.updateStatus(`Conference creation failed: ${error.message}`);
    }
  }

  /**
   * Answer incoming call
   */
  answerCall(): void {
    if (this.currentCall) {
      this.currentCall.accept();
      this.updateCallUI('active');
    }
  }

  /**
   * Reject incoming call
   */
  rejectCall(): void {
    if (this.currentCall) {
      this.currentCall.reject();
      this.updateCallUI('idle');
    }
  }

  /**
   * Hang up active call
   */
  hangupCall(): void {
    if (this.currentCall) {
      this.currentCall.disconnect();
      this.updateCallUI('idle');
    }
  }

  /**
   * Mute/unmute current call
   */
  toggleMute(): void {
    if (this.currentCall) {
      const isMuted = this.currentCall.isMuted();
      this.currentCall.mute(!isMuted);
      this.updateMuteButton(!isMuted);
    }
  }

  /**
   * End current conference
   */
  async endConference(): Promise<void> {
    if (this.currentConference) {
      await this.whatsappVoice.endConference(this.currentConference.conferenceId);
      this.currentConference = undefined;
      this.updateConferenceUI('idle', []);
    }
  }

  /**
   * Add participant to current conference
   */
  async addParticipant(phoneNumber: string): Promise<void> {
    if (!this.currentConference) {
      throw new Error('No active conference');
    }

    const whatsappNumber = WhatsAppVoiceUtils.formatWhatsAppNumber(phoneNumber);
    if (!WhatsAppVoiceUtils.isValidWhatsAppNumber(whatsappNumber)) {
      throw new Error('Invalid WhatsApp number format');
    }

    await this.currentConference.addParticipant(whatsappNumber);
    this.updateStatus(`Added ${whatsappNumber} to conference`);
  }

  /**
   * Set up call event handlers
   */
  private setupCallEventHandlers(call: Call): void {
    call.on('accept', () => {
      console.log('Call accepted');
      this.updateStatus('Call connected');
      this.updateCallUI('active');
    });

    call.on('disconnect', () => {
      console.log('Call disconnected');
      this.updateStatus('Call ended');
      this.updateCallUI('idle');
      this.currentCall = undefined;
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      this.updateStatus(`Call error: ${error.message}`);
      this.updateCallUI('idle');
      this.currentCall = undefined;
    });

    call.on('mute', (isMuted) => {
      this.updateMuteButton(isMuted);
    });

    call.on('volume', (inputVolume, outputVolume) => {
      this.updateVolumeIndicators(inputVolume, outputVolume);
    });
  }

  /**
   * Set up conference event handlers
   */
  private setupConferenceEventHandlers(conference: ConferenceSession): void {
    // Conference events would be handled through WebSocket or polling
    // This is a simplified example
    console.log('Conference event handlers set up');
  }

  /**
   * Initialize UI elements and event listeners
   */
  private initializeUI(): void {
    // Phone number input
    const phoneInput = document.getElementById('phone-input') as HTMLInputElement;
    const callButton = document.getElementById('call-button') as HTMLButtonElement;
    const hangupButton = document.getElementById('hangup-button') as HTMLButtonElement;
    const muteButton = document.getElementById('mute-button') as HTMLButtonElement;

    // Conference controls
    const conferenceButton = document.getElementById('conference-button') as HTMLButtonElement;
    const addParticipantButton = document.getElementById('add-participant-button') as HTMLButtonElement;
    const endConferenceButton = document.getElementById('end-conference-button') as HTMLButtonElement;

    // Incoming call controls
    const answerButton = document.getElementById('answer-button') as HTMLButtonElement;
    const rejectButton = document.getElementById('reject-button') as HTMLButtonElement;

    // Event listeners
    callButton?.addEventListener('click', () => {
      const phoneNumber = phoneInput?.value.trim();
      if (phoneNumber) {
        this.makeCall(phoneNumber);
      }
    });

    hangupButton?.addEventListener('click', () => {
      this.hangupCall();
    });

    muteButton?.addEventListener('click', () => {
      this.toggleMute();
    });

    answerButton?.addEventListener('click', () => {
      this.answerCall();
    });

    rejectButton?.addEventListener('click', () => {
      this.rejectCall();
    });

    conferenceButton?.addEventListener('click', () => {
      const participantsInput = document.getElementById('participants-input') as HTMLTextAreaElement;
      const participants = participantsInput?.value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0) || [];
      
      if (participants.length >= 2) {
        this.createConference(participants);
      }
    });

    addParticipantButton?.addEventListener('click', () => {
      const newParticipantInput = document.getElementById('new-participant-input') as HTMLInputElement;
      const phoneNumber = newParticipantInput?.value.trim();
      if (phoneNumber) {
        this.addParticipant(phoneNumber);
        newParticipantInput.value = '';
      }
    });

    endConferenceButton?.addEventListener('click', () => {
      this.endConference();
    });

    // Phone number formatting
    phoneInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      let value = target.value.replace(/\D/g, '');
      
      if (value.length > 0 && !value.startsWith('1')) {
        value = '1' + value;
      }
      
      // Format as +1 (XXX) XXX-XXXX
      if (value.length >= 11) {
        value = value.substring(0, 11);
        target.value = `+${value.substring(0, 1)} (${value.substring(1, 4)}) ${value.substring(4, 7)}-${value.substring(7)}`;
      }
    });
  }

  /**
   * Update status display
   */
  private updateStatus(message: string): void {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      console.log('Status:', message);
    }
  }

  /**
   * Update call UI state
   */
  private updateCallUI(state: 'idle' | 'calling' | 'incoming' | 'active'): void {
    const callButton = document.getElementById('call-button') as HTMLButtonElement;
    const hangupButton = document.getElementById('hangup-button') as HTMLButtonElement;
    const muteButton = document.getElementById('mute-button') as HTMLButtonElement;
    const answerButton = document.getElementById('answer-button') as HTMLButtonElement;
    const rejectButton = document.getElementById('reject-button') as HTMLButtonElement;
    const incomingCallDiv = document.getElementById('incoming-call');

    // Hide all initially
    [hangupButton, muteButton, answerButton, rejectButton].forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
    if (incomingCallDiv) incomingCallDiv.style.display = 'none';

    switch (state) {
      case 'idle':
        if (callButton) {
          callButton.disabled = false;
          callButton.textContent = 'Call';
        }
        break;
      case 'calling':
        if (callButton) {
          callButton.disabled = true;
          callButton.textContent = 'Calling...';
        }
        if (hangupButton) hangupButton.style.display = 'inline-block';
        break;
      case 'incoming':
        if (incomingCallDiv) incomingCallDiv.style.display = 'block';
        if (answerButton) answerButton.style.display = 'inline-block';
        if (rejectButton) rejectButton.style.display = 'inline-block';
        break;
      case 'active':
        if (callButton) {
          callButton.disabled = true;
          callButton.textContent = 'In Call';
        }
        if (hangupButton) hangupButton.style.display = 'inline-block';
        if (muteButton) muteButton.style.display = 'inline-block';
        break;
    }
  }

  /**
   * Update conference UI
   */
  private updateConferenceUI(state: 'idle' | 'active', participants: string[]): void {
    const conferenceStatus = document.getElementById('conference-status');
    const participantsList = document.getElementById('participants-list');
    const endConferenceButton = document.getElementById('end-conference-button');

    if (state === 'active') {
      if (conferenceStatus) {
        conferenceStatus.textContent = `Conference active with ${participants.length} participants`;
      }
      if (participantsList) {
        participantsList.innerHTML = participants
          .map(p => `<li>${WhatsAppVoiceUtils.extractPhoneNumber(p)}</li>`)
          .join('');
      }
      if (endConferenceButton) {
        endConferenceButton.style.display = 'inline-block';
      }
    } else {
      if (conferenceStatus) {
        conferenceStatus.textContent = 'No active conference';
      }
      if (participantsList) {
        participantsList.innerHTML = '';
      }
      if (endConferenceButton) {
        endConferenceButton.style.display = 'none';
      }
    }
  }

  /**
   * Update mute button state
   */
  private updateMuteButton(isMuted: boolean): void {
    const muteButton = document.getElementById('mute-button') as HTMLButtonElement;
    if (muteButton) {
      muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
      muteButton.classList.toggle('muted', isMuted);
    }
  }

  /**
   * Update volume indicators
   */
  private updateVolumeIndicators(inputVolume: number, outputVolume: number): void {
    const inputVolumeBar = document.getElementById('input-volume-bar');
    const outputVolumeBar = document.getElementById('output-volume-bar');

    if (inputVolumeBar) {
      inputVolumeBar.style.width = `${inputVolume * 100}%`;
    }
    if (outputVolumeBar) {
      outputVolumeBar.style.width = `${outputVolume * 100}%`;
    }
  }

  /**
   * Enable call controls
   */
  private enableCallControls(): void {
    const callButton = document.getElementById('call-button') as HTMLButtonElement;
    const conferenceButton = document.getElementById('conference-button') as HTMLButtonElement;

    if (callButton) callButton.disabled = false;
    if (conferenceButton) conferenceButton.disabled = false;
  }

  /**
   * Get call statistics
   */
  getCallStatistics(): any {
    if (this.currentCall) {
      return {
        callSid: this.currentCall.parameters.CallSid,
        status: this.currentCall.status(),
        isMuted: this.currentCall.isMuted(),
        // Add more statistics as needed
      };
    }
    return null;
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy(): void {
    if (this.whatsappVoice) {
      this.whatsappVoice.destroy();
    }
    this.currentCall = undefined;
    this.currentConference = undefined;
  }
}

// Initialize the client when the page loads
let whatsappClient: WhatsAppVoiceClient;

document.addEventListener('DOMContentLoaded', () => {
  whatsappClient = new WhatsAppVoiceClient();

  // Get access token from your backend
  const initializeButton = document.getElementById('initialize-button');
  if (initializeButton) {
    initializeButton.addEventListener('click', async () => {
      try {
        // Fetch access token from your backend
        const response = await fetch('/api/access-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identity: 'whatsapp-client-' + Date.now()
          })
        });

        const data = await response.json();
        if (data.token && data.whatsappSender) {
          await whatsappClient.initialize(data.token, data.whatsappSender);
        } else {
          throw new Error('Failed to get access token');
        }
      } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize WhatsApp Voice client');
      }
    });
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (whatsappClient) {
    whatsappClient.destroy();
  }
});

export { WhatsAppVoiceClient };
