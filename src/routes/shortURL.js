const express = require('express');
const { resolveShortUrl, getShortUrlStats } = require('../services/urlShortener');

const router = express.Router();

// Redirect short URL to document page
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    
    // Validate short code format (8 hex characters)
    if (!shortCode || !shortCode.match(/^[a-f0-9]{8}$/)) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ungültiger Link</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa;">
          <h1 style="color: #dc3545;">Ungültiger Link</h1>
          <p>Dieser Kurz-Link ist nicht gültig.</p>
          <p style="font-size: 14px; color: #666;">Code: ${shortCode}</p>
        </body>
        </html>
      `);
    }
    
    // Resolve short URL
    const urlData = resolveShortUrl(shortCode);
    
    if (!urlData) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link nicht gefunden</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa;">
          <h1 style="color: #ffc107;">Link nicht gefunden</h1>
          <p>Dieser Kurz-Link existiert nicht oder ist bereits abgelaufen.</p>
          <p style="font-size: 14px; color: #666;">Kurz-Links sind 7 Tage gültig.</p>
        </body>
        </html>
      `);
    }
    
    // Log the redirect for analytics
    console.log(`🔗 Redirecting ${shortCode} to ${urlData.longUrl}`);
    
    // Redirect to the actual document page
    res.redirect(302, urlData.longUrl);
    
  } catch (error) {
    console.error('❌ Short URL redirect error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fehler</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa;">
        <h1 style="color: #dc3545;">Ein Fehler ist aufgetreten</h1>
        <p>Der Link konnte nicht verarbeitet werden.</p>
      </body>
      </html>
    `);
  }
});

// Stats endpoint for monitoring
router.get('/stats/overview', (req, res) => {
  try {
    // Check for auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.CLEANUP_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const stats = getShortUrlStats();
    res.json({
      shortUrls: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;