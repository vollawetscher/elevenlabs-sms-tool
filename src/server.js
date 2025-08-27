const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const smsRoutes = require('./routes/sms');
const documentRoutes = require('./routes/documents');
const shortUrlRoutes = require('./routes/shortUrl');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Railway/Heroku/etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: false // Allow special characters
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'
}));

// Serve static files (for document pages)
app.use('/static', express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/sms', smsRoutes);
app.use('/api/documents', documentRoutes);
app.use('/s', shortUrlRoutes); // Internal short URLs as fallback

// Debug route to check file system (temporary)
app.get('/debug/files', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const srcDir = path.join(__dirname, 'src');
    const templatesDir = path.join(__dirname, 'src/templates');
    const templateFile = path.join(__dirname, 'src/templates/conversation-document.hbs');
    
    const debug = {
      cwd: process.cwd(),
      __dirname,
      srcExists: fs.existsSync(srcDir),
      templatesExists: fs.existsSync(templatesDir),
      templateExists: fs.existsSync(templateFile),
      srcContents: fs.existsSync(srcDir) ? fs.readdirSync(srcDir) : 'N/A',
      templatesContents: fs.existsSync(templatesDir) ? fs.readdirSync(templatesDir) : 'N/A'
    };
    
    res.json(debug);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Debug route to test is.gd API directly
app.get('/debug/isgd/:testUrl?', async (req, res) => {
  const axios = require('axios');
  const testUrl = req.params.testUrl || 'https://elevenlabs-sms-tool-production.up.railway.app/api/documents/debug-test';
  
  try {
    console.log(`🧪 Testing is.gd with: ${testUrl}`);
    
    const response = await axios.get('https://is.gd/create.php', {
      params: {
        format: 'simple',
        url: testUrl
      },
      timeout: 10000
    });
    
    const shortUrl = response.data.trim();
    console.log(`🧪 is.gd response: ${shortUrl}`);
    
    res.json({
      success: true,
      originalUrl: testUrl,
      shortUrl: shortUrl,
      isValid: shortUrl.startsWith('https://is.gd/')
    });
    
  } catch (error) {
    console.error(`🧪 is.gd test failed:`, error.message);
    res.json({
      success: false,
      originalUrl: testUrl,
      error: error.message,
      code: error.code
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON. Check for special characters or formatting.',
      received: err.body?.substring(0, 200) + '...'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 ElevenLabs SMS Tool running on port ${PORT}`);
  console.log(`📱 SMS API: http://localhost:${PORT}/api/sms/send`);
  console.log(`📄 Documents: http://localhost:${PORT}/api/documents`);
});

module.exports = app;