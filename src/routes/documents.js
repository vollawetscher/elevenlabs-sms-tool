const express = require('express');
const { getDocumentPage, cleanupExpiredSessions } = require('../services/documents');

const router = express.Router();

// Serve document page by session ID
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || sessionId.length !== 36) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ungültige Session</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>Ungültige oder abgelaufene Session</h1>
          <p>Diese Dokumentenliste ist nicht verfügbar oder bereits abgelaufen.</p>
        </body>
        </html>
      `);
    }

    const documentPage = await getDocumentPage(sessionId);
    
    if (!documentPage) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dokument nicht gefunden</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>Dokument nicht gefunden</h1>
          <p>Diese Dokumentenliste existiert nicht oder ist bereits abgelaufen.</p>
        </body>
        </html>
      `);
    }

    // Set headers for print-friendly page
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    res.send(documentPage);

  } catch (error) {
    console.error('Document page error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fehler</title>
        <meta charset="utf-8">
      </head>
      <body>
        <h1>Ein Fehler ist aufgetreten</h1>
        <p>Die Dokumentenliste konnte nicht geladen werden.</p>
      </body>
      </html>
    `);
  }
});

// Cleanup endpoint (for scheduled cleanup of expired sessions)
router.post('/cleanup', async (req, res) => {
  try {
    // Only allow cleanup from internal sources
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.CLEANUP_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cleanupResult = await cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: 'Cleanup completed',
      deletedSessions: cleanupResult.deletedCount
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Cleanup failed',
      message: error.message
    });
  }
});

module.exports = router;