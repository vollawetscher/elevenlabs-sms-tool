const crypto = require('crypto');
const axios = require('axios');

// In-memory storage for URL mappings (use Redis in production)
const urlMappings = new Map();
const reverseMap = new Map(); // For cleanup

/**
 * Create a short URL using is.gd service (external)
 * @param {string} longUrl - Full document URL
 * @param {string} sessionId - Session ID for tracking
 * @returns {string} - Shortened URL from is.gd
 */
async function createShortUrl(longUrl, sessionId) {
  try {
    // Check if we already have a short URL for this session
    if (reverseMap.has(sessionId)) {
      const existingShortUrl = reverseMap.get(sessionId);
      console.log(`🔗 Reusing cached short URL for session ${sessionId}: ${existingShortUrl}`);
      return existingShortUrl;
    }

    // Use is.gd API to shorten the URL
    console.log(`🔗 Creating NEW short URL for: ${longUrl}`);
    console.log(`🔗 Attempting is.gd API call...`);
    
    const response = await axios.get('https://is.gd/create.php', {
      params: {
        format: 'simple',
        url: longUrl
      },
      timeout: 10000 // 10 second timeout
    });

    const shortUrl = response.data.trim();
    console.log(`🔗 is.gd response: ${shortUrl}`);
    
    // Validate response
    if (!shortUrl.startsWith('https://is.gd/')) {
      throw new Error(`Invalid response from is.gd: ${shortUrl}`);
    }
    
    // Store mapping for analytics and cleanup
    const shortUrlData = {
      longUrl,
      shortUrl,
      sessionId,
      createdAt: new Date(),
      accessCount: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    // Use session ID as key since we can't extract is.gd code easily
    urlMappings.set(sessionId, shortUrlData);
    reverseMap.set(sessionId, shortUrl);
    
    // Schedule cleanup after expiration
    setTimeout(() => {
      if (urlMappings.has(sessionId)) {
        urlMappings.delete(sessionId);
        reverseMap.delete(sessionId);
        console.log(`🗑️ Expired URL mapping cleaned up: ${sessionId}`);
      }
    }, 7 * 24 * 60 * 60 * 1000);
    
    console.log(`✅ Short URL created: ${longUrl} -> ${shortUrl}`);
    
    return shortUrl;
    
  } catch (error) {
    console.error('❌ Error creating short URL with is.gd:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error response:', error.response?.data);
    console.error('Full error:', error);
    
    // Fallback: try our internal shortener
    console.log('⚠️ Falling back to internal URL shortener...');
    return createInternalShortUrl(longUrl, sessionId);
  }
}

/**
 * Fallback internal short URL creator
 * @param {string} longUrl - Full document URL  
 * @param {string} sessionId - Session ID for tracking
 * @returns {string} - Internal shortened URL
 */
function createInternalShortUrl(longUrl, sessionId) {
  try {
    // Generate short code (6 characters for balance of brevity and uniqueness)
    const shortCode = crypto.randomBytes(3).toString('hex').toLowerCase();
    
    // Store mapping
    const shortUrlData = {
      longUrl,
      sessionId,
      shortCode,
      createdAt: new Date(),
      accessCount: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    urlMappings.set(shortCode, shortUrlData);
    reverseMap.set(sessionId, shortCode);
    
    // Auto-cleanup expired URLs
    setTimeout(() => {
      if (urlMappings.has(shortCode)) {
        urlMappings.delete(shortCode);
        reverseMap.delete(sessionId);
        console.log(`🗑️ Expired internal short URL cleaned up: ${shortCode}`);
      }
    }, 7 * 24 * 60 * 60 * 1000);
    
    const { getBaseUrl } = require('./documents');
    const baseUrl = getBaseUrl();
    const shortUrl = `${baseUrl}/s/${shortCode}`;
    
    console.log(`🔗 Internal short URL created: ${longUrl} -> ${shortUrl}`);
    
    return shortUrl;
    
  } catch (error) {
    console.error('❌ Error creating internal short URL:', error);
    // Last resort: return original URL
    return longUrl;
  }
}

/**
 * Resolve short URL to long URL
 * @param {string} shortCode - Short code from URL
 * @returns {Object|null} - URL data or null if not found/expired
 */
function resolveShortUrl(shortCode) {
  try {
    const urlData = urlMappings.get(shortCode);
    
    if (!urlData) {
      console.log(`❌ Short URL not found: ${shortCode}`);
      return null;
    }
    
    // Check if expired
    if (new Date() > urlData.expiresAt) {
      urlMappings.delete(shortCode);
      reverseMap.delete(urlData.sessionId);
      console.log(`⏰ Short URL expired: ${shortCode}`);
      return null;
    }
    
    // Increment access count
    urlData.accessCount++;
    urlData.lastAccessed = new Date();
    
    console.log(`🔗 Short URL accessed: ${shortCode} -> ${urlData.longUrl} (${urlData.accessCount} times)`);
    
    return urlData;
    
  } catch (error) {
    console.error('❌ Error resolving short URL:', error);
    return null;
  }
}

/**
 * Get statistics for short URLs
 */
function getShortUrlStats() {
  const now = new Date();
  let active = 0;
  let expired = 0;
  let totalAccesses = 0;
  
  for (const urlData of urlMappings.values()) {
    if (now > urlData.expiresAt) {
      expired++;
    } else {
      active++;
    }
    totalAccesses += urlData.accessCount;
  }
  
  return {
    total: urlMappings.size,
    active,
    expired,
    totalAccesses,
    averageAccesses: urlMappings.size > 0 ? totalAccesses / urlMappings.size : 0
  };
}

/**
 * Clean up expired URLs manually
 */
function cleanupExpiredUrls() {
  const now = new Date();
  let deletedCount = 0;
  
  for (const [shortCode, urlData] of urlMappings.entries()) {
    if (now > urlData.expiresAt) {
      urlMappings.delete(shortCode);
      reverseMap.delete(urlData.sessionId);
      deletedCount++;
    }
  }
  
  console.log(`🗑️ URL cleanup: ${deletedCount} expired URLs removed`);
  return { deletedCount };
}

module.exports = {
  createShortUrl,
  resolveShortUrl,
  getShortUrlStats,
  cleanupExpiredUrls
};