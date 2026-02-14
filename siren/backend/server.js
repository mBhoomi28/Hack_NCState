require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.GEMINI_KEY) {
  console.error('❌ FATAL ERROR: GEMINI_KEY is missing in .env');
  process.exit(1);
}

// *** USE THE NEW MODEL ***
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", // Faster & smarter than 1.5
  generationConfig: { responseMimeType: "application/json" } // Force JSON mode
});

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------
//  SYSTEM PROMPT
// ---------------------------------------------------------
const ANALYSIS_PROMPT = `
You are a Cyber-Forensic Analyst for Siren-X. 
Analyze the provided text for deceptive patterns, AI generation, and emotional manipulation.

STRICT JSON OUTPUT REQUIRED. 
Return exactly this structure:
{
  "risk_score": (Integer 0-100, where 100 is maximum danger),
  "verdict": "SAFE" | "SUSPICIOUS" | "HIGH THREAT",
  "primary_trigger": "Fear Mongering" | "False Urgency" | "Political Rage" | "None",
  "ai_likelihood": "Low" | "Medium" | "High",
  "analysis_summary": "One short, punchy sentence explaining the verdict.",
  "detected_patterns": ["Pattern 1", "Pattern 2", "Pattern 3"]
}
`;

// ---------------------------------------------------------
//  HELPER: Bulletproof JSON Cleaner
// ---------------------------------------------------------
function cleanAndParseJSON(text) {
  try {
    // 1. Try parsing directly (best case)
    return JSON.parse(text);
  } catch (e) {
    // 2. If that fails, find the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1) throw new Error("No JSON object found in response");
    
    const jsonCandidate = text.substring(start, end + 1);
    
    // 3. Remove any remaining markdown backticks inside the block
    const cleanJson = jsonCandidate.replace(/```json/g, "").replace(/```/g, "");
    
    return JSON.parse(cleanJson);
  }
}

app.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length < 50) return res.status(400).json({ error: 'Text too short.' });

    const result = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: ANALYSIS_PROMPT + "\n\nTEXT TO ANALYZE:\n" + text.substring(0, 5000) }] 
      }]
    });

    const responseText = result.response.text();
    
    // *** USE THE CLEANER FUNCTION ***
    const data = cleanAndParseJSON(responseText);

    res.json(data);

  } catch (err) {
    console.error('Analysis Error:', err.message);
    // If parsing fails, return a "Safe Mode" response so the extension doesn't crash
    res.json({
      risk_score: 0,
      verdict: "ANALYSIS ERROR",
      primary_trigger: "System Fail",
      ai_likelihood: "Unknown",
      analysis_summary: "The forensic scan encountered an error processing the AI response.",
      detected_patterns: ["Error: Invalid JSON from AI"]
    });
  }
});

app.listen(PORT, () => console.log(`✅ Siren-X Live on Port ${PORT}`));