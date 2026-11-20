# Pushy Web Push Notification & Channel Subscription App

A complete, production-ready web application demonstrating how to register a web browser device with [Pushy](https://pushy.me) and subscribe to pub/sub channels (topics) for targeted push notifications.

---

## Features

- **Pushy Web SDK Integration**: Automatically prompts for web push permissions and retrieves unique device tokens via `Pushy.register({ appId })`.
- **Channel / Topic Subscriptions**: Subscribe visitors to any topic (e.g. `news`, `alerts`, `dev-team`) using `Pushy.subscribe(channel)`.
- **Foreground & Background Notifications**: Receives real-time foreground notifications via `Pushy.setNotificationListener` and background notifications via the service worker (`service-worker.js`).
- **Live Activity Feed**: Displays received push notifications with a collapsible JSON payload inspector and timestamps.
- **Built-in Channel Dispatcher**: Dispatch test broadcast notifications directly from the UI to all devices subscribed to a channel using Pushy's REST Send API.
- **Unsubscribe Support**: Easily opt out or remove subscriptions from topics.
- **Local State Persistence**: Remembers your App ID, device token, and subscribed channels across page reloads.

---

## Prerequisites

1. **Pushy Account**: Create a free account at [https://dashboard.pushy.me](https://dashboard.pushy.me).
2. **Pushy App**:
   - In your dashboard, click **Create App**.
   - Note down your **App ID** (from the dashboard URL or App Settings).
   - In App Settings &rarr; **API Keys**, note down your **Secret API Key** (for server-side broadcast dispatching).
   - In App Settings &rarr; **Web Push**, configure your domain or use `http://localhost:3000` for local development.

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   cd pushy-web-app
   npm install
   ```

2. **Configure Environment (Optional)**:
   You can either configure your App ID and Secret Key in the `.env` file or directly in the web UI:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   PORT=3000
   PUSHY_APP_ID=your_pushy_app_id_here
   PUSHY_SECRET_API_KEY=your_secret_api_key_here
   ```

3. **Start the Application**:
   ```bash
   npm start
   ```

4. **Open in Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## How to Test Step-by-Step

1. **Enter App ID**:
   - Paste your **Pushy App ID** into Section 1 and click **Save**.
2. **Register Device**:
   - Click **Register Device** in Section 2.
   - When prompted by your browser, click **Allow** for notifications.
   - You will see the **Device Status** turn green (*Registered*) and your unique **Pushy Device Token** will appear in the box.
3. **Subscribe to a Channel**:
   - In Section 3, enter a channel name (e.g. `announcements` or `general`) and click **Subscribe**.
   - The channel will appear as an active badge under *Subscribed Channels*.
4. **Broadcast a Test Notification**:
   - In Section 4 (*Channel Broadcast Dispatcher*), select your subscribed channel (`#announcements`).
   - Enter your Pushy Secret API Key (if not already set in `.env`).
   - Click **Broadcast to Channel**.
5. **View Results**:
   - The browser will display the notification.
   - The notification payload will be logged immediately in Section 5 (*Live Received Notifications*) with expandable payload details!

---

## Deploy to AWS Elastic Beanstalk via AWS CLI

Deploying through the AWS CLI is automated with [`deploy-aws-beanstalk.sh`](file:///Users/sathyasundaramppachaiappan/wrkspace/pushy-web-app/deploy-aws-beanstalk.sh).

### 1. Requirements
- **AWS CLI v2** configured with your credentials:
  ```bash
  aws configure
  ```

### 2. Deploy
Run the deployment script:
```bash
./deploy-aws-beanstalk.sh
```

What the script does:
1. Validates your AWS CLI authentication.
2. Creates the EC2 IAM Instance Profile (`aws-elasticbeanstalk-ec2-role`) with `AWSElasticBeanstalkWebTier`.
3. Packages application files into a versioned `.zip` archive (including `.ebextensions/`).
4. Creates/locates the regional Elastic Beanstalk S3 storage bucket.
5. Uploads the zip archive and registers an Elastic Beanstalk Application Version.
6. Auto-detects the latest Node.js platform (Amazon Linux 2023).
7. Provisions (or updates) the environment `pushy-web-env` with your Pushy credentials configured as environment variables.
8. Outputs the live Elastic Beanstalk URL (e.g. `http://pushy-web-env.us-east-1.elasticbeanstalk.com`).

### 3. Monitoring Environment Status
Check health and endpoint:
```bash
aws elasticbeanstalk describe-environments --environment-names pushy-web-env --query "Environments[0].[Status,Health,CNAME]" --output table
```

Stream deployment events:
```bash
aws elasticbeanstalk describe-events --environment-name pushy-web-env --max-items 10
```

