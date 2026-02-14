// AI Image Detector - Content Script
// This script runs on social media pages and scans images on hover

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Change this to your proxy server URL (we'll create this next)
    PROXY_SERVER_URL: 'http://localhost:3000/api/scan',
    
    // Debounce time for hover (ms)
    HOVER_DELAY: 500,
    
    // Cache scanned images to avoid re-scanning
    CACHE_DURATION: 3600000, // 1 hour in milliseconds
    
    // Minimum confidence to show label
    MIN_CONFIDENCE: 0.7
  };

  // Cache to store already scanned images
  const scannedImages = new Map();
  
  // Currently processing images
  const processingImages = new Set();

  /**
   * Initialize the extension
   */
  function init() {
    console.log('AI Image Detector initialized');
    
    // Watch for new images added to the page
    observeNewImages();
    
    // Scan existing images
    attachHoverListeners();
  }

  /**
   * Watch for dynamically added images (infinite scroll)
   */
  function observeNewImages() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          attachHoverListeners();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Attach hover listeners to all images on the page
   */
  function attachHoverListeners() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      // Skip if already has listener or is too small (likely icon)
      if (img.dataset.aiDetectorAttached || img.width < 100 || img.height < 100) {
        return;
      }

      // Mark as attached
      img.dataset.aiDetectorAttached = 'true';

      let hoverTimer = null;

      // Mouse enter event
      img.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
          handleImageHover(img);
        }, CONFIG.HOVER_DELAY);
      });

      // Mouse leave event - cancel the timer
      img.addEventListener('mouseleave', () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
      });
    });
  }

  /**
   * Handle image hover - trigger scan
   */
  async function handleImageHover(img) {
    const imgSrc = img.src || img.dataset.src;
    
    if (!imgSrc || imgSrc.startsWith('data:')) {
      return; // Skip data URLs and missing sources
    }

    // Check if already scanned
    const cached = getCachedResult(imgSrc);
    if (cached) {
      displayLabel(img, cached);
      return;
    }

    // Check if currently processing
    if (processingImages.has(imgSrc)) {
      return;
    }

    // Show loading indicator
    showLoadingIndicator(img);

    try {
      processingImages.add(imgSrc);
      const result = await scanImage(imgSrc);
      
      // Cache the result
      cacheResult(imgSrc, result);
      
      // Display the label
      displayLabel(img, result);
      
    } catch (error) {
      console.error('Error scanning image:', error);
      showErrorLabel(img);
    } finally {
      processingImages.delete(imgSrc);
      removeLoadingIndicator(img);
    }
  }

  /**
   * Scan image using proxy server
   */
  async function scanImage(imageUrl) {
    const response = await fetch(CONFIG.PROXY_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: imageUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Cache result
   */
  function cacheResult(imageUrl, result) {
    scannedImages.set(imageUrl, {
      result: result,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached result if still valid
   */
  function getCachedResult(imageUrl) {
    const cached = scannedImages.get(imageUrl);
    
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > CONFIG.CACHE_DURATION) {
      scannedImages.delete(imageUrl);
      return null;
    }

    return cached.result;
  }

  /**
   * Display label on image
   */
  function displayLabel(img, result) {
    // Remove any existing label
    removeLabel(img);

    const { isAI, confidence } = result;

    // Only show label if confidence is above threshold
    if (confidence < CONFIG.MIN_CONFIDENCE) {
      return;
    }

    const label = createLabel(isAI, confidence);
    
    // Position the label relative to the image
    positionLabel(img, label);
    
    // Store reference to label on image
    img.dataset.aiDetectorLabel = 'true';
  }

  /**
   * Create label element
   */
  function createLabel(isAI, confidence) {
    const label = document.createElement('div');
    label.className = 'ai-detector-label';
    
    if (isAI) {
      label.classList.add('ai-detected');
      label.innerHTML = `
        <span class="ai-detector-icon">🤖</span>
        <span class="ai-detector-text">AI Generated (${Math.round(confidence * 100)}%)</span>
      `;
    } else {
      label.classList.add('human-created');
      label.innerHTML = `
        <span class="ai-detector-icon">✓</span>
        <span class="ai-detector-text">Likely Real (${Math.round(confidence * 100)}%)</span>
      `;
    }

    return label;
  }

  /**
   * Position label relative to image
   */
  function positionLabel(img, label) {
    // Make parent container position relative if it isn't already
    const parent = img.parentElement;
    const parentStyle = window.getComputedStyle(parent);
    
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    // Insert label after the image
    img.after(label);

    // Position it absolutely over the image
    const imgRect = img.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    label.style.position = 'absolute';
    label.style.top = `${imgRect.top - parentRect.top + 10}px`;
    label.style.right = `${parentRect.right - imgRect.right + 10}px`;
  }

  /**
   * Remove existing label
   */
  function removeLabel(img) {
    const existingLabel = img.parentElement.querySelector('.ai-detector-label');
    if (existingLabel) {
      existingLabel.remove();
    }
    delete img.dataset.aiDetectorLabel;
  }

  /**
   * Show loading indicator
   */
  function showLoadingIndicator(img) {
    const loader = document.createElement('div');
    loader.className = 'ai-detector-loader';
    loader.innerHTML = '⏳';
    
    const parent = img.parentElement;
    const parentStyle = window.getComputedStyle(parent);
    
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    img.after(loader);

    const imgRect = img.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    loader.style.position = 'absolute';
    loader.style.top = `${imgRect.top - parentRect.top + 10}px`;
    loader.style.right = `${parentRect.right - imgRect.right + 10}px`;
  }

  /**
   * Remove loading indicator
   */
  function removeLoadingIndicator(img) {
    const loader = img.parentElement.querySelector('.ai-detector-loader');
    if (loader) {
      loader.remove();
    }
  }

  /**
   * Show error label
   */
  function showErrorLabel(img) {
    const label = document.createElement('div');
    label.className = 'ai-detector-label ai-detector-error';
    label.innerHTML = `
      <span class="ai-detector-icon">⚠️</span>
      <span class="ai-detector-text">Scan Failed</span>
    `;
    
    positionLabel(img, label);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      label.remove();
    }, 3000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();