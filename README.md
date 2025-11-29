# ElevenLabs SMS Tool

A Node.js API that integrates with ElevenLabs Voice Agents to send SMS messages containing document checklists for German vehicle registration offices via the seven.io SMS API.

## Features

- 🎙️ **ElevenLabs Integration**: Webhook endpoint for voice agents
- 📱 **SMS Delivery**: Send via seven.io to German mobile numbers
- 📋 **Document Templates**: Pre-built checklists for vehicle registration services
- 🖨️ **Printable Pages**: Generate mobile-friendly, printable document lists
- 🔒 **GDPR Compliant**: Minimal data storage with automatic cleanup
- 🚀 **Railway Ready**: Easy deployment with included configuration

## Quick Start

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd elevenlabs-sms-tool
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your seven.io API key
```

### 3. Run Locally
```bash
npm run dev  # Development with nodemon
npm start    # Production
```

### 4. Deploy to Railway
```bash
# Push to GitHub, then connect to Railway
# Set environment variables in Railway dashboard
```

## ElevenLabs Voice Agent Configuration

Add this webhook tool to your ElevenLabs Voice Agent:

```json
{
  "type": "webhook",
  "name": "send_sms_documents", 
  "description": "Send SMS with required documents list for German vehicle registration",
  "api_schema": {
    "url": "https://your-app.railway.app/api/sms/send",
    "method": "POST",
    "request_body_schema": {
      "type": "object",
      "properties": [
        {
          "id": "phone_number",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Extract the German mobile phone number from conversation. Convert to +49 format (e.g., 0171234567 becomes +49171234567)",
          "required": true
        },
        {
          "id": "service_type",
          "type": "string", 
          "value_type": "llm_prompt",
          "description": "Determine service type: 'lost_registration_document', 'vehicle_reregistration', 'new_registration', 'address_change', 'deregistration'",
          "required": true
        },
        {
          "id": "office_location",
          "type": "string",
          "value_type": "llm_prompt", 
          "description": "Extract the city/location of the vehicle registration office (e.g., 'Lörrach', 'Berlin', 'München')",
          "required": false
        }
      ]
    }
  }
}
```

### Simple SMS Tool (No Document Generation)

For sending basic text messages without document generation:

```json
{
  "type": "webhook",
  "name": "send_simple_sms",
  "description": "Send a simple SMS message to a German phone number",
  "api_schema": {
    "url": "https://your-app.railway.app/api/sms/send-simple",
    "method": "POST",
    "request_body_schema": {
      "type": "object",
      "properties": [
        {
          "id": "phone_number",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Extract the German mobile phone number from conversation. Convert to +49 format (e.g., 0171234567 becomes +49171234567)",
          "required": true
        },
        {
          "id": "message",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "The SMS message text to send to the user. Should be concise and clear. Maximum 1000 characters.",
          "required": true
        }
      ]
    }
  }
}
```

## API Endpoints

### POST /api/sms/send
Send SMS with document checklist
```bash
curl -X POST https://your-app.railway.app/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+49171234567",
    "service_type": "lost_registration_document",
    "office_location": "lörrach"
  }'
```

### POST /api/sms/send-simple
Send a simple SMS message (no document generation)
```bash
curl -X POST https://your-app.railway.app/api/sms/send-simple \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+49171234567",
    "message": "Your appointment is confirmed for tomorrow at 10am."
  }'
```

### GET /api/documents/{sessionId}
View generated document page (sent via SMS link)

### GET /health
Health check endpoint

## Supported Services

- `lost_registration_document` - Neuer Fahrzeugschein (Verlust)
- `vehicle_reregistration` - Fahrzeug ummelden  
- `new_registration` - Fahrzeug neu anmelden
- `address_change` - Adresse ändern
- `deregistration` - Fahrzeug abmelden

## Supported Locations

- Lörrach (default)
- Berlin
- München 
- Hamburg
- Köln
- Frankfurt
- Stuttgart
- Düsseldorf

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SEVEN_IO_API_KEY` | Your seven.io API key | ✅ |
| `BASE_URL` | Your deployed app URL | ✅ |
| `SMS_SENDER_ID` | Custom SMS sender ID | ❌ |
| `NODE_ENV` | Environment (development/production) | ❌ |
| `CLEANUP_TOKEN` | Token for cleanup endpoint | ❌ |

## Development

### Project Structure
```
src/
├── server.js           # Main Express server
├── routes/
│   ├── sms.js         # SMS sending endpoints
│   └── documents.js   # Document page serving
├── services/
│   ├── sevenio.js     # seven.io SMS integration
│   └── documents.js   # Document page generation
├── utils/
│   ├── validation.js  # Input validation
│   └── logging.js     # GDPR compliant logging
└── templates/
    └── document-page.hbs # Handlebars template
```

### Adding New Office Locations
Edit `src/services/documents.js` and add to `OFFICE_DATA`:

```javascript
'new_city': {
  name: 'KFZ-Zulassungsstelle New City',
  address: 'Street 123, 12345 New City', 
  phone: '012345 67890',
  hours: {
    'Mo-Fr': '08:00-12:00',
    'Do': '13:00-17:00'
  },
  website: 'www.newcity.de'
}
```

### Adding New Document Types
Edit `DOCUMENT_TEMPLATES` in the same file.

## GDPR Compliance

- Phone numbers are hashed in logs
- Document pages expire after 7 days
- Session data is automatically cleaned up
- Minimal data collection and storage
- Built-in privacy notices on generated pages

## Testing

```bash
# Run tests
npm test

# Test SMS endpoint
curl -X POST http://localhost:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"01701234567","service_type":"lost_registration_document"}'
```

## Production Deployment

1. **Railway**: Push to GitHub, connect to Railway, set environment variables
2. **Environment**: Set `NODE_ENV=production`
3. **Database**: Consider adding Redis for session storage at scale
4. **Monitoring**: Monitor `/health` endpoint
5. **Logs**: Set up log aggregation for SMS delivery tracking

## License

MIT License - see LICENSE file for details

## Support

For issues with:
- **ElevenLabs Integration**: Check webhook configuration and payload format
- **SMS Delivery**: Verify seven.io API key and phone number format
- **Document Generation**: Check template syntax and office data
- **Railway Deployment**: Ensure all environment variables are set

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request# Deploy trigger Mi 27 Aug 2025 07:57:47 CEST
