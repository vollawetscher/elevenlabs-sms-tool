const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sendSMS } = require('../services/sevenio');
const { createDocumentPage } = require('../services/documents');
const { validatePhoneNumber, sanitizeInput } = require('../utils/validation');
const { logSMSRequest } = require('../utils/logging');

const router = express.Router();

// ElevenLabs webhook endpoint for sending SMS
router.post('/send', async (req, res) => {
  try {
    const { phone_number, service_type, office_location } = req.body;

    // Validate required fields
    if (!phone_number || !service_type) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['phone_number', 'service_type']
      });
    }

    // Sanitize inputs
    const sanitizedPhone = sanitizeInput(phone_number);
    const sanitizedService = sanitizeInput(service_type);
    const sanitizedLocation = sanitizeInput(office_location || 'general');

    // Validate German mobile number
    const validatedPhone = validatePhoneNumber(sanitizedPhone);
    if (!validatedPhone.isValid) {
      return res.status(400).json({
        error: 'Invalid phone number',
        message: validatedPhone.message
      });
    }

    // Generate unique session ID for document page
    const sessionId = uuidv4();
    
    // Create document page
    const documentUrl = await createDocumentPage({
      sessionId,
      serviceType: sanitizedService,
      officeLocation: sanitizedLocation,
      createdAt: new Date()
    });

    // Prepare SMS message
    const smsMessage = `Ihre Unterlagen für ${sanitizedService}: ${process.env.BASE_URL}/documents/${sessionId}`;

    // Send SMS via seven.io
    const smsResult = await sendSMS(validatedPhone.formatted, smsMessage);

    if (!smsResult.success) {
      return res.status(500).json({
        error: 'Failed to send SMS',
        message: smsResult.error
      });
    }

    // Log the request (GDPR compliant)
    await logSMSRequest({
      sessionId,
      phoneNumber: validatedPhone.formatted,
      serviceType: sanitizedService,
      officeLocation: sanitizedLocation,
      smsId: smsResult.messageId,
      timestamp: new Date()
    });

    // Successful response
    res.json({
      success: true,
      message: 'SMS sent successfully',
      sessionId,
      documentUrl,
      smsId: smsResult.messageId
    });

  } catch (error) {
    console.error('SMS send error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process SMS request'
    });
  }
});

// Status check endpoint
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Here you could check SMS delivery status
    // For now, return basic session info
    
    res.json({
      sessionId,
      status: 'active',
      documentUrl: `${process.env.BASE_URL}/documents/${sessionId}`
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check status'
    });
  }
});

module.exports = router;