// content.js
console.log("Siren-X Content Script Loaded");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getText') {
    // 1. Grab visible text
    const text = document.body.innerText.substring(0, 5000);
    sendResponse({ text: text });
  } 
  
  else if (request.type === 'captureMedia') {
    // 2. Try to find a video or main image
    const video = document.querySelector('video');
    
    if (video && video.videoWidth > 0) {
      // Draw video frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      sendResponse({ dataUrl: dataUrl });
    } else {
      // If no video, we can't capture "media" from content script easily.
      // We return an error so popup handles it.
      sendResponse({ error: "No playing video found on page." });
    }
  }
  return true; // Keep channel open for async response
});