# cf_ai_

<div align="center">

</div>

---

## 🌟 Features

<table>
<tr>
<td width="50%">

### 💬 Core Capabilities
- **🤖 Advanced AI Chat**: Llama 3.3 70B for intelligent conversations
- **🖼️ Vision AI**: Image analysis with Llava 1.5
- **📄 Document Processing**: PDF, TXT, JSON, CSV, MD support
- **🎤 Voice Input**: Speech-to-text integration
- **💾 Persistent Memory**: Durable Objects storage

</td>
<td width="50%">

### 🎨 User Experience
- **📱 Multi-Session Management**: Multiple concurrent chats
- **🌙 Modern UI**: Clean, responsive dark theme
- **🔍 Smart Search**: Context-aware responses
- **🌐 External Tools**: Weather & web search
- **⚡ Edge Computing**: Sub-100ms response times

</td>
</tr>
</table>

## 🎥 Demo

### Screenshots
<img width="1439" height="817" alt="Ekran Resmi 2025-10-24 00 08 44" src="https://github.com/user-attachments/assets/c06e6997-8d51-4b5f-b08c-93009860b5a5" />


**Chat Interface**
```
┌─────────────────────────────────────────────┐
│  🤖 AI Chat Assistant                       │
│  ─────────────────────────────────────────  │
│  [Sidebar]         [Chat Area]              │
│  • New Chat        User: Hello!             │
│  • Project X       AI: Hi! How can I help?  │
│  • Resume Help     [Image Preview]          │
│                    [File Attachment]        │
│  [➕ New Chat]     ────────────────────     │
│                    [📎] [🎤] [Send]         │
└─────────────────────────────────────────────┘
```

### Live Demo

🔗 **Deployed Application**: `https://cf-ai-.your-subdomain.workers.dev`

> ⚠️ **Note**: Replace with your actual deployment URL after running `wrangler deploy`

**Try it out:**
1. Visit the deployed URL
2. Start chatting with the AI
3. Upload an image or document
4. Test voice input (Chrome/Edge recommended)

---

## 🏗️ Architecture

### System Overview

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Browser    │─────▶│ Cloudflare Edge  │─────▶│  Workers AI │
│  (Frontend)  │      │   (Worker)       │      │  (Llama 3.3)│
└──────────────┘      └──────────────────┘      └─────────────┘
                              │
                              ├─────▶ Vision AI (Llava 1.5)
                              │
                              ├─────▶ Durable Objects
                              │       ├─ ChatSessions
                              │       └─ ChatHistory
                              │
                              └─────▶ External APIs
                                      ├─ Weather
                                      └─ Search
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Cloudflare Workers | Edge computing, request handling |
| **Primary LLM** | Llama 3.3 70B | Text generation and chat |
| **Vision AI** | Llava 1.5 7B | Image analysis and OCR |
| **State Management** | Durable Objects | Persistent storage |
| **Frontend** | HTML/CSS/JS | User interface |
| **Language** | TypeScript | Type-safe development |

### Key Components

#### 1. **LLM Integration**
```typescript
// Primary Model
@cf/meta/llama-3.3-70b-instruct-fp8-fast
- Context window: 128K tokens
- Response generation: ~2-5 seconds
- Temperature: 0.7 (balanced creativity)

// Vision Model
@cf/llava-hf/llava-1.5-7b-hf
- Image understanding
- Text extraction from images
- Visual question answering
```

#### 2. **State Management**
- **ChatSessions DO**: Global session registry
  - Session metadata (name, timestamps)
  - Last message preview
  - Session switching logic

- **ChatHistory DO**: Per-session message storage
  - Rolling 50-message window
  - User context tracking
  - Conversation history

#### 3. **File Processing Pipeline**
```
Upload → Base64 Encode → Type Detection →
  ├─ Image → Vision AI → Analysis
  ├─ Text  → Direct Extract → Content
  ├─ PDF   → Text Extract → Content
  └─ Other → Format Handler → Processing
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 16+** installed ([Download](https://nodejs.org/))
- ✅ **npm** or **yarn** package manager
- ✅ **Cloudflare account** (free tier works!) ([Sign up](https://dash.cloudflare.com/sign-up))
- ✅ **Git** for version control

### Quick Installation (5 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/damlakosee/cf_ai_.git
cd cf_ai_

# 2. Install dependencies
npm install

# 3. Install Wrangler CLI (if not already installed)
npm install -g wrangler

# 4. Authenticate with Cloudflare
wrangler login

# 5. Deploy to Cloudflare
wrangler deploy
```

That's it! Your app is now live on Cloudflare's edge network. 🎉

### Detailed Setup

#### Step 1: Project Setup

```bash
# Clone and enter directory
git clone https://github.com/damlakosee/cf_ai_.git
cd cf_ai_

# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

#### Step 2: Configure Cloudflare

The `wrangler.toml` file is already configured:

```toml
name = "cf-ai-chat-assistant"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[ai]
binding = "AI"

[[durable_objects.bindings]]
name = "CHAT_HISTORY"
class_name = "ChatHistory"
script_name = "cf-ai-chat-assistant"

[[durable_objects.bindings]]
name = "CHAT_SESSIONS"
class_name = "ChatSessions"
script_name = "cf-ai-chat-assistant"

[[migrations]]
tag = "v1"
new_classes = ["ChatHistory", "ChatSessions"]
```

**Optional Configuration:**

```toml
# Add to wrangler.toml for additional features
[vars]
WEATHER_API_KEY = "your-openweathermap-key"
SEARCH_API_KEY = "your-bing-search-key"
```

#### Step 3: Enable Workers AI

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **AI**
3. Click **Enable Workers AI** (free tier includes 10,000 neurons/day)

#### Step 4: Deploy

```bash
# Deploy to production
wrangler deploy

# You'll see output like:
# ✨ Uploaded cf-ai-chat-assistant (X.XX sec)
# ✨ Published cf-ai-chat-assistant (X.XX sec)
#   https://cf-ai-chat-assistant.your-subdomain.workers.dev
```

### Local Development

```bash
# Start development server
npm run dev
# or
wrangler dev

# Access at: http://localhost:8787
```

**Development Features:**
- 🔄 Hot reload on code changes
- 📊 Real-time logs in terminal
- 🧪 Test with local environment
- 🔗 Remote AI bindings (uses actual Workers AI)

---

## 📖 Usage Guide

### Basic Chat

1. **Send a message**: Type in the input box and press Enter or click "Send"
2. **Get AI response**: Wait 2-5 seconds for intelligent reply
3. **Continue conversation**: AI remembers context from previous messages

**Example Conversations:**
```
User: What is machine learning?
AI: Machine learning is a subset of artificial intelligence...

User: Can you explain it with an example?
AI: [Remembers context and provides relevant example]
```

### Image Analysis

**How to use:**
1. Click the 📎 attachment button
2. Select an image file (JPG, PNG, GIF, WebP)
3. Optionally add a question
4. Click "Send"

**What you can do:**
- 📸 Describe image contents
- 📝 Extract text from images (OCR)
- 🔍 Identify objects and scenes
- 🎨 Analyze colors and composition
- 👥 Detect people and expressions

**Example:**
```
[Upload image of a receipt]
User: Extract the total amount
AI: The receipt shows a total of $47.89 paid on 10/23/2024...
```

### Document Processing

**Supported formats:**
- 📄 **Text**: .txt, .md, .log
- 📊 **Data**: .json, .csv, .tsv
- 📋 **Documents**: .pdf, .doc, .docx
- 💻 **Code**: .js, .ts, .py, .java, .cpp, .html, .css

**How to use:**
1. Click 📎 and select a document
2. Ask questions about the content
3. Get intelligent analysis

**Example:**
```
[Upload resume.pdf]
User: Analyze this resume and suggest improvements
AI: This resume shows 5 years of experience in software development.
     Strengths: Clear project descriptions, quantified achievements
     Suggestions: Add more technical skills, expand education section...
```

### Voice Input

**Requirements:**
- Chrome or Edge browser
- Microphone permissions

**How to use:**
1. Click the 🎤 microphone button
2. Allow microphone access (first time only)
3. Speak your message
4. Message is automatically sent after speech ends

**Tips:**
- Speak clearly and at normal pace
- Wait for the red indicator to show listening
- Works best in quiet environments

### Session Management

**Create New Chat:**
```
Click "➕ New Chat" → Fresh conversation starts
```

**Switch Between Chats:**
```
Click any chat in sidebar → Load that conversation
```

**Rename Chat:**
```
Click ✏️ button → Enter new name → Save
```

**Delete Chat:**
```
Click 🗑️ button → Confirm → Chat removed
```

**Clear History:**
```
Click "🗑️ Clear" in header → Confirm → Messages deleted
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Files

- `test/index.spec.ts` - Main test suite
- `test/index.spec.with-mocks.ts` - Advanced mocked tests

### Writing Tests

```typescript
import { env, createExecutionContext } from 'cloudflare:test';

it('handles chat request', async () => {
  const request = new Request('http://example.com/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Hello' })
  });
  
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  
  expect(response.status).toBe(200);
});
```

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

---

## 📁 Project Structure

```
cf_ai_/
├── src/
│   └── index.ts              # Main Worker code (1,802 lines)
│       ├── Durable Objects   # ChatHistory, ChatSessions
│       ├── AI Integration    # Llama, Llava
│       ├── File Processing   # Image/document handling
│       ├── API Endpoints     # /api/chat, /api/sessions
│       └── Frontend HTML     # Complete UI
│
├── test/
│   ├── index.spec.ts         # Test suite
│   └── *.test.ts             # Additional tests
│
├── wrangler.toml             # Cloudflare configuration
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── vitest.config.ts          # Test configuration
│
├── README.md                 # This file
```

---

## 🔧 Configuration

### Environment Variables

Add these to `wrangler.toml` for extended functionality:

```toml
[vars]
WEATHER_API_KEY = "your-key-here"    # Optional: OpenWeatherMap API
SEARCH_API_KEY = "your-key-here"     # Optional: Bing Search API
```

**Get API Keys:**
- Weather: [OpenWeatherMap](https://openweathermap.org/api)
- Search: [Bing Web Search API](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api)

### Customization

**Change AI Model:**
```typescript
// In src/index.ts, line ~500
const response = await env.AI.run(
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',  // Change this
  { messages, max_tokens: 4096 }
);
```

**Adjust Message History:**
```typescript
// In src/index.ts, line ~135
if (this.messages.length > 50) {  // Change limit
  this.messages = this.messages.slice(-50);
}
```

**Modify File Size Limit:**
```typescript
// In frontend, line ~1591
if (file.size > 10 * 1024 * 1024) {  // 10MB limit
  // Change to desired size
}
```

---

## 🚨 Troubleshooting

### Common Issues

<details>
<summary><b>Issue: "AI model not responding"</b></summary>

**Solution:**
1. Verify Workers AI is enabled in Cloudflare Dashboard
2. Check your account has available AI credits
3. Review logs: `wrangler tail`
</details>

<details>
<summary><b>Issue: "Durable Objects error"</b></summary>

**Solution:**
1. Ensure migrations are applied: `wrangler deploy`
2. Check DO bindings in `wrangler.toml`
3. Verify DO classes are exported in `src/index.ts`
</details>

<details>
<summary><b>Issue: "File upload fails"</b></summary>

**Solution:**
1. Check file size < 10MB
2. Verify file type is supported
3. Ensure file is properly base64 encoded
4. Check browser console for errors
</details>

<details>
<summary><b>Issue: "Voice input not working"</b></summary>

**Solution:**
1. Use Chrome or Edge browser
2. Allow microphone permissions
3. Check for HTTPS (required for mic access)
4. Test microphone in browser settings
</details>

<details>
<summary><b>Issue: "TypeScript errors in tests"</b></summary>

**Solution:**
1. Check `declare module 'cloudflare:test'` in test files
2. Run `npm install` to update dependencies
3. See [ENV_ERROR_FIX.md](./ENV_ERROR_FIX.md)
</details>

### Debug Mode

Enable detailed logging:

```bash
# Development with logs
wrangler dev --log-level debug

# Tail production logs
wrangler tail
```

---

## 📊 Performance

### Benchmarks

| Metric | Performance |
|--------|-------------|
| **Cold Start** | < 50ms |
| **Text Chat Response** | 2-5 seconds |
| **Image Analysis** | 3-7 seconds |
| **File Processing** | 1-5 seconds |
| **Edge Latency** | < 100ms (global) |
| **Concurrent Users** | Unlimited (serverless) |

### Optimization Tips

1. **Reduce response time**: Decrease `max_tokens` in AI calls
2. **Improve cold starts**: Keep worker warm with periodic requests
3. **Optimize file processing**: Limit file size or implement streaming
4. **Cache responses**: Add KV storage for repeated queries

---

## 🌍 Deployment

### Production Deployment

```bash
# Deploy to production
wrangler deploy

# Deploy to specific environment
wrangler deploy --env production

# Deploy with custom name
wrangler deploy --name my-custom-name
```

### Custom Domain

1. Add custom domain in Cloudflare Dashboard
2. Update `wrangler.toml`:
```toml
routes = [
  { pattern = "chat.yourdomain.com/*", custom_domain = true }
]
```
3. Deploy: `wrangler deploy`

### Continuous Deployment

**GitHub Actions:**
```yaml
name: Deploy
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: cloudflare/wrangler-action@2.0.0
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
```
---

## 💰 Cost Estimate

### Free Tier Includes

- ✅ 100,000 Worker requests/day
- ✅ 10,000 AI neurons/day (Workers AI)
- ✅ 1GB Durable Objects storage
- ✅ Unlimited bandwidth

### Paid Tier (if needed)

| Resource | Cost |
|----------|------|
| Additional Workers requests | $0.50 per million |
| Additional AI neurons | $0.01 per 1,000 |
| Additional DO storage | $0.20 per GB/month |

**Estimated monthly cost for moderate usage:** $5-15

---

## 🛣️ Roadmap

### Planned Features

- [ ] 🔐 User authentication with Cloudflare Access
- [ ] 📊 Analytics dashboard
- [ ] 🌐 Multi-language support
- [ ] 📤 Export conversations to PDF/JSON
- [ ] 🎨 Customizable themes
- [ ] 🔌 Plugin system for extensions
- [ ] 📱 Mobile app (React Native)
- [ ] 🤖 Custom AI model training
- [ ] 🔄 Real-time collaboration
- [ ] 📧 Email integration

### Version History

**v1.0.0** (Current)
- ✅ Initial release
- ✅ Basic chat functionality
- ✅ Image and document analysis
- ✅ Session management
- ✅ Voice input

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- Maintain code formatting
- Write clear commit messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 cf_ai_

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

[Full license text...]
```

---

## 🙏 Acknowledgments

- **Cloudflare** for Workers AI and edge infrastructure
- **Meta** for Llama 3.3 model
- **HuggingFace** for Llava vision model

---

## 📞 Support

### Get Help

- 📚 [Documentation](./DEPLOYMENT.md)
- 🧪 [Testing Guide](./TESTING.md)
- 🔧 [Troubleshooting](./ENV_ERROR_FIX.md)
- 💬 [GitHub Issues](https://github.com/damlakose/cf_ai_/issues)
- 🌐 [Cloudflare Community](https://community.cloudflare.com)

### Contact

- **GitHub**: [@damlakosee](https://github.com/damlakosee)
- **Email**: damlakosee147@gmail.com


</div>
