# WhatsApp Business Calling Integration with Twilio Voice.js SDK

This repository contains a complete integration solution for **Twilio WhatsApp Business Calling** with **WebRTC** functionality, including support for **2-legged conference calls**.

## 🚀 Features

- ✅ **Incoming WhatsApp Voice Calls**: Handle calls initiated by WhatsApp users
- ✅ **Outgoing WhatsApp Voice Calls**: Initiate calls to WhatsApp users from your application
- ✅ **2-Legged Conference Calls**: Create conference calls with multiple WhatsApp participants
- ✅ **WebRTC Integration**: Full WebRTC support with audio quality controls
- ✅ **Call Management**: Mute, hold, transfer, and recording capabilities
- ✅ **Event Handling**: Comprehensive call and conference event management
- ✅ **Permission Management**: Handle WhatsApp call permission requests
- ✅ **TwiML Templates**: Pre-built templates for common call scenarios

## 📋 Prerequisites

### 1. WhatsApp Business Account Setup
- Active [Twilio Account](https://www.twilio.com) with WhatsApp Business API access
- [WhatsApp Business Platform](https://www.twilio.com/docs/whatsapp) configured
- WhatsApp sender number registered and approved
- Business verification completed in [WhatsApp Business Manager](https://business.facebook.com/latest/whatsapp_manager/overview/)

### 2. Twilio Configuration Requirements
- Twilio Account SID and Auth Token
- TwiML Application SID for Voice handling
- WhatsApp sender configured for voice calls
- Webhook endpoints configured for call events

### 3. Technical Requirements
- Node.js 16+ and npm/yarn
- HTTPS endpoints for webhook handling (ngrok for development)
- Modern browser with WebRTC support

## 🛠 Installation and Setup

### Step 1: Clone and Install

```bash
# Clone this repository
git clone https://github.com/sagar-jg/twilio-voice.js.git
cd twilio-voice.js

# Install dependencies
npm install

# Build the SDK with WhatsApp integration
npm run build
```

### Step 2: Environment Configuration

Create a `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
WHATSAPP_SENDER=whatsapp:+1234567890

# Application Configuration
PORT=3000
BASE_URL=https://your-domain.ngrok.io

# TwiML Application
TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Configure WhatsApp Sender for Voice

**Option A: Using Twilio Console**
1. Go to Twilio Console > Messaging > Senders
2. Select your WhatsApp sender
3. In "Voice Configuration" section, select your TwiML Application

**Option B: Using API**
```bash
curl -X POST https://messaging.twilio.com/v2/Channels/Senders/XExxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
-H "Content-Type: application/json; charset=utf-8" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
-d '{
  "configuration": {
    "voice_application_sid": "APxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}'
```

### Step 4: Create TwiML Application

1. **Create TwiML Application:**
   - Go to Twilio Console > Voice > Manage > TwiML Apps
   - Click "Create a new TwiML App"
   - Set friendly name: "WhatsApp Voice Integration"
   - Set Voice Request URL: `https://your-domain.ngrok.io/voice/incoming`
   - Save and copy the Application SID

2. **Configure Webhook URLs:**
   ```
   Voice Request URL: https://your-domain.ngrok.io/voice/incoming
   Voice Status Callback URL: https://your-domain.ngrok.io/call-status
   ```

## 🔧 Implementation

### Server-Side Implementation

```typescript
import express from 'express';
import { TwilioApi } from 'twilio';
import { TwiMLTemplates } from './lib/twiml-templates';

const app = express();
const client = new TwilioApi(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Handle incoming WhatsApp voice calls
app.post('/voice/incoming', (req, res) => {
  const { From, To, CallSid } = req.body;
  
  const twiml = TwiMLTemplates.incomingCall({
    callerId: process.env.WHATSAPP_SENDER!,
    clientIdentity: 'whatsapp-client',
    customParams: {
      original_caller: From,
      call_sid: CallSid
    }
  });

  res.type('text/xml');
  res.send(twiml);
});

// API endpoint for outbound calls
app.post('/api/call/outbound', async (req, res) => {
  const { to } = req.body;
  
  const call = await client.calls.create({
    from: process.env.WHATSAPP_SENDER,
    to: to, // whatsapp:+1234567890 format
    url: `${process.env.BASE_URL}/voice/outbound-twiml`
  });

  res.json({ callSid: call.sid });
});

app.listen(3000);
```

### Client-Side Implementation

```typescript
import { WhatsAppVoice, WhatsAppVoiceUtils } from './lib/whatsapp-voice';

class WhatsAppVoiceApp {
  private whatsappVoice: WhatsAppVoice;

  async initialize(accessToken: string) {
    this.whatsappVoice = new WhatsAppVoice(accessToken, {
      whatsappSender: 'whatsapp:+1234567890',
      enableConference: true
    });

    await this.whatsappVoice.initialize();
  }

  async makeCall(phoneNumber: string) {
    const whatsappNumber = WhatsAppVoiceUtils.formatWhatsAppNumber(phoneNumber);
    
    const call = await this.whatsappVoice.makeCall({
      to: whatsappNumber,
      customParameters: {
        call_type: 'customer_support'
      }
    });

    return call;
  }

  async createConference(participants: string[]) {
    const conference = await this.whatsappVoice.createConference({
      conferenceId: `conf_${Date.now()}`,
      participants: participants.map(p => WhatsAppVoiceUtils.formatWhatsAppNumber(p)),
      moderator: true
    });

    return conference;
  }
}
```

## 📞 Usage Examples

### 1. Making Outbound WhatsApp Calls

```typescript
// Format phone number for WhatsApp
const whatsappNumber = WhatsAppVoiceUtils.formatWhatsAppNumber('+1234567890');

// Make the call
const call = await whatsappVoice.makeCall({
  to: whatsappNumber,
  customParameters: {
    caller_name: 'Support Agent',
    department: 'customer_service'
  }
});

// Handle call events
call.on('accept', () => console.log('Call answered'));
call.on('disconnect', () => console.log('Call ended'));
```

### 2. Creating 2-Legged Conference Calls

```typescript
// Create conference with multiple participants
const conference = await whatsappVoice.createConference({
  conferenceId: 'support_conference_123',
  participants: [
    'whatsapp:+1234567890',  // Customer
    'whatsapp:+0987654321'   // Agent
  ],
  moderator: true
});

// Add another participant later
await conference.addParticipant('whatsapp:+1122334455');

// Manage participants
await conference.muteParticipant('whatsapp:+1234567890');
await conference.removeParticipant('whatsapp:+0987654321');
```

### 3. Handling Incoming Calls

```typescript
// Device automatically handles incoming calls
whatsappVoice.device.on('incoming', (call) => {
  console.log('Incoming call from:', call.parameters.From);
  
  // Auto-answer or show UI for user to accept/reject
  call.accept();
  
  // Or reject the call
  // call.reject();
});
```

### 4. Call Permission Management

```typescript
// Send call permission request
await fetch('/api/call-permission/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'whatsapp:+1234567890',
    message: 'Can we call you to discuss your inquiry?'
  })
});

// Handle permission response webhook
app.post('/call-permission/response', (req, res) => {
  const { ButtonPayload, From } = req.body;
  
  if (ButtonPayload === 'ACCEPTED') {
    // Permission granted, make the call
    console.log(`Call permission granted by ${From}`);
  } else {
    // Permission denied
    console.log(`Call permission denied by ${From}`);
  }
});
```

## 🏗 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │     Twilio      │    │   Your App      │
│   Consumer      │◄──►│   Platform      │◄──►│   Server        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │                        ▼                        │
        │              ┌─────────────────┐                │
        │              │   TwiML Apps    │                │
        │              │   & Webhooks    │                │
        │              └─────────────────┘                │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Twilio Voice  │    │   Frontend      │
│   Client App    │◄──►│   WebRTC        │◄──►│   Client        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📡 Webhook Endpoints

Your application needs to implement these webhook endpoints:

### Required Webhooks
- `POST /voice/incoming` - Handle incoming WhatsApp calls
- `POST /call-status` - Call status updates
- `POST /conference-events` - Conference event notifications

### Optional Webhooks
- `POST /call-permission/response` - Call permission responses
- `POST /recording-completed` - Call recording completion
- `POST /voicemail-completed` - Voicemail completion

## 🔒 Security and Best Practices

### 1. Webhook Security
```typescript
import { validateRequest } from 'twilio';

app.use('/webhooks', (req, res, next) => {
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  if (validateRequest(authToken, signature, url, req.body)) {
    next();
  } else {
    res.status(403).send('Forbidden');
  }
});
```

### 2. Access Token Management
```typescript
// Generate access tokens with appropriate grants
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

function generateAccessToken(identity: string) {
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWIML_APP_SID,
    incomingAllow: true,
  });

  const token = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, {
    identity: identity,
    ttl: 3600 // 1 hour
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}
```

### 3. Rate Limiting
- Implement rate limiting for webhook endpoints
- Monitor call volume and implement safeguards
- Use Twilio's built-in retry mechanisms appropriately

## 🧪 Testing

### 1. Local Development Setup
```bash
# Install ngrok for HTTPS tunneling
npm install -g ngrok

# Start your server
npm run dev

# In another terminal, expose your local server
ngrok http 3000

# Update your TwiML App URLs to use the ngrok URL
```

### 2. Test Call Flow
1. **Test Incoming Calls**: Use WhatsApp to call your business number
2. **Test Outgoing Calls**: Use the API to make calls to WhatsApp numbers
3. **Test Conferences**: Create conferences with multiple participants
4. **Test Permission Flow**: Send and respond to call permission requests

### 3. Debugging
```typescript
// Enable debug logging
const whatsappVoice = new WhatsAppVoice(token, {
  whatsappSender: 'whatsapp:+1234567890',
  logLevel: 'debug'
});

// Monitor call events
whatsappVoice.device.on('error', (error) => {
  console.error('Device error:', error);
});
```

## 📊 Monitoring and Analytics

### Call Metrics
- Track call success rates and failure reasons
- Monitor call quality metrics (latency, packet loss)
- Analyze call duration and user engagement

### Conference Analytics
- Monitor conference participation rates
- Track conference duration and participant behavior
- Analyze call quality in multi-party scenarios

## 🚨 Troubleshooting

### Common Issues

1. **WhatsApp Number Not Recognized**
   - Ensure proper `whatsapp:+1234567890` format
   - Verify number is registered with WhatsApp Business
   - Check country restrictions

2. **Calls Not Connecting**
   - Verify TwiML Application configuration
   - Check webhook URL accessibility
   - Confirm WhatsApp sender voice configuration

3. **Conference Issues**
   - Ensure all participants have granted call permissions
   - Check conference name uniqueness
   - Verify moderator settings

4. **WebRTC Problems**
   - Check browser WebRTC support
   - Verify HTTPS connection
   - Test microphone/audio permissions

### Debug Commands
```bash
# Test webhook connectivity
curl -X POST https://your-domain.ngrok.io/voice/incoming \
  -d "From=whatsapp:+1234567890&To=whatsapp:+0987654321"

# Verify TwiML Application
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/$ACCOUNT_SID/Applications/$TWIML_APP_SID.json" \
  -u $ACCOUNT_SID:$AUTH_TOKEN
```

## 📚 API Reference

### WhatsAppVoice Class
- `initialize()` - Initialize the voice device
- `makeCall(options)` - Make an outbound call
- `createConference(options)` - Create a conference
- `getActiveCalls()` - Get active calls
- `destroy()` - Clean up resources

### ConferenceSession Class
- `addParticipant(number)` - Add participant to conference
- `removeParticipant(number)` - Remove participant
- `muteParticipant(number)` - Mute participant
- `end()` - End conference

### Utility Functions
- `WhatsAppVoiceUtils.formatWhatsAppNumber()` - Format phone numbers
- `WhatsAppVoiceUtils.isValidWhatsAppNumber()` - Validate numbers
- `WhatsAppVoiceUtils.extractPhoneNumber()` - Extract numbers from WhatsApp format

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🆘 Support

- [Twilio Voice Documentation](https://www.twilio.com/docs/voice)
- [WhatsApp Business API Documentation](https://www.twilio.com/docs/whatsapp)
- [GitHub Issues](https://github.com/sagar-jg/twilio-voice.js/issues)
- [Twilio Support](https://support.twilio.com)

---

## 🎯 Quick Start Summary

1. **Setup**: Configure Twilio account and WhatsApp Business
2. **Install**: Clone repository and install dependencies
3. **Configure**: Set environment variables and webhook URLs
4. **Deploy**: Run server and expose with ngrok for testing
5. **Test**: Make test calls and create conferences
6. **Production**: Deploy to production with proper HTTPS endpoints

**Happy coding! 🚀**
