require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 5000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- TEXT ANALYSIS ROUTE ---
app.post('/analyze-text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    console.log("📝 Analyzing Text...");
    
    // 1. Try Real Fact Check API
    let realFactChecks = [];
    if (process.env.FACT_CHECK_KEY) {
      try {
        const query = text.split(' ').slice(0, 15).join(' '); // Search first ~15 words
        const fcRes = await axios.get('https://factchecktools.googleapis.com/v1alpha1/claims:search', {
          params: { query: query, key: process.env.FACT_CHECK_KEY }
        });
        if (fcRes.data.claims) {
          realFactChecks = fcRes.data.claims.map(c => ({
            review: {
              title: c.text,
              publisher: c.claimant,
              url: c.claimReview[0]?.url,
              rating: c.claimReview[0]?.textualRating
            }
          }));
        }
      } catch (e) {
        console.log("Fact Check API skipped/failed:", e.message);
      }
    }

    // 2. Gemini Analysis (The Brain)
    // We tell Gemini to INCLUDE sources if we didn't find any real ones.
    const prompt = `
    Analyze this text for misinformation/deception.
    
    If the text contains specific factual claims, cite 2-3 real verification sources (Snopes, Reuters, etc.) in the 'fact_checks' array.
    
    Return STRICT JSON:
    {
      "risk_score": (0-100),
      "verdict": "SAFE" | "SUSPICIOUS" | "MISINFO",
      "analysis": "Short summary",
      "detected_patterns": ["Pattern 1", "Pattern 2"],
      "fact_checks": [
        { "review": { "title": "Claim Title", "publisher": "Source Name", "url": "https://example.com", "rating": "False/True" } }
      ]
    }
    Text: ${text.substring(0, 5000)}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(responseText);

    // Merge Real Fact Checks if we found them, otherwise keep Gemini's
    if (realFactChecks.length > 0) {
      data.fact_checks = realFactChecks;
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// --- MEDIA ANALYSIS ROUTE ---
app.post('/analyze-media', upload.single('image'), async (req, res) => {
  try {
    // Use Sightengine if you have keys, otherwise Fallback to Gemini Vision
    // Since this is a 24h hackathon, we default to Gemini Vision as it's safer.
    
    console.log("📷 Analyzing Media...");
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const prompt = `
    Analyze this image/screenshot for Deepfake artifacts or AI generation.
    Return STRICT JSON:
    {
      "deepfake_score": (0.0 to 1.0),
      "verdict": "LIKELY_REAL" | "POSSIBLE_DEEPFAKE",
      "details": "Explanation of artifacts found"
    }
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    res.json(JSON.parse(responseText));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Media scan failed" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));