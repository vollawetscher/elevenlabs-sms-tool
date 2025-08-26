const fs = require('fs').promises;
const path = require('path');

// In-memory log storage (use proper database in production)
const smsLogs = [];

/**
 * Log SMS request for GDPR compliance and debugging
 * @param {Object} logData - SMS request data
 */
async function logSMSRequest(logData) {
  const logEntry = {
    ...logData,
    // Hash phone number for privacy (keep last 3 digits for debugging)
    phoneNumberHashed: hashPhoneNumber(logData.phoneNumber),
    timestamp: logData.timestamp || new Date()
  };

  // Remove actual phone number from log
  delete logEntry.phoneNumber;

  smsLogs.push(logEntry);

  // Keep only last 1000 entries in memory
  if (smsLogs.length > 1000) {
    smsLogs.splice(0, smsLogs.length - 1000);
  }

  // Log to console for development
  console.log(`📊 SMS Log: ${logEntry.sessionId} -> ${logEntry.phoneNumberHashed}`);

  // In production, you might want to write to a proper log file or database
  if (process.env.NODE_ENV === 'production') {
    await writeToLogFile(logEntry);
  }
}

/**
 * Hash phone number for privacy while keeping some digits for debugging
 * @param {string} phoneNumber - Full phone number
 * @returns {string} - Hashed phone number with last 3 digits visible
 */
function hashPhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.length < 4) {
    return 'INVALID';
  }

  const last3 = phoneNumber.slice(-3);
  const prefix = phoneNumber.startsWith('+49') ? '+49' : phoneNumber.substring(0, 3);
  
  return `${prefix}****${last3}`;
}

/**
 * Write log entry to file (for production)
 * @param {Object} logEntry - Log entry to write
 */
async function writeToLogFile(logEntry) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, `sms-${new Date().toISOString().split('T')[0]}.log`);

    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });

    // Append log entry
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(logFile, logLine);

  } catch (error) {
    console.error('Failed to write log file:', error);
  }
}

/**
 * Get SMS statistics
 * @returns {Object} - SMS usage statistics
 */
function getSMSStats() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

  const stats = {
    total: smsLogs.length,
    last24h: smsLogs.filter(log => log.timestamp > last24h).length,
    lastHour: smsLogs.filter(log => log.timestamp > lastHour).length,
    byServiceType: {},
    byLocation: {}
  };

  // Count by service type
  smsLogs.forEach(log => {
    stats.byServiceType[log.serviceType] = (stats.byServiceType[log.serviceType] || 0) + 1;
    stats.byLocation[log.officeLocation] = (stats.byLocation[log.officeLocation] || 0) + 1;
  });

  return stats;
}

/**
 * Clean up old logs (GDPR compliance - delete after retention period)
 * @param {number} retentionDays - Days to keep logs
 */
function cleanupOldLogs(retentionDays = 30) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const initialLength = smsLogs.length;
  
  // Remove logs older than retention period
  for (let i = smsLogs.length - 1; i >= 0; i--) {
    if (smsLogs[i].timestamp < cutoffDate) {
      smsLogs.splice(i, 1);
    }
  }
  
  const deletedCount = initialLength - smsLogs.length;
  
  if (deletedCount > 0) {
    console.log(`🗑️ Cleaned up ${deletedCount} old SMS logs`);
  }
  
  return { deletedCount };
}

/**
 * Get recent SMS logs (without sensitive data)
 * @param {number} limit - Number of recent logs to return
 * @returns {Array} - Recent log entries
 */
function getRecentLogs(limit = 50) {
  return smsLogs
    .slice(-limit)
    .map(log => ({
      sessionId: log.sessionId,
      phoneNumberHashed: log.phoneNumberHashed,
      serviceType: log.serviceType,
      officeLocation: log.officeLocation,
      timestamp: log.timestamp,
      smsId: log.smsId
    }));
}

module.exports = {
  logSMSRequest,
  getSMSStats,
  cleanupOldLogs,
  getRecentLogs,
  hashPhoneNumber
};
