const axios = require('axios');
const { validatePhoneNumber } = require('../utils/validation');

const SEVEN_IO_API_URL = 'https://gateway.seven.io/api/sms';

/**
 * Send SMS via seven.io API
 * @param {string} to - German mobile number in +49 format
 * @param {string} text - SMS message content
 * @returns {Object} - Result object with success status and message ID
 */
async function sendSMS(to, text) {
  try {
    if (!process.env.SEVEN_IO_API_KEY) {
      throw new Error('SEVEN_IO_API_KEY environment variable not set');
    }

    const phoneValidation = validatePhoneNumber(to);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.message);
    }

    // Prepare SMS request
    const smsData = {
      to: phoneValidation.formatted,
      text,
      from: process.env.SMS_SENDER_ID || 'KFZ-Service', // Optional custom sender ID
      delay: 0 // Send immediately
    };

    console.log(`📱 Sending SMS to ${phoneValidation.formatted.replace(/(\+49\d{3})\d{4}(\d{3})/, '$1****$2')}`);

    const response = await axios.post(SEVEN_IO_API_URL, smsData, {
      headers: {
        'X-API-Key': process.env.SEVEN_IO_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    // Check response status
    if (response.status === 200 && response.data.success) {
      console.log(`✅ SMS sent successfully. Message ID: ${response.data.messages[0].id}`);
      
      return {
        success: true,
        messageId: response.data.messages[0].id,
        cost: response.data.total_price || 0,
        parts: response.data.messages[0].parts || 1
      };
    } else {
      console.error('❌ SMS sending failed:', response.data);
      
      return {
        success: false,
        error: response.data.message || 'Unknown error from SMS provider',
        code: response.data.code
      };
    }

  } catch (error) {
    console.error('❌ SMS API error:', error.message);

    if (error.response) {
      // API returned an error response
      return {
        success: false,
        error: error.response.data?.message || 'SMS API error',
        code: error.response.status
      };
    } else if (error.request) {
      // Network error
      return {
        success: false,
        error: 'Network error - SMS API unreachable',
        code: 'NETWORK_ERROR'
      };
    } else {
      // Other error
      return {
        success: false,
        error: error.message,
        code: 'UNKNOWN_ERROR'
      };
    }
  }
}

/**
 * Check SMS delivery status via seven.io API
 * @param {string} messageId - Message ID returned from sendSMS
 * @returns {Object} - Delivery status information
 */
async function checkSMSStatus(messageId) {
  try {
    if (!process.env.SEVEN_IO_API_KEY) {
      throw new Error('SEVEN_IO_API_KEY environment variable not set');
    }

    const response = await axios.get(`${SEVEN_IO_API_URL}/status`, {
      headers: {
        'X-API-Key': process.env.SEVEN_IO_API_KEY
      },
      params: {
        msg_id: messageId
      },
      timeout: 5000
    });

    return {
      success: true,
      status: response.data.status,
      messageId,
      timestamp: response.data.timestamp
    };

  } catch (error) {
    console.error('SMS status check error:', error.message);
    
    return {
      success: false,
      error: error.message,
      messageId
    };
  }
}

module.exports = {
  sendSMS,
  checkSMSStatus
};