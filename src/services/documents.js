const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// In-memory storage for document sessions (use Redis in production)
const documentSessions = new Map();

/**
 * Create a personalized document page from extracted conversation content
 */
async function createDocumentPage({ sessionId, extractedContent, createdAt }) {
  try {
    // Load HTML template
    const templatePath = path.join(__dirname, '../templates/conversation-document.hbs');
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateSource);
    
    // Process extracted content for template
    const templateData = {
      sessionId,
      service: {
        title: extractedContent.serviceTitle,
        description: `Basierend auf Ihrem Gespräch vom ${createdAt.toLocaleDateString('de-DE')}`
      },
      documents: extractedContent.requiredDocuments,
      office: extractedContent.officeDetails,
      cost: extractedContent.costAndPayment,
      additionalNotes: extractedContent.additionalNotes,
      createdAt: createdAt.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      documentsCount: extractedContent.requiredDocuments.length
    };
    
    // Generate HTML
    const htmlContent = compiledTemplate(templateData);
    
    // Store session data
    const sessionData = {
      sessionId,
      extractedContent,
      htmlContent,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      accessCount: 0,
      lastAccessed: null
    };

    documentSessions.set(sessionId, sessionData);
    
    // Schedule cleanup after expiration
    setTimeout(() => {
      if (documentSessions.has(sessionId)) {
        documentSessions.delete(sessionId);
        console.log(`🗑️ Auto-cleaned expired session: ${sessionId}`);
      }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
    
    console.log(`📄 Document page created: ${sessionId} (${extractedContent.requiredDocuments.length} documents)`);
    
    return `${process.env.BASE_URL || 'http://localhost:3000'}/api/documents/${sessionId}`;
    
  } catch (error) {
    console.error('❌ Error creating document page:', error);
    throw new Error('Failed to create document page');
  }
}

/**
 * Get document page by session ID
 */
async function getDocumentPage(sessionId) {
  try {
    const session = documentSessions.get(sessionId);
    
    if (!session) {
      console.log(`❌ Session not found: ${sessionId}`);
      return null;
    }
    
    // Check if expired
    if (new Date() > session.expiresAt) {
      documentSessions.delete(sessionId);
      console.log(`🗑️ Expired session deleted: ${sessionId}`);
      return null;
    }
    
    // Update access tracking
    session.accessCount++;
    session.lastAccessed = new Date();
    
    console.log(`📖 Document accessed: ${sessionId} (${session.accessCount} times, service: ${session.extractedContent.serviceTitle})`);
    
    return session.htmlContent;
    
  } catch (error) {
    console.error('❌ Error getting document page:', error);
    return null;
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  const now = new Date();
  let deletedCount = 0;
  
  for (const [sessionId, session] of documentSessions.entries()) {
    if (now > session.expiresAt) {
      documentSessions.delete(sessionId);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`🗑️ Cleanup completed: ${deletedCount} expired sessions removed`);
  }
  
  return { deletedCount };
}

/**
 * Get session statistics
 */
function getSessionStats() {
  const now = new Date();
  let active = 0;
  let expired = 0;
  let totalAccesses = 0;
  const serviceTypes = {};
  
  for (const session of documentSessions.values()) {
    if (now > session.expiresAt) {
      expired++;
    } else {
      active++;
    }
    
    totalAccesses += session.accessCount;
    
    const serviceTitle = session.extractedContent.serviceTitle;
    serviceTypes[serviceTitle] = (serviceTypes[serviceTitle] || 0) + 1;
  }
  
  return {
    total: documentSessions.size,
    active,
    expired,
    totalAccesses,
    averageAccessesPerSession: documentSessions.size > 0 ? totalAccesses / documentSessions.size : 0,
    serviceTypes
  };
}

/**
 * Get recent sessions (for debugging/monitoring)
 */
function getRecentSessions(limit = 10) {
  return Array.from(documentSessions.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(session => ({
      sessionId: session.sessionId,
      serviceTitle: session.extractedContent.serviceTitle,
      documentsCount: session.extractedContent.requiredDocuments.length,
      officeName: session.extractedContent.officeDetails.name,
      createdAt: session.createdAt,
      accessCount: session.accessCount,
      lastAccessed: session.lastAccessed
    }));
}

/**
 * Search sessions by service type or office
 */
function searchSessions(query) {
  const results = [];
  const searchTerm = query.toLowerCase();
  
  for (const session of documentSessions.values()) {
    const serviceTitle = session.extractedContent.serviceTitle.toLowerCase();
    const officeName = session.extractedContent.officeDetails.name.toLowerCase();
    
    if (serviceTitle.includes(searchTerm) || officeName.includes(searchTerm)) {
      results.push({
        sessionId: session.sessionId,
        serviceTitle: session.extractedContent.serviceTitle,
        officeName: session.extractedContent.officeDetails.name,
        createdAt: session.createdAt,
        accessCount: session.accessCount
      });
    }
  }
  
  return results.sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  createDocumentPage,
  getDocumentPage,
  cleanupExpiredSessions,
  getSessionStats,
  getRecentSessions,
  searchSessions
};
