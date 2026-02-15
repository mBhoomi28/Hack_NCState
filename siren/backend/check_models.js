// debug_models.js
require('dotenv').config();

const key = process.env.GEMINI_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

console.log("🔍 Checking available models for your API key...");

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error("❌ API Error:", data.error.message);
      return;
    }
    
    console.log("\n✅ SUCCESS! Here are the exact Model IDs you can use:");
    console.log("----------------------------------------------------");
    
    const usableModels = data.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));
      
    usableModels.forEach(name => console.log(`"${name}"`));
    
    console.log("----------------------------------------------------");
    console.log("👉 Copy one of the names above into your server.js file.");
  })
  .catch(err => console.error("Network Error:", err.message));