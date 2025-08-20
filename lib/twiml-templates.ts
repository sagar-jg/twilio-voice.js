/**
 * TwiML Templates for WhatsApp Voice Integration
 * These templates handle incoming calls, conferences, and call routing
 */

export const TwiMLTemplates = {
  /**
   * Handle incoming WhatsApp voice calls
   */
  incomingCall: (params: {
    callerId: string;
    clientIdentity?: string;
    customParams?: Record<string, string>;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Welcome to WhatsApp Business Calling</Say>
  <Dial callerId="${params.callerId}">
    <Client>
      <Identity>${params.clientIdentity || 'default-client'}</Identity>
      ${Object.entries(params.customParams || {}).map(([key, value]) => 
        `<Parameter name="${key}" value="${value}" />`
      ).join('\n      ')}
    </Client>
  </Dial>
</Response>`,

  /**
   * Create a conference room for 2-legged calls
   */
  createConference: (params: {
    conferenceName: string;
    moderator?: boolean;
    muted?: boolean;
    waitUrl?: string;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Joining conference room</Say>
  <Dial>
    <Conference 
      startConferenceOnEnter="${params.moderator ? 'true' : 'false}"
      endConferenceOnExit="${params.moderator ? 'true' : 'false'}"
      muted="${params.muted ? 'true' : 'false'}"
      waitUrl="${params.waitUrl || ''}"
      statusCallback="/conference-events"
      statusCallbackEvent="start end join leave mute hold"
      statusCallbackMethod="POST"
    >
      ${params.conferenceName}
    </Conference>
  </Dial>
</Response>`,

  /**
   * Join an existing conference
   */
  joinConference: (params: {
    conferenceName: string;
    muted?: boolean;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting to conference</Say>
  <Dial>
    <Conference 
      muted="${params.muted ? 'true' : 'false'}"
      statusCallback="/conference-events"
      statusCallbackEvent="join leave mute hold"
      statusCallbackMethod="POST"
    >
      ${params.conferenceName}
    </Conference>
  </Dial>
</Response>`,

  /**
   * Forward WhatsApp call to another WhatsApp number
   */
  forwardWhatsAppCall: (params: {
    fromWhatsApp: string;
    toWhatsApp: string;
    timeout?: number;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial 
    callerId="${params.fromWhatsApp}"
    timeout="${params.timeout || 30}"
    action="/call-completed"
    method="POST"
  >
    <WhatsApp>${params.toWhatsApp.replace('whatsapp:', '')}</WhatsApp>
  </Dial>
</Response>`,

  /**
   * Handle call permission request response
   */
  handleCallPermission: (params: {
    permissionGranted: boolean;
    fallbackMessage?: string;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${params.permissionGranted 
    ? '<Say voice="Polly.Joanna">Thank you for granting call permission. You will receive your call shortly.</Say>'
    : `<Say voice="Polly.Joanna">${params.fallbackMessage || 'Call permission was not granted. Thank you.'}</Say>`
  }
</Response>`,

  /**
   * Voicemail handling for missed calls
   */
  voicemail: (params: {
    greetingMessage?: string;
    maxLength?: number;
    transcribe?: boolean;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    ${params.greetingMessage || 'Sorry we missed your call. Please leave a message after the beep.'}
  </Say>
  <Record 
    maxLength="${params.maxLength || 120}"
    transcribe="${params.transcribe ? 'true' : 'false'}"
    action="/voicemail-completed"
    method="POST"
  />
  <Say voice="Polly.Joanna">Thank you for your message. Goodbye.</Say>
</Response>`,

  /**
   * Call queue with wait music
   */
  callQueue: (params: {
    queueName: string;
    waitUrl?: string;
    maxWait?: number;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while we connect you to the next available agent.</Say>
  <Enqueue 
    waitUrl="${params.waitUrl || '/queue-wait'}"
    maxWait="${params.maxWait || 300}"
    action="/queue-completed"
    method="POST"
  >
    ${params.queueName}
  </Enqueue>
</Response>`,

  /**
   * Call recording template
   */
  recordCall: (params: {
    recordingChannels?: 'mono' | 'dual';
    recordingStatusCallback?: string;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call may be recorded for quality assurance purposes.</Say>
  <Dial 
    record="${params.recordingChannels || 'mono'}"
    recordingStatusCallback="${params.recordingStatusCallback || '/recording-completed'}"
    recordingStatusCallbackMethod="POST"
  >
    <Client>default-client</Client>
  </Dial>
</Response>`,

  /**
   * IVR (Interactive Voice Response) menu
   */
  ivrMenu: (params: {
    menuOptions: Array<{
      digit: string;
      action: string;
      description: string;
    }>;
    timeout?: number;
    retries?: number;
  }) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="dtmf" 
    timeout="${params.timeout || 10}"
    numDigits="1"
    action="/ivr-response"
    method="POST"
  >
    <Say voice="Polly.Joanna">
      Please select from the following options:
      ${params.menuOptions.map(option => 
        `Press ${option.digit} for ${option.description}.`
      ).join(' ')}
    </Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, I didn't receive a valid input. Goodbye.</Say>
  <Hangup />
</Response>`
};

/**
 * TwiML Response Builder for dynamic TwiML generation
 */
export class TwiMLBuilder {
  private twiml: string[] = [];

  constructor() {
    this.twiml.push('<?xml version="1.0" encoding="UTF-8"?>');
    this.twiml.push('<Response>');
  }

  say(text: string, options?: {
    voice?: string;
    language?: string;
    loop?: number;
  }): this {
    const attrs = [];
    if (options?.voice) attrs.push(`voice="${options.voice}"`);
    if (options?.language) attrs.push(`language="${options.language}"`);
    if (options?.loop) attrs.push(`loop="${options.loop}"`);
    
    this.twiml.push(`  <Say${attrs.length ? ' ' + attrs.join(' ') : ''}>${text}</Say>`);
    return this;
  }

  dial(options?: {
    callerId?: string;
    timeout?: number;
    action?: string;
    method?: string;
  }): DialBuilder {
    return new DialBuilder(this.twiml, options);
  }

  gather(options?: {
    input?: string;
    timeout?: number;
    numDigits?: number;
    action?: string;
    method?: string;
  }): GatherBuilder {
    return new GatherBuilder(this.twiml, options);
  }

  record(options?: {
    maxLength?: number;
    transcribe?: boolean;
    action?: string;
    method?: string;
  }): this {
    const attrs = [];
    if (options?.maxLength) attrs.push(`maxLength="${options.maxLength}"`);
    if (options?.transcribe) attrs.push(`transcribe="${options.transcribe}"`);
    if (options?.action) attrs.push(`action="${options.action}"`);
    if (options?.method) attrs.push(`method="${options.method}"`);
    
    this.twiml.push(`  <Record${attrs.length ? ' ' + attrs.join(' ') : ''} />`);
    return this;
  }

  hangup(): this {
    this.twiml.push('  <Hangup />');
    return this;
  }

  build(): string {
    this.twiml.push('</Response>');
    return this.twiml.join('\n');
  }
}

export class DialBuilder {
  constructor(
    private twiml: string[],
    private options?: {
      callerId?: string;
      timeout?: number;
      action?: string;
      method?: string;
    }
  ) {}

  whatsapp(number: string): this {
    this.startDial();
    this.twiml.push(`    <WhatsApp>${number.replace('whatsapp:', '')}</WhatsApp>`);
    this.endDial();
    return this;
  }

  client(identity: string, parameters?: Record<string, string>): this {
    this.startDial();
    this.twiml.push(`    <Client>`);
    this.twiml.push(`      <Identity>${identity}</Identity>`);
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        this.twiml.push(`      <Parameter name="${key}" value="${value}" />`);
      });
    }
    this.twiml.push(`    </Client>`);
    this.endDial();
    return this;
  }

  conference(name: string, options?: {
    startConferenceOnEnter?: boolean;
    endConferenceOnExit?: boolean;
    muted?: boolean;
    waitUrl?: string;
  }): this {
    this.startDial();
    const attrs = [];
    if (options?.startConferenceOnEnter !== undefined) {
      attrs.push(`startConferenceOnEnter="${options.startConferenceOnEnter}"`);
    }
    if (options?.endConferenceOnExit !== undefined) {
      attrs.push(`endConferenceOnExit="${options.endConferenceOnExit}"`);
    }
    if (options?.muted !== undefined) {
      attrs.push(`muted="${options.muted}"`);
    }
    if (options?.waitUrl) {
      attrs.push(`waitUrl="${options.waitUrl}"`);
    }
    
    this.twiml.push(`    <Conference${attrs.length ? ' ' + attrs.join(' ') : ''}>${name}</Conference>`);
    this.endDial();
    return this;
  }

  private startDial(): void {
    const attrs = [];
    if (this.options?.callerId) attrs.push(`callerId="${this.options.callerId}"`);
    if (this.options?.timeout) attrs.push(`timeout="${this.options.timeout}"`);
    if (this.options?.action) attrs.push(`action="${this.options.action}"`);
    if (this.options?.method) attrs.push(`method="${this.options.method}"`);
    
    this.twiml.push(`  <Dial${attrs.length ? ' ' + attrs.join(' ') : ''}>`);
  }

  private endDial(): void {
    this.twiml.push(`  </Dial>`);
  }
}

export class GatherBuilder {
  constructor(
    private twiml: string[],
    private options?: {
      input?: string;
      timeout?: number;
      numDigits?: number;
      action?: string;
      method?: string;
    }
  ) {}

  say(text: string, voice?: string): this {
    this.startGather();
    this.twiml.push(`    <Say${voice ? ` voice="${voice}"` : ''}>${text}</Say>`);
    this.endGather();
    return this;
  }

  private startGather(): void {
    const attrs = [];
    if (this.options?.input) attrs.push(`input="${this.options.input}"`);
    if (this.options?.timeout) attrs.push(`timeout="${this.options.timeout}"`);
    if (this.options?.numDigits) attrs.push(`numDigits="${this.options.numDigits}"`);
    if (this.options?.action) attrs.push(`action="${this.options.action}"`);
    if (this.options?.method) attrs.push(`method="${this.options.method}"`);
    
    this.twiml.push(`  <Gather${attrs.length ? ' ' + attrs.join(' ') : ''}>`);
  }

  private endGather(): void {
    this.twiml.push(`  </Gather>`);
  }
}
