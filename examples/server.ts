/**
 * WhatsApp Voice Integration Server Example
 * Node.js/Express server handling WhatsApp voice webhooks and TwiML generation
 */

import express from 'express';
import { TwilioApi } from 'twilio';
import { TwiMLTemplates, TwiMLBuilder } from '../lib/twiml-templates';

const app = express();
const PORT = process.env.PORT || 3000;

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappSender = process.env.WHATSAPP_SENDER; // e.g., "whatsapp:+1234567890"

const client = new TwilioApi(accountSid, authToken);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// In-memory storage for active conferences (use database in production)
const activeConferences = new Map<string, {
  id: string;
  participants: string[];
  moderator?: string;
  createdAt: Date;
}>();

/**
 * Webhook endpoint for incoming WhatsApp voice calls
 */
app.post('/voice/incoming', (req, res) => {
  console.log('Incoming WhatsApp call:', req.body);
  
  const { From, To, CallSid } = req.body;
  
  // Generate TwiML response for incoming call
  const twiml = TwiMLTemplates.incomingCall({
    callerId: whatsappSender!,
    clientIdentity: 'whatsapp-client',
    customParams: {
      original_caller: From,
      call_sid: CallSid,
      call_type: 'whatsapp_voice'
    }
  });

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Webhook endpoint for creating conference calls
 */
app.post('/voice/conference/create', (req, res) => {
  console.log('Creating conference:', req.body);
  
  const { ConferenceName, Moderator } = req.body;
  
  // Store conference details
  activeConferences.set(ConferenceName, {
    id: ConferenceName,
    participants: [],
    moderator: Moderator === 'true' ? req.body.From : undefined,
    createdAt: new Date()
  });

  const twiml = TwiMLTemplates.createConference({
    conferenceName: ConferenceName,
    moderator: Moderator === 'true',
    waitUrl: `/voice/conference/wait?conference=${ConferenceName}`
  });

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Webhook endpoint for joining conference calls
 */
app.post('/voice/conference/join', (req, res) => {
  console.log('Joining conference:', req.body);
  
  const { ConferenceName, From } = req.body;
  
  // Add participant to conference
  const conference = activeConferences.get(ConferenceName);
  if (conference && !conference.participants.includes(From)) {
    conference.participants.push(From);
  }

  const twiml = TwiMLTemplates.joinConference({
    conferenceName: ConferenceName,
    muted: false
  });

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Conference wait music endpoint
 */
app.get('/voice/conference/wait', (req, res) => {
  const twiml = new TwiMLBuilder()
    .say('Please wait while other participants join the conference.')
    .build();

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Conference events webhook
 */
app.post('/conference-events', (req, res) => {
  console.log('Conference event:', req.body);
  
  const { 
    ConferenceSid, 
    FriendlyName, 
    StatusCallbackEvent, 
    ParticipantCallSid,
    Coaching,
    Hold,
    Muted
  } = req.body;

  // Handle different conference events
  switch (StatusCallbackEvent) {
    case 'conference-start':
      console.log(`Conference ${FriendlyName} started`);
      break;
    case 'conference-end':
      console.log(`Conference ${FriendlyName} ended`);
      activeConferences.delete(FriendlyName);
      break;
    case 'participant-join':
      console.log(`Participant joined conference ${FriendlyName}`);
      break;
    case 'participant-leave':
      console.log(`Participant left conference ${FriendlyName}`);
      break;
    case 'participant-mute':
      console.log(`Participant muted in conference ${FriendlyName}`);
      break;
    case 'participant-unmute':
      console.log(`Participant unmuted in conference ${FriendlyName}`);
      break;
  }

  res.sendStatus(200);
});

/**
 * API endpoint to initiate outbound WhatsApp call
 */
app.post('/api/call/outbound', async (req, res) => {
  try {
    const { to, message, customParams } = req.body;

    // Validate WhatsApp number format
    if (!to.startsWith('whatsapp:')) {
      return res.status(400).json({ 
        error: 'Invalid WhatsApp number format. Must start with "whatsapp:"' 
      });
    }

    // Create call using Twilio API
    const call = await client.calls.create({
      from: whatsappSender,
      to: to,
      url: `${req.protocol}://${req.get('host')}/voice/outbound-twiml`,
      method: 'POST',
      statusCallback: `${req.protocol}://${req.get('host')}/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    res.json({
      success: true,
      callSid: call.sid,
      message: 'WhatsApp call initiated successfully'
    });

  } catch (error) {
    console.error('Error making outbound call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate WhatsApp call'
    });
  }
});

/**
 * API endpoint to create a 2-legged conference
 */
app.post('/api/conference/create', async (req, res) => {
  try {
    const { 
      conferenceId, 
      participants, 
      moderator = false 
    } = req.body;

    if (!conferenceId || !participants || participants.length < 2) {
      return res.status(400).json({
        error: 'Conference ID and at least 2 participants required'
      });
    }

    // Validate all participants are WhatsApp numbers
    const invalidNumbers = participants.filter((num: string) => !num.startsWith('whatsapp:'));
    if (invalidNumbers.length > 0) {
      return res.status(400).json({
        error: `Invalid WhatsApp numbers: ${invalidNumbers.join(', ')}`
      });
    }

    // Create conference room by calling the first participant (moderator)
    const moderatorCall = await client.calls.create({
      from: whatsappSender,
      to: participants[0],
      url: `${req.protocol}://${req.get('host')}/voice/conference/create`,
      method: 'POST',
      statusCallback: `${req.protocol}://${req.get('host')}/call-status`,
      statusCallbackMethod: 'POST'
    });

    // Add other participants to conference
    const participantCalls = [];
    for (let i = 1; i < participants.length; i++) {
      const call = await client.calls.create({
        from: whatsappSender,
        to: participants[i],
        url: `${req.protocol}://${req.get('host')}/voice/conference/join`,
        method: 'POST',
        statusCallback: `${req.protocol}://${req.get('host')}/call-status`,
        statusCallbackMethod: 'POST'
      });
      participantCalls.push(call);
    }

    res.json({
      success: true,
      conferenceId,
      moderatorCallSid: moderatorCall.sid,
      participantCallSids: participantCalls.map(call => call.sid),
      message: 'Conference created successfully'
    });

  } catch (error) {
    console.error('Error creating conference:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conference'
    });
  }
});

/**
 * API endpoint to add participant to existing conference
 */
app.post('/api/conference/:conferenceId/add-participant', async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { participant } = req.body;

    if (!participant.startsWith('whatsapp:')) {
      return res.status(400).json({
        error: 'Invalid WhatsApp number format'
      });
    }

    const conference = activeConferences.get(conferenceId);
    if (!conference) {
      return res.status(404).json({
        error: 'Conference not found'
      });
    }

    // Add participant to conference
    const call = await client.calls.create({
      from: whatsappSender,
      to: participant,
      url: `${req.protocol}://${req.get('host')}/voice/conference/join`,
      method: 'POST',
      statusCallback: `${req.protocol}://${req.get('host')}/call-status`,
      statusCallbackMethod: 'POST'
    });

    res.json({
      success: true,
      callSid: call.sid,
      message: 'Participant added to conference'
    });

  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add participant to conference'
    });
  }
});

/**
 * Call status webhook
 */
app.post('/call-status', (req, res) => {
  console.log('Call status update:', req.body);
  
  const { CallSid, CallStatus, From, To } = req.body;
  
  // Handle different call statuses
  switch (CallStatus) {
    case 'initiated':
      console.log(`Call ${CallSid} initiated from ${From} to ${To}`);
      break;
    case 'ringing':
      console.log(`Call ${CallSid} is ringing`);
      break;
    case 'answered':
      console.log(`Call ${CallSid} was answered`);
      break;
    case 'completed':
      console.log(`Call ${CallSid} completed`);
      break;
    case 'failed':
      console.log(`Call ${CallSid} failed`);
      break;
    case 'busy':
      console.log(`Call ${CallSid} was busy`);
      break;
    case 'no-answer':
      console.log(`Call ${CallSid} was not answered`);
      break;
  }

  res.sendStatus(200);
});

/**
 * TwiML for outbound calls
 */
app.post('/voice/outbound-twiml', (req, res) => {
  const twiml = new TwiMLBuilder()
    .say('Hello, this is a WhatsApp Business call. Please hold while we connect you.')
    .dial({ callerId: whatsappSender })
    .client('whatsapp-client', {
      caller: req.body.From,
      call_type: 'outbound_whatsapp'
    })
    .build();

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Get active conferences
 */
app.get('/api/conferences', (req, res) => {
  const conferences = Array.from(activeConferences.values());
  res.json({ conferences });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeConferences: activeConferences.size
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`WhatsApp Voice Server running on port ${PORT}`);
  console.log(`WhatsApp Sender: ${whatsappSender}`);
});

export default app;
