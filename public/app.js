// Pushy Web SDK Integration Client Logic

const STORAGE_KEYS = {
  APP_ID: 'pushy_app_id',
  API_KEY: 'pushy_secret_api_key',
  DEVICE_TOKEN: 'pushy_device_token',
  TOPICS: 'pushy_subscribed_topics'
};

const state = {
  appId: localStorage.getItem(STORAGE_KEYS.APP_ID) || '',
  secretApiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
  deviceToken: localStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN) || '',
  subscribedTopics: JSON.parse(localStorage.getItem(STORAGE_KEYS.TOPICS) || '[]'),
  notifications: []
};

// UI Elements
const els = {
  appIdInput: document.getElementById('appIdInput'),
  saveAppIdBtn: document.getElementById('saveAppIdBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  serverKeyStatus: document.getElementById('serverKeyStatus'),
  
  registerBtn: document.getElementById('registerBtn'),
  registerSpinner: document.getElementById('registerSpinner'),
  registerBtnText: document.getElementById('registerBtnText'),
  permissionDeniedBox: document.getElementById('permissionDeniedBox'),
  registrationErrorBox: document.getElementById('registrationErrorBox'),
  errorTimestamp: document.getElementById('errorTimestamp'),
  errorLogContent: document.getElementById('errorLogContent'),
  
  permissionBadge: document.getElementById('permissionBadge'),
  statusBadge: document.getElementById('statusBadge'),
  tokenDisplay: document.getElementById('tokenDisplay'),
  copyTokenBtn: document.getElementById('copyTokenBtn'),
  
  channelInput: document.getElementById('channelInput'),
  subscribeBtn: document.getElementById('subscribeBtn'),
  subscribeSpinner: document.getElementById('subscribeSpinner'),
  topicsList: document.getElementById('topicsList'),
  noTopicsMsg: document.getElementById('noTopicsMsg'),
  
  testChannelSelect: document.getElementById('testChannelSelect'),
  testTitleInput: document.getElementById('testTitleInput'),
  testMessageInput: document.getElementById('testMessageInput'),
  sendTestBtn: document.getElementById('sendTestBtn'),
  sendSpinner: document.getElementById('sendSpinner'),
  sendResult: document.getElementById('sendResult'),
  
  notificationsList: document.getElementById('notificationsList'),
  noNotificationsMsg: document.getElementById('noNotificationsMsg'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  toastContainer: document.getElementById('toastContainer')
};

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColors = {
    info: 'bg-indigo-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    danger: 'bg-rose-600'
  };

  toast.className = `toast px-4 py-3 rounded-lg text-white text-sm shadow-xl flex items-center justify-between space-x-3 pointer-events-auto ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="text-white hover:text-slate-200 font-bold ml-2 focus:outline-none">&times;</button>
  `;

  toast.querySelector('button').onclick = () => toast.remove();
  els.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 5000);
}

// Initialise and render state
async function init() {
  // Pre-fill inputs from local state
  if (state.appId) els.appIdInput.value = state.appId;
  if (state.secretApiKey) els.apiKeyInput.value = state.secretApiKey;

  // Check server defaults if local state is empty
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (!state.appId && config.appId) {
      state.appId = config.appId;
      els.appIdInput.value = config.appId;
      localStorage.setItem(STORAGE_KEYS.APP_ID, config.appId);
    }
    if (config.hasServerApiKey) {
      if (els.serverKeyStatus) {
        els.serverKeyStatus.textContent = '● Active on server (.env)';
      }
      if (!state.secretApiKey) {
        els.apiKeyInput.placeholder = 'Configured in server .env (ready)';
      }
    }
  } catch (e) {
    console.warn('Could not reach /api/config', e);
  }

  updatePermissionBadge();
  updateStatusBadge();
  renderDeviceToken();
  renderTopics();
  setupEventListeners();

  // If already registered or token exists, register notification listener
  if (typeof Pushy !== 'undefined') {
    setupPushyNotificationListener();
  } else {
    showToast('Pushy SDK script not detected. Check network connection.', 'warning');
  }
}

// Update notification permission badge
function updatePermissionBadge() {
  if (!('Notification' in window)) {
    els.permissionBadge.textContent = 'Not Supported';
    els.permissionBadge.className = 'badge badge-warning';
    return;
  }

  const perm = Notification.permission;
  els.permissionBadge.textContent = perm.charAt(0).toUpperCase() + perm.slice(1);

  if (perm === 'granted') {
    els.permissionBadge.className = 'badge badge-success';
    if (els.permissionDeniedBox) els.permissionDeniedBox.classList.add('hidden');
  } else if (perm === 'denied') {
    els.permissionBadge.className = 'badge badge-warning';
    if (els.permissionDeniedBox) els.permissionDeniedBox.classList.remove('hidden');
  } else {
    els.permissionBadge.className = 'badge badge-idle';
    if (els.permissionDeniedBox) els.permissionDeniedBox.classList.add('hidden');
  }
}

// Update device status badge
function updateStatusBadge() {
  const isReg = typeof Pushy !== 'undefined' && Pushy.isRegistered();
  if (isReg || state.deviceToken) {
    els.statusBadge.textContent = 'Registered';
    els.statusBadge.className = 'badge badge-success';
    els.registerBtnText.textContent = 'Re-Register Device';
  } else {
    els.statusBadge.textContent = 'Unregistered';
    els.statusBadge.className = 'badge badge-idle';
    els.registerBtnText.textContent = 'Register Device';
  }
}

// Render token display
function renderDeviceToken() {
  if (state.deviceToken) {
    els.tokenDisplay.textContent = state.deviceToken;
    els.copyTokenBtn.disabled = false;
    els.subscribeBtn.disabled = false;
  } else {
    els.tokenDisplay.textContent = 'No device token registered yet. Click "Register Device" above.';
    els.copyTokenBtn.disabled = true;
    els.subscribeBtn.disabled = true;
  }
}

// Render topic badges
function renderTopics() {
  els.topicsList.innerHTML = '';
  els.testChannelSelect.innerHTML = '';

  if (state.subscribedTopics.length === 0) {
    els.noTopicsMsg.classList.remove('hidden');
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- No subscribed channels yet --';
    els.testChannelSelect.appendChild(opt);
    return;
  }

  els.noTopicsMsg.classList.add('hidden');

  state.subscribedTopics.forEach(topic => {
    // Add badge
    const badge = document.createElement('div');
    badge.className = 'topic-tag inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium mr-2 mb-2 shadow-sm';
    badge.innerHTML = `
      <span>📢 #${topic}</span>
      <button data-topic="${topic}" class="ml-2 text-indigo-300 hover:text-white text-xs font-bold transition focus:outline-none" title="Unsubscribe">&times;</button>
    `;
    badge.querySelector('button').onclick = () => unsubscribeTopic(topic);
    els.topicsList.appendChild(badge);

    // Add to test dropdown
    const opt = document.createElement('option');
    opt.value = topic;
    opt.textContent = `#${topic}`;
    els.testChannelSelect.appendChild(opt);
  });
}

// Register device with Pushy
async function registerDevice() {
  const appId = els.appIdInput.value.trim();
  if (!appId) {
    showToast('Please enter your Pushy App ID first.', 'warning');
    els.appIdInput.focus();
    return;
  }

  if (typeof Pushy === 'undefined') {
    showToast('Pushy SDK is not loaded.', 'danger');
    return;
  }

  state.appId = appId;
  localStorage.setItem(STORAGE_KEYS.APP_ID, appId);

  els.registerBtn.disabled = true;
  els.registerSpinner.classList.remove('hidden');
  els.registerBtnText.textContent = 'Registering...';

  if (els.registrationErrorBox) els.registrationErrorBox.classList.add('hidden');

  try {
    // Pushy.register requests notification permission and returns device token
    const token = await Pushy.register({ appId: appId });
    console.log('Pushy device token:', token);
    
    state.deviceToken = token;
    localStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, token);

    updatePermissionBadge();
    updateStatusBadge();
    renderDeviceToken();

    showToast('Device registered successfully!', 'success');
    setupPushyNotificationListener();
  } catch (err) {
    console.error('Registration failed:', err);
    const errorDetails = err.stack || err.message || String(err);
    
    if (els.registrationErrorBox && els.errorLogContent) {
      els.registrationErrorBox.classList.remove('hidden');
      els.errorLogContent.textContent = errorDetails;
      if (els.errorTimestamp) {
        els.errorTimestamp.textContent = new Date().toLocaleTimeString();
      }
    }

    // Report client error to server for persistent logging
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: 'Device registration failed: ' + (err.message || err),
        details: {
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
          errorName: err.name,
          errorMsg: err.message,
          stack: err.stack,
          appId: appId
        }
      })
    }).catch(() => {});

    showToast(`Registration failed: ${err.message || err}`, 'danger');
    updatePermissionBadge();
    updateStatusBadge();
  } finally {
    els.registerBtn.disabled = false;
    els.registerSpinner.classList.add('hidden');
    els.registerBtnText.textContent = state.deviceToken ? 'Re-Register Device' : 'Register Device';
  }
}

// Subscribe to a topic/channel
async function subscribeTopic() {
  const channel = els.channelInput.value.trim();
  if (!channel) {
    showToast('Please enter a channel name to subscribe.', 'warning');
    return;
  }

  // Topic validation: [a-zA-Z0-9-_.]{1,100}
  const topicRegex = /^[a-zA-Z0-9-_.]+$/;
  if (!topicRegex.test(channel) || channel.length > 100) {
    showToast('Channel name can only contain letters, numbers, hyphens, underscores, and dots (max 100 chars).', 'warning');
    return;
  }

  if (state.subscribedTopics.includes(channel)) {
    showToast(`Already subscribed to #${channel}`, 'info');
    return;
  }

  els.subscribeBtn.disabled = true;
  els.subscribeSpinner.classList.remove('hidden');

  try {
    if (typeof Pushy !== 'undefined' && Pushy.isRegistered()) {
      await Pushy.subscribe(channel);
    } else {
      showToast('Device not registered yet. Please click Register Device first.', 'warning');
      return;
    }

    state.subscribedTopics.push(channel);
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(state.subscribedTopics));
    renderTopics();
    els.channelInput.value = '';
    showToast(`Successfully subscribed to #${channel}!`, 'success');
  } catch (err) {
    console.error('Subscribe failed:', err);
    showToast(`Subscription failed: ${err.message || err}`, 'danger');
  } finally {
    els.subscribeBtn.disabled = false;
    els.subscribeSpinner.classList.add('hidden');
  }
}

// Unsubscribe from a topic
async function unsubscribeTopic(topic) {
  if (!confirm(`Unsubscribe from channel #${topic}?`)) return;

  const apiKey = state.secretApiKey;
  if (!state.deviceToken) {
    showToast('Device token is required to unsubscribe.', 'warning');
    return;
  }

  try {
    // Call backend API which invokes Pushy Pub/Sub unsubscribe endpoint
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.deviceToken,
        topics: [topic],
        apiKey: apiKey || undefined
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to unsubscribe');
    }

    state.subscribedTopics = state.subscribedTopics.filter(t => t !== topic);
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(state.subscribedTopics));
    renderTopics();
    showToast(`Unsubscribed from #${topic}`, 'info');
  } catch (err) {
    console.error('Unsubscribe error:', err);
    // If backend key isn't configured, offer to remove locally
    if (confirm(`Unsubscribe API error: ${err.message}.\nRemove #${topic} from local display list?`)) {
      state.subscribedTopics = state.subscribedTopics.filter(t => t !== topic);
      localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(state.subscribedTopics));
      renderTopics();
    }
  }
}

// Configure Pushy notification listener (foreground)
function setupPushyNotificationListener() {
  Pushy.setNotificationListener(data => {
    console.log('Incoming Pushy Notification:', data);

    const title = data.title || 'Incoming Push Notification';
    const message = data.message || JSON.stringify(data);

    // Add to activity log
    addNotificationToFeed({
      title,
      message,
      data,
      timestamp: new Date().toLocaleTimeString()
    });

    showToast(`🔔 ${title}: ${message}`, 'info');
  });
}

// Add notification to live log
function addNotificationToFeed(item) {
  state.notifications.unshift(item);
  els.noNotificationsMsg.classList.add('hidden');

  const card = document.createElement('div');
  card.className = 'p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5 animate-pulse';
  card.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="font-semibold text-indigo-300 text-sm">${escapeHtml(item.title)}</span>
      <span class="text-xs text-slate-500">${item.timestamp}</span>
    </div>
    <p class="text-sm text-slate-300">${escapeHtml(item.message)}</p>
    <details class="text-xs text-slate-400 mt-1 cursor-pointer">
      <summary class="hover:text-slate-200">Raw Payload</summary>
      <pre class="code-block p-2 text-xs mt-1 overflow-x-auto text-emerald-400">${escapeHtml(JSON.stringify(item.data, null, 2))}</pre>
    </details>
  `;

  els.notificationsList.prepend(card);
  setTimeout(() => card.classList.remove('animate-pulse'), 1000);
}

// Helper to escape HTML to prevent XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Send test notification via backend
async function sendTestNotification() {
  const selectedChannel = els.testChannelSelect.value;
  if (!selectedChannel) {
    showToast('Please select or subscribe to a channel first.', 'warning');
    return;
  }

  const title = els.testTitleInput.value.trim() || 'Broadcast Announcement';
  const message = els.testMessageInput.value.trim() || 'Testing channel broadcast!';
  const apiKey = els.apiKeyInput.value.trim() || state.secretApiKey;

  els.sendTestBtn.disabled = true;
  els.sendSpinner.classList.remove('hidden');
  els.sendResult.classList.add('hidden');

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: `/topics/${selectedChannel}`,
        title,
        message,
        apiKey: apiKey || undefined,
        payload: {
          channel: selectedChannel,
          source: 'Pushy Web Test App'
        }
      })
    });

    const data = await res.json();
    els.sendResult.classList.remove('hidden');

    if (!res.ok || !data.success) {
      els.sendResult.className = 'mt-3 p-3 rounded-lg text-xs bg-rose-950/60 border border-rose-800 text-rose-300';
      els.sendResult.innerHTML = `<strong>Failed:</strong> ${escapeHtml(data.error || 'Unknown error')}`;
      showToast('Push dispatch failed: ' + (data.error || 'Unknown error'), 'danger');
    } else {
      els.sendResult.className = 'mt-3 p-3 rounded-lg text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-300';
      els.sendResult.innerHTML = `<strong>Sent!</strong> Broadcast dispatched to <code>/topics/${selectedChannel}</code>. Pushy ID: <code>${data.data?.id || 'OK'}</code>`;
      showToast(`Broadcast sent to #${selectedChannel}!`, 'success');
    }
  } catch (err) {
    els.sendResult.classList.remove('hidden');
    els.sendResult.className = 'mt-3 p-3 rounded-lg text-xs bg-rose-950/60 border border-rose-800 text-rose-300';
    els.sendResult.innerHTML = `<strong>Error:</strong> ${escapeHtml(err.message)}`;
    showToast('Error sending push: ' + err.message, 'danger');
  } finally {
    els.sendTestBtn.disabled = false;
    els.sendSpinner.classList.add('hidden');
  }
}

// Set up UI event listeners
function setupEventListeners() {
  els.saveAppIdBtn.onclick = () => {
    const id = els.appIdInput.value.trim();
    if (!id) return showToast('Please enter an App ID', 'warning');
    state.appId = id;
    localStorage.setItem(STORAGE_KEYS.APP_ID, id);
    showToast('App ID saved!', 'success');
  };

  els.saveApiKeyBtn.onclick = () => {
    const key = els.apiKeyInput.value.trim();
    state.secretApiKey = key;
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
    showToast(key ? 'Secret API Key saved locally!' : 'Secret API Key cleared', 'info');
  };

  els.registerBtn.onclick = registerDevice;

  els.copyTokenBtn.onclick = () => {
    if (!state.deviceToken) return;
    navigator.clipboard.writeText(state.deviceToken).then(() => {
      showToast('Device token copied to clipboard!', 'info');
    });
  };

  els.subscribeBtn.onclick = subscribeTopic;
  els.channelInput.onkeydown = (e) => {
    if (e.key === 'Enter') subscribeTopic();
  };

  els.sendTestBtn.onclick = sendTestNotification;

  els.clearLogBtn.onclick = () => {
    state.notifications = [];
    els.notificationsList.innerHTML = '';
    els.noNotificationsMsg.classList.remove('hidden');
    showToast('Notification log cleared', 'info');
  };
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', init);
