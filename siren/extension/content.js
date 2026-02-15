(function () {
  const MAX_TEXT_LENGTH = 5000;

  function getPageText() {
    const url = (window.location.hostname || '').toLowerCase();
    let text = '';

    if (url.includes('twitter.com') || url.includes('x.com')) {
      const tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
      const parts = [];
      tweetEls.forEach((el) => {
        const t = (el.textContent || '').trim();
        if (t) parts.push(t);
      });
      text = parts.join('\n\n') || (document.querySelector('[data-testid="tweetText"]')?.textContent || '').trim();
    } else if (url.includes('youtube.com')) {
      const title = document.querySelector('#title h1.ytd-video-primary-info-renderer, h1.ytd-video-primary-info-renderer, #title')?.textContent?.trim() || '';
      const desc = document.querySelector('#description-inline-expander #description, #description')?.textContent?.trim() || '';
      text = [title, desc].filter(Boolean).join('\n\n');
    }

    if (!text) {
      const body = document.body;
      if (body) text = (body.innerText || body.textContent || '').trim();
    }

    return (text || '').slice(0, MAX_TEXT_LENGTH);
  }

  function captureMedia() {
    const url = (window.location.hostname || '').toLowerCase();
    const selectorVideo = 'video';
    const selectorImg = 'img[src]';
    const maxSize = 1024;

    function drawToCanvas(source, w, h) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(w, maxSize);
      canvas.height = Math.min(h, (h / w) * canvas.width);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      try {
        return canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        return null;
      }
    }

    if (url.includes('youtube.com')) {
      const video = document.querySelector(selectorVideo);
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const dataUrl = drawToCanvas(video, video.videoWidth, video.videoHeight);
        if (dataUrl) return { dataUrl, source: 'video' };
      }
      const thumb = document.querySelector('img.ytd-moving-thumbnail-renderer, #thumbnail img, img[src*="ytimg"]');
      if (thumb && thumb.naturalWidth > 0) {
        const dataUrl = drawToCanvas(thumb, thumb.naturalWidth, thumb.naturalHeight);
        if (dataUrl) return { dataUrl, source: 'image' };
      }
    }

    if (url.includes('twitter.com') || url.includes('x.com')) {
      const imgs = document.querySelectorAll('article img[src*="twimg"], [data-testid="tweetPhoto"] img, img[src*="pbs.twimg"]');
      for (const img of imgs) {
        if (img.naturalWidth > 100) {
          const dataUrl = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
          if (dataUrl) return { dataUrl, source: 'image' };
        }
      }
    }

    const video = document.querySelector(selectorVideo);
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      const dataUrl = drawToCanvas(video, video.videoWidth, video.videoHeight);
      if (dataUrl) return { dataUrl, source: 'video' };
    }

    const imgs = document.querySelectorAll(selectorImg);
    for (const img of imgs) {
      if (img.complete && img.naturalWidth > 80 && img.naturalHeight > 80) {
        try {
          const dataUrl = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
          if (dataUrl) return { dataUrl, source: 'image' };
        } catch (e) {}
      }
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'getText') {
      sendResponse({ text: getPageText() });
    } else if (msg.type === 'captureMedia') {
      sendResponse(captureMedia() || { error: 'No video or image found' });
    } else {
      sendResponse({ error: 'Unknown message type' });
    }
    return true;
  });
})();
