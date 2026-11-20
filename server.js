const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Explicitly serve service-worker.js with correct MIME type and scope header
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to log client-side diagnostics and errors
app.post('/api/client-log', (req, res) => {
  const { level, message, details, time } = req.body;
  const timestamp = time || new Date().toISOString();
  console.log(`[CLIENT ${level ? level.toUpperCase() : 'INFO'}] ${timestamp} - ${message}`, details || '');
  res.json({ received: true });
});

// Retrieve default configuration (e.g. if set via environment variables)
app.get('/api/config', (req, res) => {
  res.json({
    appId: process.env.PUSHY_APP_ID || '',
    hasServerApiKey: Boolean(process.env.PUSHY_SECRET_API_KEY)
  });
});

// Endpoint to send push notifications to a topic or device token
app.post('/api/send', async (req, res) => {
  const { to, title, message, apiKey: clientApiKey, payload } = req.body;
  const apiKey = clientApiKey || process.env.PUSHY_SECRET_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Pushy Secret API Key is required. Provide it in the request or set PUSHY_SECRET_API_KEY in .env.'
    });
  }

  if (!to) {
    return res.status(400).json({
      success: false,
      error: 'Target "to" parameter is required (e.g., "/topics/news" or a device token).'
    });
  }

  const notificationTitle = title || 'Pushy Notification';
  const notificationBody = message || 'Hello from Pushy Channel!';

  const postData = {
    to: to,
    data: {
      title: notificationTitle,
      message: notificationBody,
      timestamp: new Date().toISOString(),
      ...(payload && typeof payload === 'object' ? payload : {})
    },
    notification: {
      title: notificationTitle,
      body: notificationBody,
      badge: 1,
      sound: 'default'
    }
  };

  try {
    const pushyResponse = await fetch(`https://api.pushy.me/push?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    const result = await pushyResponse.json();

    if (!pushyResponse.ok || result.error) {
      return res.status(pushyResponse.status || 400).json({
        success: false,
        error: result.error || 'Failed to dispatch notification via Pushy'
      });
    }

    res.json({
      success: true,
      data: result,
      target: to
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while dispatching notification'
    });
  }
});

// Endpoint to unsubscribe a token from a topic via Pushy Pub/Sub backend API
app.post('/api/unsubscribe', async (req, res) => {
  const { token, topics, apiKey: clientApiKey } = req.body;
  const apiKey = clientApiKey || process.env.PUSHY_SECRET_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Pushy Secret API Key is required to unsubscribe via the backend API.'
    });
  }

  if (!token || !topics || !Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Device token and an array of topics are required.'
    });
  }

  try {
    const pushyResponse = await fetch(`https://api.pushy.me/topics/unsubscribe?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, topics })
    });

    const result = await pushyResponse.json();

    if (!pushyResponse.ok || result.error) {
      return res.status(pushyResponse.status || 400).json({
        success: false,
        error: result.error || 'Failed to unsubscribe via Pushy Pub/Sub API'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while unsubscribing'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Pushy Web App running at http://localhost:${PORT}`);
});
