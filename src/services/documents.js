const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// In-memory storage for document sessions (use Redis in production)
const documentSessions = new Map();

// Document templates and office data
const DOCUMENT_TEMPLATES = {
  'lost_registration_document': {
    title: 'Neuer Fahrzeugschein (Verlust)',
    description: 'Beantragung eines neuen Fahrzeugscheins nach Verlust',
    documents: [
      'Personalausweis oder Reisepass (bei Reisepass zusätzlich Meldebescheinigung, max. 3 Monate alt)',
      'Zulassungsbescheinigung Teil II (Fahrzeugbrief)',
      'Gültige Hauptuntersuchung (HU)',
      'Eventuell eidesstattliche Versicherung (falls auch Fahrzeugbrief verloren)'
    ],
    cost: 'ca. 12 Euro',
    paymentMethods: 'Kartenzahlung, Bar bei der Kreiskasse oder Überweisung'
  },
  'vehicle_reregistration': {
    title: 'Fahrzeug ummelden',
    description: 'Ummeldung eines Fahrzeugs bei Umzug oder Halterwechsel',
    documents: [
      'Personalausweis oder Reisepass mit Meldebescheinigung',
      'Zulassungsbescheinigung Teil I (Fahrzeugschein)',
      'Zulassungsbescheinigung Teil II (Fahrzeugbrief)',
      'Gültige Hauptuntersuchung (HU)',
      'Aktuelle Versicherungsbestätigung (eVB-Nummer)',
      'Bei Halterwechsel: Kaufvertrag oder Vollmacht'
    ],
    cost: 'ca. 25-30 Euro',
    paymentMethods: 'Kartenzahlung, Bar oder Überweisung'
  },
  'new_registration': {
    title: 'Fahrzeug neu anmelden',
    description: 'Erstmalige Zulassung eines Fahrzeugs',
    documents: [
      'Personalausweis oder Reisepass mit Meldebescheinigung',
      'COC-Papiere oder Fahrzeugbrief bei Gebrauchtwagen',
      'Gültige Hauptuntersuchung (HU)',
      'Aktuelle Versicherungsbestätigung (eVB-Nummer)',
      'Kaufvertrag oder Rechnung',
      'Bei Finanzierung: Sicherungsübereignung'
    ],
    cost: 'ca. 26-28 Euro + Kennzeichen',
    paymentMethods: 'Kartenzahlung, Bar oder Überweisung'
  }
};

const OFFICE_DATA = {
  'lörrach': {
    name: 'KFZ-Zulassungsstelle Lörrach',
    address: 'Palmstraße 3, 79539 Lörrach',
    phone: '07621 410-0',
    hours: {
      'Mo-Fr': '08:00-12:00',
      'Di': '13:30-15:30',
      'Do': '13:30-17:00'
    },
    website: 'www.loerrach-landkreis.de'
  },
  'berlin': {
    name: 'Kfz-Zulassungsstelle Berlin',
    address: 'Puttkamerstraße 16-18, 10958 Berlin',
    phone: '030 90269-0',
    hours: {
      'Mo-Fr': '07:00-15:00',
      'Do': '07:00-18:00'
    },
    website: 'www.berlin.de/zulassung'
  },
  'münchen': {
    name: 'Kfz-Zulassungsstelle München',
    address: 'Eichstätter Straße 2, 80686 München',
    phone: '089 233-40000',
    hours: {
      'Mo-Fr': '07:30-12:00',
      'Do': '07:30-17:00'
    },
    website: 'www.muenchen.de/zulassung'
  }
};

/**
 * Create a document page for a session
 */
async function createDocumentPage({ sessionId, serviceType, officeLocation, createdAt }) {
  try {
    // Get document template
    const template = DOCUMENT_TEMPLATES[serviceType] || DOCUMENT_TEMPLATES['lost_registration_document'];
    
    // Get office data
    const office = OFFICE_DATA[officeLocation.toLowerCase()] || OFFICE_DATA['lörrach'];
    
    // Load HTML template
    const templatePath = path.join(__dirname, '../templates/document-page.hbs');
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateSource);
    
    // Prepare template data
    const templateData = {
      sessionId,
      service: template,
      office,
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
      baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    };
    
    // Generate HTML
    const htmlContent = compiledTemplate(templateData);
    
    // Store session data
    documentSessions.set(sessionId, {
      sessionId,
      serviceType,
      officeLocation,
      htmlContent,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
      accessCount: 0
    });
    
    // Schedule cleanup after expiration
    setTimeout(() => {
      documentSessions.delete(sessionId);
      console.log(`🗑️ Cleaned up expired session: ${sessionId}`);
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
    
    return `${process.env.BASE_URL || 'http://localhost:3000'}/api/documents/${sessionId}`;
    
  } catch (error) {
    console.error('Error creating document page:', error);
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
      return null;
    }
    
    // Check if expired
    if (new Date() > session.expiresAt) {
      documentSessions.delete(sessionId);
      return null;
    }
    
    // Increment access count
    session.accessCount++;
    
    console.log(`📄 Document page accessed: ${sessionId} (${session.accessCount} times)`);
    
    return session.htmlContent;
    
  } catch (error) {
    console.error('Error getting document page:', error);
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
  
  console.log(`🗑️ Cleanup completed: ${deletedCount} expired sessions removed`);
  
  return { deletedCount };
}

/**
 * Get session statistics
 */
function getSessionStats() {
  const now = new Date();
  let active = 0;
  let expired = 0;
  
  for (const session of documentSessions.values()) {
    if (now > session.expiresAt) {
      expired++;
    } else {
      active++;
    }
  }
  
  return {
    total: documentSessions.size,
    active,
    expired
  };
}

module.exports = {
  createDocumentPage,
  getDocumentPage,
  cleanupExpiredSessions,
  getSessionStats
};