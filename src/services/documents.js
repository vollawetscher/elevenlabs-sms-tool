// Generate HTML
htmlContent = compiledTemplate(templateData);
        
} else {
  console.log(`❌ Template file does not exist at: ${templatePath}`);
  throw new Error('Template file not found');
}const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// In-memory storage for document sessions (use Redis in production)
const documentSessions = new Map();

/**
* Create a personalized document page from extracted conversation content
*/
async function createDocumentPage({ sessionId, extractedContent, createdAt }) {
try {
let htmlContent;

// Try to load the Handlebars template
try {
const templatePath = path.join(__dirname, '../templates/conversation-document.hbs');
console.log(`🔍 Looking for template at: ${templatePath}`);
console.log(`🔍 __dirname is: ${__dirname}`);
console.log(`🔍 Resolved path: ${path.resolve(templatePath)}`);

// Check if file exists first
const fs = require('fs');
const fileExists = fs.existsSync(templatePath);
console.log(`🔍 File exists: ${fileExists}`);

if (fileExists) {
  const templateSource = await fs.readFile(templatePath, 'utf-8');
  console.log(`✅ Template loaded successfully (${templateSource.length} characters)`);
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

} catch (templateError) {
console.log('⚠️ Template file not found, using fallback HTML generator');

// Fallback: Generate HTML without template
htmlContent = generateFallbackHTML(sessionId, extractedContent, createdAt);
}

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

return `${getBaseUrl()}/api/documents/${sessionId}`;

} catch (error) {
console.error('❌ Error creating document page:', error);
throw new Error('Failed to create document page');
}
}

/**
* Get properly formatted base URL with https://
*/
function getBaseUrl() {
let baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// Ensure https:// for production
if (!baseUrl.startsWith('http')) {
baseUrl = `https://${baseUrl}`;
}

return baseUrl;
}

/**
* Generate fallback HTML when template is not available
*/
function generateFallbackHTML(sessionId, extractedContent, createdAt) {
const documentsListHTML = extractedContent.requiredDocuments
.map((doc, index) => `<div style="margin: 10px 0; padding: 15px; background: #f8f9fa; border-left: 4px solid #28a745; border-radius: 4px;">
<input type="checkbox" id="doc${index}" style="margin-right: 10px;">
<label for="doc${index}">${doc}</label>
</div>`)
.join('');

const officeHTML = extractedContent.officeDetails ? `
<div style="background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0;">
<h3 style="color: #495057; margin-bottom: 15px;">📍 ${extractedContent.officeDetails.name || 'KFZ-Zulassungsstelle'}</h3>
${extractedContent.officeDetails.address ? `<p><strong>Adresse:</strong> ${extractedContent.officeDetails.address}</p>` : ''}
${extractedContent.officeDetails.phone ? `<p><strong>Telefon:</strong> ${extractedContent.officeDetails.phone}</p>` : ''}
${extractedContent.officeDetails.hours ? `<p><strong>Öffnungszeiten:</strong> ${extractedContent.officeDetails.hours}</p>` : ''}
</div>` : '';

const costHTML = extractedContent.costAndPayment ? `
<div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
<h3 style="color: #856404; margin-bottom: 15px;">💰 Kosten & Zahlung</h3>
${extractedContent.costAndPayment.cost ? `<p><strong>Gebühr:</strong> ${extractedContent.costAndPayment.cost}</p>` : ''}
${extractedContent.costAndPayment.paymentMethods ? `<p><strong>Zahlung:</strong> ${extractedContent.costAndPayment.paymentMethods}</p>` : ''}
</div>` : '';

return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${extractedContent.serviceTitle} - Unterlagenliste</title>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f8f9fa; }
  .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
  .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center; }
  .header h1 { margin: 0 0 10px; font-size: 28px; }
  .header p { margin: 0; opacity: 0.9; }
  .content { padding: 30px; }
  .section { margin-bottom: 30px; }
  .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
  .badge { background: #17a2b8; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; }
  .footer { background: #343a40; color: white; padding: 20px; text-align: center; font-size: 12px; }
  @media print { body { background: white; } .container { box-shadow: none; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
      <h1>${extractedContent.serviceTitle}</h1>
      <p>Basierend auf Ihrem Gespräch vom ${createdAt.toLocaleDateString('de-DE')}</p>
      <span class="badge">📞 Aus Ihrem Gespräch extrahiert</span>
  </div>
  
  <div class="content">
      ${officeHTML}
      
      <div class="section">
          <h2>📋 Benötigte Unterlagen</h2>
          <p style="color: #666; font-style: italic; margin-bottom: 20px;">
              Diese Liste basiert auf den spezifischen Informationen aus Ihrem Gespräch:
          </p>
          ${documentsListHTML}
      </div>
      
      ${costHTML}
      
      ${extractedContent.additionalNotes ? `
      <div class="section">
          <h2>📝 Wichtige Hinweise</h2>
          <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
              <p>${extractedContent.additionalNotes}</p>
          </div>
      </div>` : ''}
      
      <div class="section">
          <h2>🔒 Datenschutzhinweis</h2>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; font-size: 14px;">
              <p><strong>Datenverarbeitung:</strong> Ihre Telefonnummer wurde temporär gespeichert und wird innerhalb von 48 Stunden automatisch gelöscht.</p>
              <p><strong>Gültigkeit:</strong> Diese Seite läuft in 7 Tagen ab und wird automatisch entfernt.</p>
              <p><strong>Personalisierte Inhalte:</strong> Diese Liste wurde basierend auf Ihrem spezifischen Gespräch erstellt.</p>
          </div>
      </div>
  </div>
  
  <div class="footer">
      <p>Digitaler Assistent der KFZ-Zulassungsstelle</p>
      <p>Session: ${sessionId} | Erstellt: ${createdAt.toLocaleString('de-DE')}</p>
  </div>
</div>
</body>
</html>`;
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
searchSessions,
getBaseUrl
};