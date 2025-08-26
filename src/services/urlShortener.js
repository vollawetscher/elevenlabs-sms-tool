const crypto = require('crypto');

// In-memory storage for URL mappings (use Redis in production)
const urlMappings = new Map();
const reverseMap = new Map(); // For cleanup

/**
 * Create a short URL for the document link
 * @param {string} longUrl - Full document URL
 * @param {string} sessionId - Session ID for tracking
 * @returns {string} - Shortened URL
 */
function createShortUrl(longUrl, sessionId) {
  try {
    // Check if we already have a short URL for this session
    if (reverseMap.has(sessionId)) {
      const existingShortCode = reverseMap.get(sessionId);
      const { getBaseUrl } = require('./documents');
      const baseUrl = getBaseUrl();
      return `${baseUrl}/s/${existingShortCode}`;
    }

    // Generate short code (8 characters for uniqueness but still short for SMS)
    const shortCode = crypto.randomBytes(4).toString('hex').toLowerCase();
    
    // Store mapping
    const shortUrlData = {
      longUrl,
      sessionId,
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
        console.log(`🗑️ Expired short URL cleaned up: ${shortCode}`);
      }
    }, 7 * 24 * 60 * 60 * 1000);
    
    const { getBaseUrl } = require('./documents');
    
    const baseUrl = getBaseUrl();
    const shortUrl = `${baseUrl}/s/${shortCode}`;
    
    console.log(`🔗 Short URL created: ${longUrl} -> ${shortUrl}`);
    
    return shortUrl;
    
  } catch (error) {
    console.error('❌ Error creating short URL:', error);
    // Fallback to original URL if shortening fails
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