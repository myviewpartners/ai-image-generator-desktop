document.addEventListener('DOMContentLoaded', () => {
  let currentImageUrl = null;
  let currentPrompt = '';
  let currentRevisedPrompt = '';

  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.dataset.view;
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`view-${viewId}`).classList.add('active');
      if (viewId === 'history') loadHistory();
      if (viewId === 'settings') loadSettings();
    });
  });

  const generateBtn = document.getElementById('generate-btn');
  const promptInput = document.getElementById('prompt');
  const sizeSelect = document.getElementById('size');
  const qualitySelect = document.getElementById('quality');
  const styleSelect = document.getElementById('style');
  const resultArea = document.getElementById('result-area');
  const resultActions = document.getElementById('result-actions');
  const resultMeta = document.getElementById('result-meta');
  const revisedPromptEl = document.getElementById('revised-prompt');
  const resultBadge = document.getElementById('result-badge');

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showToast('Please enter a prompt', 'error');
      promptInput.focus();
      return;
    }

    setGenerating(true);
    showPlaceholder();

    try {
      const result = await window.electronAPI.generateImage({
        prompt: prompt,
        size: sizeSelect.value,
        quality: qualitySelect.value,
        style: styleSelect.value
      });

      if (result.success) {
        currentImageUrl = result.url;
        currentPrompt = prompt;
        currentRevisedPrompt = result.revisedPrompt;

        resultArea.innerHTML = `<img src="${result.url}" alt="${result.revisedPrompt}">`;
        resultActions.style.display = 'flex';
        resultMeta.style.display = 'block';
        revisedPromptEl.textContent = result.revisedPrompt;
        resultBadge.style.display = 'inline-block';

        showToast('Image generated successfully!', 'success');
      } else {
        showPlaceholder();
        showToast(result.error, 'error');
      }
    } catch (err) {
      showPlaceholder();
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setGenerating(false);
    }
  });

  function setGenerating(isGenerating) {
    generateBtn.disabled = isGenerating;
    if (isGenerating) {
      generateBtn.innerHTML = '<span class="spinner"></span> Generating...';
    } else {
      generateBtn.innerHTML = `
        <span class="btn-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        </span>
        Generate Image`;
    }
  }

  function showPlaceholder() {
    resultArea.innerHTML = `
      <div class="placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>Your generated image will appear here</p>
        <p class="placeholder-sub">Images are served directly from OpenAI and are not stored on this device.</p>
      </div>`;
    resultActions.style.display = 'none';
    resultMeta.style.display = 'none';
    resultBadge.style.display = 'none';
  }

  document.getElementById('download-btn').addEventListener('click', async () => {
    if (!currentImageUrl) return;
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      const result = await window.electronAPI.downloadImage({
        url: currentImageUrl,
        prompt: currentPrompt
      });

      if (result.success) {
        showToast(`Saved to: ${result.filePath}`, 'success');
      } else if (!result.cancelled) {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast('Download failed.', 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download to Computer`;
    }
  });

  document.getElementById('regenerate-btn').addEventListener('click', () => {
    generateBtn.click();
  });

  async function loadHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <p>Loading...</p>
      </div>`;

    try {
      const result = await window.electronAPI.getHistory({ limit: 50, offset: 0 });

      if (result.success && result.history.length > 0) {
        list.innerHTML = result.history.map(item => `
          <div class="history-item">
            <img src="${item.image_url}" alt="" class="history-item-image" loading="lazy"
                 onerror="this.style.display='none'">
            <div class="history-item-body">
              <div class="history-item-prompt">${escapeHtml(item.prompt)}</div>
              <div class="history-item-meta">
                <span>${item.size} · ${item.quality} · ${item.style}</span>
                <span>${formatDate(item.created_at)}</span>
              </div>
              <div class="history-item-actions">
                <button class="btn btn-primary btn-small history-download" data-url="${item.image_url}" data-prompt="${escapeHtml(item.prompt)}">
                  Download
                </button>
              </div>
            </div>
          </div>
        `).join('');

        list.querySelectorAll('.history-download').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const url = e.currentTarget.dataset.url;
            const prompt = e.currentTarget.dataset.prompt;
            e.currentTarget.disabled = true;
            e.currentTarget.textContent = 'Saving...';

            const res = await window.electronAPI.downloadImage({ url, prompt });
            e.currentTarget.disabled = false;
            e.currentTarget.textContent = 'Download';

            if (res.success) showToast('Downloaded!', 'success');
            else if (!res.cancelled) showToast(res.error, 'error');
          });
        });
      } else {
        list.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p>No generations yet</p>
          </div>`;
      }
    } catch (err) {
      list.innerHTML = `<div class="empty-state"><p>Error loading history</p></div>`;
    }
  }

  document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all history? This cannot be undone.')) return;
    try {
      const result = await window.electronAPI.clearHistory();
      if (result.success) {
        showToast('History cleared', 'success');
        loadHistory();
      }
    } catch (err) {
      showToast('Failed to clear history', 'error');
    }
  });

  async function loadSettings() {
    try {
      const result = await window.electronAPI.getSettings();
      if (result.success) {
        const s = result.settings;
        document.getElementById('api-key').value = s.apiKey || '';
        document.getElementById('setting-size').value = s.defaultSize || '1024x1024';
        document.getElementById('setting-quality').value = s.defaultQuality || 'standard';
        document.getElementById('setting-style').value = s.defaultStyle || 'vivid';
        document.getElementById('rate-limit').value = s.rateLimit || '10';
      }
    } catch (err) {
      showToast('Failed to load settings', 'error');
    }
  }

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const btn = document.getElementById('save-settings-btn');
    const msg = document.getElementById('settings-message');

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const result = await window.electronAPI.saveSettings({
        apiKey: document.getElementById('api-key').value.trim(),
        defaultSize: document.getElementById('setting-size').value,
        defaultQuality: document.getElementById('setting-quality').value,
        defaultStyle: document.getElementById('setting-style').value,
        rateLimit: document.getElementById('rate-limit').value
      });

      msg.style.display = 'block';
      if (result.success) {
        msg.className = 'message success';
        msg.textContent = 'Settings saved successfully!';
        showToast('Settings saved', 'success');
      } else {
        msg.className = 'message error';
        msg.textContent = result.error;
      }
    } catch (err) {
      msg.style.display = 'block';
      msg.className = 'message error';
      msg.textContent = 'Failed to save settings.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Settings';
      setTimeout(() => { msg.style.display = 'none'; }, 4000);
    }
  });

  document.getElementById('api-keys-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal('https://platform.openai.com/api-keys');
  });

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || icons.info}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
});
