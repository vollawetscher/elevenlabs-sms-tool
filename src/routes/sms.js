const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sendSMS } = require('../services/sevenio');
const { createDocumentPage } = require('../services/documents');
const { validatePhoneNumber, sanitizeInput, validateRequestPayload } = require('../utils/validation');
const { logSMSRequest } = require('../utils/logging');

const router = express.Router();

// ElevenLabs webhook endpoint for sending SMS
router.post('/send', async (req, res) => {
  try {
    const {
      phone_number,
      service_title,
      required_documents,
      office_details,
      cost_and_payment,
      additional_notes
    } = req.body;

    // Validate required fields
    if (!phone_number || !service_title || !required_documents) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['phone_number', 'service_title', 'required_documents'],
        received: Object.keys(req.body)
      });
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phone_number);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid phone number',
        message: phoneValidation.message
      });
    }

    // Sanitize and validate extracted content
    const extractedContent = {
      serviceTitle: sanitizeInput(service_title),
      requiredDocuments: Array.isArray(required_documents) 
        ? required_documents.map(doc => sanitizeInput(doc)).filter(doc => doc.length > 0)
        : [],
      officeDetails: validateOfficeDetails(office_details),
      costAndPayment: cost_and_payment ? {
        cost: sanitizeInput(cost_and_payment.cost || ''),
        paymentMethods: sanitizeInput(cost_and_payment.payment_methods || cost_and_payment.paymentMethods || '')
      } : null,
      additionalNotes: additional_notes ? sanitizeInput(additional_notes) : null
    };

    // Validate that we have meaningful content
    if (extractedContent.requiredDocuments.length === 0) {
      return res.status(400).json({
        error: 'No valid documents found',
        message: 'required_documents array is empty or contains no valid content'
      });
    }

    // Generate unique session ID for document page
    const sessionId = uuidv4();
    
    console.log(`📋 Creating document page for: ${extractedContent.serviceTitle}`);
    console.log(`📄 Documents: ${extractedContent.requiredDocuments.length} items`);

    // Create personalized document page from conversation content
    const documentUrl = await createDocumentPage({
      sessionId,
      extractedContent,
      createdAt: new Date()
    });

    // Prepare SMS message
    const smsMessage = `${extractedContent.serviceTitle} - Ihre Unterlagenliste: ${documentUrl}`;

    // Validate SMS length
    if (smsMessage.length > 160) {
      // Use shorter message for long service titles
      const shortMessage = `Ihre Unterlagenliste: ${documentUrl}`;
      console.log(`📱 SMS shortened: ${smsMessage.length} -> ${shortMessage.length} chars`);
    }

    const finalSMSMessage = smsMessage.length > 160 
      ? `Ihre Unterlagenliste: ${documentUrl}`
      : smsMessage;

    // Send SMS via seven.io
    console.log(`📱 Sending SMS to ${phoneValidation.formatted.replace(/(\+49\d{3})\d{4}(\d{3})/, '$1****$2')}`);
    const smsResult = await sendSMS(phoneValidation.formatted, finalSMSMessage);

    if (!smsResult.success) {
      console.error('❌ SMS sending failed:', smsResult.error);
      return res.status(500).json({
        error: 'Failed to send SMS',
        message: smsResult.error,
        code: smsResult.code
      });
    }

    // Log the request (GDPR compliant)
    await logSMSRequest({
      sessionId,
      phoneNumber: phoneValidation.formatted,
      serviceTitle: extractedContent.serviceTitle,
      documentsCount: extractedContent.requiredDocuments.length,
      officeLocation: extractedContent.officeDetails?.name || 'Unknown',
      smsId: smsResult.messageId,
      timestamp: new Date()
    });

    console.log(`✅ Document SMS sent successfully. Session: ${sessionId}`);

    // Successful response for ElevenLabs Voice Agent
    res.json({
      success: true,
      message: 'Document list sent via SMS',
      sessionId,
      documentUrl,
      smsId: smsResult.messageId,
      documentsCount: extractedContent.requiredDocuments.length,
      spokenResponse: `I've sent your ${extractedContent.serviceTitle.toLowerCase()} document list to your phone. You should receive the link shortly.`
    });

  } catch (error) {
    console.error('❌ SMS send error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process document request',
      timestamp: new Date().toISOString()
    });
  }
});

// Status check endpoint
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || sessionId.length !== 36) {
      return res.status(400).json({
        error: 'Invalid session ID format'
      });
    }
    
    res.json({
      sessionId,
      status: 'active',
      documentUrl: `${process.env.BASE_URL}/api/documents/${sessionId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check status'
    });
  }
});

/**
 * Validate and sanitize office details from LLM extraction
 */
function validateOfficeDetails(officeDetails) {
  if (!officeDetails || typeof officeDetails !== 'object') {
    return {
      name: 'KFZ-Zulassungsstelle',
      address: 'Bitte bei der Behörde erfragen',
      phone: 'Siehe offizielle Website',
      hours: 'Bitte Öffnungszeiten prüfen',
      website: ''
    };
  }

  return {
    name: sanitizeInput(officeDetails.name || officeDetails.officeName || 'KFZ-Zulassungsstelle'),
    address: sanitizeInput(officeDetails.address || ''),
    phone: sanitizeInput(officeDetails.phone || officeDetails.telephone || ''),
    hours: sanitizeInput(officeDetails.hours || officeDetails.opening_hours || officeDetails.openingHours || ''),
    website: sanitizeInput(officeDetails.website || '')
  };
}

module.exports = router;
