// Proxy Server for AI Image Detector
// This server acts as a middleman between the extension and Hive AI API
// IMPORTANT: Never expose your API key in the browser extension!

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Hive AI Configuration
const HIVE_API_URL = 'https://api.thehive.ai/api/v2/task/sync';
const HIVE_API_KEY = process.env.HIVE_API_KEY;

// Validate API key is set
if (!HIVE_API_KEY) {
  console.error('ERROR: HIVE_API_KEY not set in environment variables!');
  console.error('Please create a .env file with your Hive AI API key');
  process.exit(1);
}

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  
  // Filter out old requests outside the time window
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Image Detector Proxy Server is running' });
});

// Main scan endpoint
app.post('/api/scan', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait before scanning more images.'
    });
  }

  const { imageUrl } = req.body;

  // Validate input
  if (!imageUrl) {
    return res.status(400).json({
      error: 'Missing imageUrl',
      message: 'Please provide an imageUrl in the request body'
    });
  }

  // Validate URL format
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: 'Image URL must start with http:// or https://'
    });
  }

  try {
    console.log(`Scanning image: ${imageUrl.substring(0, 100)}...`);

    // Call Hive AI API
    const response = await fetch(HIVE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `token ${HIVE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: imageUrl
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hive AI API Error:', response.status, errorText);
      
      return res.status(response.status).json({
        error: 'Hive API Error',
        message: 'Failed to scan image with Hive AI',
        details: errorText
      });
    }

    const data = await response.json();
    
    // Parse Hive AI response
    // Hive returns scores for different classes
    // We need to extract the AI detection score
    const result = parseHiveResponse(data);

    console.log(`Scan result: ${result.isAI ? 'AI' : 'Real'} (${Math.round(result.confidence * 100)}%)`);

    res.json(result);

  } catch (error) {
    console.error('Error scanning image:', error);
    
    res.status(500).json({
      error: 'Server Error',
      message: 'An error occurred while scanning the image',
      details: error.message
    });
  }
});

/**
 * Parse Hive AI API response
 * Hive returns different models and classes, we need to extract AI detection
 */
function parseHiveResponse(hiveData) {
  try {
    // Hive returns status array with different models
    // Look for AI-generated content detection
    const status = hiveData.status;
    
    if (!status || status.length === 0) {
      throw new Error('No status data in Hive response');
    }

    // Find the AI detection model in the response
    // This varies based on which Hive model you're using
    // Common models: 'generative_ai', 'ai_generated', etc.
    
    let aiScore = 0;
    let humanScore = 0;

    for (const model of status) {
      if (model.response && model.response.output) {
        const classes = model.response.output;
        
        // Look for AI-related classes
        for (const classItem of classes) {
          const className = classItem.class.toLowerCase();
          
          if (className.includes('ai') || 
              className.includes('generated') || 
              className.includes('synthetic')) {
            aiScore = Math.max(aiScore, classItem.score);
          }
          
          if (className.includes('human') || 
              className.includes('real') || 
              className.includes('authentic')) {
            humanScore = Math.max(humanScore, classItem.score);
          }
        }
      }
    }

    // Determine if AI or human-made
    const isAI = aiScore > humanScore;
    const confidence = Math.max(aiScore, humanScore);

    return {
      isAI: isAI,
      confidence: confidence,
      rawData: hiveData // Include raw data for debugging
    };

  } catch (error) {
    console.error('Error parsing Hive response:', error);
    
    // Return a safe default
    return {
      isAI: false,
      confidence: 0,
      error: 'Failed to parse response'
    };
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Image Detector Proxy Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Scan endpoint: http://localhost:${PORT}/api/scan`);
  console.log('');
  console.log('⚠️  Remember: Never expose your API key in the browser extension!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});