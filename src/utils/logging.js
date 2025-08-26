/**
 * Validate and format German mobile phone numbers
 * @param {string} phoneNumber - Raw phone number input
 * @returns {Object} - Validation result with formatted number
 */
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return {
        isValid: false,
        message: 'Phone number is required'
      };
    }
  
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Handle different German mobile number formats
    if (cleaned.startsWith('+49')) {
      // International format: +491701234567
      cleaned = cleaned.substring(3); // Remove +49
    } else if (cleaned.startsWith('0049')) {
      // International format: 00491701234567  
      cleaned = cleaned.substring(4); // Remove 0049
    } else if (cleaned.startsWith('49')) {
      // Without leading zeros: 491701234567
      cleaned = cleaned.substring(2); // Remove 49
    } else if (cleaned.startsWith('0')) {
      // National format: 01701234567
      cleaned = cleaned.substring(1); // Remove leading 0
    }
  
    // Check if it's a valid German mobile number
    // German mobile numbers start with 15, 16, or 17 after country code
    if (!cleaned.match(/^1[5-7]\d{8,9}$/)) {
      return {
        isValid: false,
        message: 'Invalid German mobile number format. Must start with 015, 016, or 017.'
      };
    }
  
    // Check length (should be 10 or 11 digits after 1)
    if (cleaned.length < 10 || cleaned.length > 11) {
      return {
        isValid: false,
        message: 'German mobile number must have 10-11 digits after country code'
      };
    }
  
    return {
      isValid: true,
      formatted: `+49${cleaned}`,
      national: `0${cleaned}`,
      message: 'Valid German mobile number'
    };
  }
  
  /**
   * Sanitize input strings to prevent XSS and injection attacks
   * @param {string} input - Raw input string
   * @returns {string} - Sanitized string
   */
  function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }
  
    return input
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
      .substring(0, 100); // Limit length
  }
  
  /**
   * Validate service type
   * @param {string} serviceType - Service type from request
   * @returns {Object} - Validation result
   */
  function validateServiceType(serviceType) {
    const validTypes = [
      'lost_registration_document',
      'vehicle_reregistration', 
      'new_registration',
      'address_change',
      'deregistration'
    ];
  
    const sanitized = sanitizeInput(serviceType).toLowerCase().replace(/\s+/g, '_');
  
    if (!validTypes.includes(sanitized)) {
      return {
        isValid: false,
        message: `Invalid service type. Must be one of: ${validTypes.join(', ')}`
      };
    }
  
    return {
      isValid: true,
      serviceType: sanitized,
      message: 'Valid service type'
    };
  }
  
  /**
   * Validate office location
   * @param {string} location - Office location from request
   * @returns {Object} - Validation result
   */
  function validateOfficeLocation(location) {
    const validLocations = [
      'lörrach',
      'berlin',
      'münchen',
      'hamburg',
      'köln',
      'frankfurt',
      'stuttgart',
      'düsseldorf'
    ];
  
    if (!location) {
      return {
        isValid: true,
        location: 'lörrach', // Default location
        message: 'Using default location'
      };
    }
  
    const sanitized = sanitizeInput(location).toLowerCase();
    
    // Try to match partial names
    const matched = validLocations.find(loc => 
      loc.includes(sanitized) || sanitized.includes(loc)
    );
  
    return {
      isValid: true,
      location: matched || 'lörrach',
      message: matched ? 'Valid location' : 'Using default location'
    };
  }
  
  /**
   * Validate session ID format
   * @param {string} sessionId - UUID session ID
   * @returns {Object} - Validation result
   */
  function validateSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        isValid: false,
        message: 'Session ID is required'
      };
    }
  
    // Check UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!