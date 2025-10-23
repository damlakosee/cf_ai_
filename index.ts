export interface Env {
	AI: any;
	CHAT_HISTORY: DurableObjectNamespace;
	CHAT_SESSIONS: DurableObjectNamespace;
	WEATHER_API_KEY?: string;
	SEARCH_API_KEY?: string;
}

// Durable Object for managing all chat sessions
export class ChatSessions {
	private state: DurableObjectState;
	private sessions: Array<{
		id: string;
		name: string;
		lastMessage?: string;
		createdAt: number;
		updatedAt: number;
	}>;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.sessions = [];
	}

	async fetch(request: Request): Promise<Response> {
		if (this.sessions.length === 0) {
			const stored = await this.state.storage.get<any>('sessions');
			if (stored) this.sessions = stored;
		}

		const url = new URL(request.url);
		
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// Get all sessions
		if (url.pathname === '/sessions' && request.method === 'GET') {
			return new Response(JSON.stringify({ sessions: this.sessions }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Create new session
		if (url.pathname === '/sessions' && request.method === 'POST') {
			const body = await request.json() as any;
			const newSession = {
				id: body.id || 'session-' + Math.random().toString(36).substr(2, 9),
				name: body.name || 'New Chat',
				lastMessage: '',
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			this.sessions.unshift(newSession);
			await this.state.storage.put('sessions', this.sessions);
			return new Response(JSON.stringify({ session: newSession }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Update session 
		if (url.pathname === '/sessions' && request.method === 'PUT') {
			const body = await request.json() as any;
			const sessionIndex = this.sessions.findIndex(s => s.id === body.id);
			if (sessionIndex !== -1) {
				if (body.name) this.sessions[sessionIndex].name = body.name;
				if (body.lastMessage !== undefined) this.sessions[sessionIndex].lastMessage = body.lastMessage;
				this.sessions[sessionIndex].updatedAt = Date.now();
				await this.state.storage.put('sessions', this.sessions);
				return new Response(JSON.stringify({ session: this.sessions[sessionIndex] }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}
			return new Response(JSON.stringify({ error: 'Session not found' }), { 
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Delete session
		if (url.pathname === '/sessions' && request.method === 'DELETE') {
			const body = await request.json() as any;
			this.sessions = this.sessions.filter(s => s.id !== body.id);
			await this.state.storage.put('sessions', this.sessions);
			return new Response(JSON.stringify({ success: true }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		return new Response('Not Found', { status: 404 });
		}
}

// Durable Object for persistent memory and state
export class ChatHistory {
	private state: DurableObjectState;
	private messages: Array<{ role: string; content: string; timestamp: number }>;
	private userContext: {
		name?: string;
		preferences?: Record<string, any>;
		lastActivity?: number;
	};

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.messages = [];
		this.userContext = {};
	}

	async fetch(request: Request): Promise<Response> {
		if (this.messages.length === 0) {
			const stored = await this.state.storage.get<any>('messages');
			const context = await this.state.storage.get<any>('userContext');
			if (stored) this.messages = stored;
			if (context) this.userContext = context;
		}

		const url = new URL(request.url);

		if (url.pathname === '/messages') {
			if (request.method === 'GET') {
				return Response.json({ messages: this.messages, context: this.userContext });
			}

			if (request.method === 'POST') {
				const body = await request.json() as any;
				this.messages.push({
					role: body.role,
					content: body.content,
					timestamp: Date.now()
				});

				if (this.messages.length > 50) {
					this.messages = this.messages.slice(-50);
				}

				await this.state.storage.put('messages', this.messages);
				return Response.json({ success: true });
			}

			if (request.method === 'DELETE') {
				this.messages = [];
				await this.state.storage.delete('messages');
				return Response.json({ success: true });
			}
		}

		if (url.pathname === '/context') {
			if (request.method === 'POST') {
				const body = await request.json() as any;
				this.userContext = { ...this.userContext, ...body };
				this.userContext.lastActivity = Date.now();
				await this.state.storage.put('userContext', this.userContext);
				return Response.json({ success: true });
			}

			if (request.method === 'GET') {
				return Response.json(this.userContext);
			}
		}

		return new Response('Not Found', { status: 404 });
	}
}

// Function to analyze images with enhanced AI vision
async function analyzeImage(env: Env, imageDataUrl: string, userQuestion?: string): Promise<string> {
	try {
		console.log('📸 Starting image analysis...', {
			hasUserQuestion: !!userQuestion,
			dataUrlLength: imageDataUrl.length
		});
		
		const base64Data = imageDataUrl.split(',')[1];
		const binaryString = atob(base64Data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		console.log('📸 Image converted to bytes:', bytes.length);

		// Enhanced prompt based on whether user asked a specific question
		const prompt = userQuestion 
			? `Analyze this image and answer the following question: ${userQuestion}. Provide detailed observations and insights.`
			: "Describe this image in comprehensive detail. Include: objects, people, text visible in the image, colors, setting, actions, emotions, and any other relevant details. If there's text in the image, transcribe it exactly.";

		console.log('📸 Calling vision AI with prompt:', prompt.substring(0, 100) + '...');

		const response = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
			image: Array.from(bytes),
			prompt: prompt,
			max_tokens: 1024,
		});

		console.log('📸 Vision AI response:', response);

		let result = '';
		if (typeof response === 'string') {
			result = response;
		} else if (response.description) {
			result = response.description;
		} else if (response.response) {
			result = response.response;
		} else if (response.text) {
			result = response.text;
		} else {
			result = "Image analyzed successfully.";
		}

		console.log('✅ Image analysis complete:', result.substring(0, 100) + '...');
		return result;
	} catch (error) {
		console.error('❌ Image analysis error:', error);
		return `Image uploaded (analysis unavailable: ${error instanceof Error ? error.message : 'unknown error'}).`;
	}
}

// Enhanced function to extract text from files and images
async function extractTextFromFile(fileName: string, fileDataUrl: string, env: Env, userQuestion?: string): Promise<string> {
	try {
		console.log('📄 Starting file extraction...', {
			fileName,
			hasUserQuestion: !!userQuestion,
			dataUrlLength: fileDataUrl.length
		});

		const extension = fileName.split('.').pop()?.toLowerCase();
		const base64Data = fileDataUrl.split(',')[1];
		
		console.log('📄 File extension:', extension);
		
		// Handle image files - extract text from images using vision AI
		if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension || '')) {
			console.log('📄 Detected as image, using vision AI...');
			const imageAnalysis = await analyzeImage(env, fileDataUrl, userQuestion);
			return `📷 Image file "${fileName}" analysis:\n\n${imageAnalysis}`;
		}
		
		// Handle text-based files
		if (['txt', 'md', 'json', 'csv', 'html', 'xml', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'css', 'yml', 'yaml', 'toml', 'ini', 'log', 'sql', 'sh', 'bash'].includes(extension || '')) {
			console.log('📄 Detected as text file, extracting content...');
			const text = atob(base64Data);
			console.log('📄 Extracted text length:', text.length);
			// Increased limit for better context
			const preview = text.length > 8000 ? text.substring(0, 8000) + '...\n\n[File truncated - showing first 8000 characters]' : text;
			return `📄 File "${fileName}" contents:\n\n${preview}`;
		}
		
		// For PDFs - try basic text extraction
		if (extension === 'pdf') {
			console.log('📄 Detected as PDF - attempting basic extraction');
			try {
				// Simple PDF text extraction - works for text-based PDFs
				const text = atob(base64Data);
				// Try to extract readable text from PDF
				const textMatch = text.match(/[A-Za-z0-9\s\.,;:!?\-'"\(\)]+/g);
				if (textMatch && textMatch.length > 10) {
					const extractedText = textMatch.join(' ').substring(0, 8000);
					if (extractedText.length > 100) {
						console.log('✅ Extracted text from PDF:', extractedText.length, 'chars');
						return `📄 PDF file "${fileName}" content (extracted text):\n\n${extractedText}${extractedText.length === 8000 ? '\n\n[Content truncated - showing first 8000 characters]' : ''}`;
					}
				}
				console.log('⚠️ Could not extract readable text from PDF');
				return `📄 PDF file "${fileName}" uploaded. I can see it's a PDF but couldn't extract the text automatically. Could you tell me what's in the document or copy-paste the text?`;
			} catch (error) {
				console.error('PDF extraction error:', error);
				return `📄 PDF file "${fileName}" uploaded. Please describe what you'd like to know about it.`;
			}
		}
		
		console.log('📄 Unknown file type');
		return `📄 File "${fileName}" uploaded (${extension?.toUpperCase() || 'unknown'} format). Please tell me what you'd like to know about this file.`;
	} catch (error) {
		console.error('❌ File extraction error:', error);
		return `📄 File "${fileName}" received. Please describe what you'd like to know about it.`;
	}
}

// Weather function
async function getWeather(city: string): Promise<string> {
	try {
		const geoResponse = await fetch(
			`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
		);
		const geoData = await geoResponse.json() as any;
		
		if (!geoData.results || geoData.results.length === 0) {
			return `Could not find weather data for ${city}`;
		}
		
		const { latitude, longitude, name, country } = geoData.results[0];
		const weatherResponse = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
		);
		const weatherData = await weatherResponse.json() as any;
		const current = weatherData.current;
		const weatherCodes: Record<number, string> = {
			0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
			45: 'Foggy', 51: 'Light drizzle', 61: 'Light rain', 63: 'Moderate rain',
			65: 'Heavy rain', 80: 'Rain showers', 95: 'Thunderstorm',
		};
		const condition = weatherCodes[current.weather_code] || 'Unknown';
		return `Weather in ${name}, ${country}: ${condition}, Temperature: ${current.temperature_2m}°C, Humidity: ${current.relative_humidity_2m}%, Wind: ${current.wind_speed_10m} km/h`;
	} catch (error) {
		return `Unable to fetch weather data`;
	}
}

// Web search function
async function webSearch(query: string): Promise<string> {
	try {
		const response = await fetch(
			`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
		);
		const data = await response.json() as any;
		
		if (data.AbstractText) {
			return `Search result: ${data.AbstractText}`;
		} else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
			const firstTopic = data.RelatedTopics[0];
			if (firstTopic.Text) {
				return `Search result: ${firstTopic.Text}`;
			}
		}
		return `No information found for: ${query}`;
	} catch (error) {
		return `Unable to search`;
	}
}

// Function to search through chat history
async function searchChatHistory(env: Env, userId: string, query: string): Promise<string> {
	try {
		console.log('Searching chat history for:', query);
		
		// Get all sessions
		const sessionsId = env.CHAT_SESSIONS.idFromName(userId);
		const sessionsStub = env.CHAT_SESSIONS.get(sessionsId);
		const sessionsResponse = await sessionsStub.fetch('https://fake-host/sessions');
		const sessionsData = await sessionsResponse.json() as any;
		const sessions = sessionsData.sessions || [];
		
		if (sessions.length === 0) {
			return "You don't have any saved chats yet.";
		}
		
		// Collect messages from all chats
		let allChatsInfo = '';
		for (const session of sessions.slice(0, 10)) { // Limit to 10 most recent chats
			const historyId = env.CHAT_HISTORY.idFromName(session.id);
			const historyStub = env.CHAT_HISTORY.get(historyId);
			const historyResponse = await historyStub.fetch('https://fake-host/messages');
			const historyData = await historyResponse.json() as any;
			const messages = historyData.messages || [];
			
			if (messages.length > 0) {
				allChatsInfo += `\n\n--- Chat: "${session.name}" (${new Date(session.updatedAt).toLocaleDateString()}) ---\n`;
				messages.forEach((msg: any) => {
					const preview = msg.content.substring(0, 200);
					allChatsInfo += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${preview}${msg.content.length > 200 ? '...' : ''}\n`;
				});
			}
		}
		
		if (!allChatsInfo) {
			return "Your chats don't contain any messages yet.";
		}
		
		return `Here's information from your saved chats:\n${allChatsInfo}`;
	} catch (error) {
		console.error('Error searching chat history:', error);
		return "I encountered an error while searching your chat history.";
	}
}

async function getExternalInfo(message: string, env: Env, p0: string): Promise<string | null> {
	const lowerMessage = message.toLowerCase();
	
	if (lowerMessage.includes('weather') || lowerMessage.includes('temperature')) {
		const cityMatch = message.match(/in\s+([a-zA-Z\s]+?)(?:\?|$|\.)/i);
		if (cityMatch) {
			return await getWeather(cityMatch[1].trim());
		}
	}
	
	if (lowerMessage.includes('time') || lowerMessage.includes('date') || lowerMessage.includes('day')) {
		return `Current date and time: ${new Date().toUTCString()} (UTC)`;
	}
	
	if (lowerMessage.includes('news') || lowerMessage.includes('latest') || lowerMessage.includes('current')) {
		return await webSearch(message);
	}
	
	return null;
}

async function coordinateChat(
	env: Env,
	message: string,
	sessionId: string,
	image?: string,
	fileData?: string,
	fileName?: string
): Promise<string> {
	console.log('🔄 Coordinating chat...', {
		hasMessage: !!message,
		hasImage: !!image,
		hasFile: !!fileData,
		fileName: fileName || 'none'
	});

	const tasks: Promise<any>[] = [];
	
	if (image) {
		console.log('📸 Adding image analysis task...');
		tasks.push(
			analyzeImage(env, image, message) // Pass user message for context
				.then(result => {
					console.log('✅ Image analysis complete');
					return { type: 'image', data: result };
				})
				.catch(error => {
					console.error('❌ Image analysis failed:', error);
					return { type: 'image', data: null };
				})
		);
	}
	
	if (fileData && fileName) {
		console.log('📄 Adding file extraction task...');
		tasks.push(
			extractTextFromFile(fileName, fileData, env, message) // Pass env and message
				.then(result => {
					console.log('✅ File extraction complete');
					return { type: 'file', data: result };
				})
				.catch(error => {
					console.error('❌ File extraction failed:', error);
					return { type: 'file', data: null };
				})
		);
	}
	
	const externalInfoTask = getExternalInfo(message, env, 'user-default');
	if (externalInfoTask) {
		tasks.push(
			externalInfoTask
				.then(result => ({ type: 'external', data: result }))
				.catch(error => ({ type: 'external', data: null }))
		);
	}
	
	const results = await Promise.all(tasks);
	
	const id = env.CHAT_HISTORY.idFromName(sessionId);
	const stub = env.CHAT_HISTORY.get(id);
	const historyResponse = await stub.fetch('https://fake-host/messages');
	const historyData = await historyResponse.json() as any;
	const history = historyData.messages || [];
	
	// Build context from analysis results
	let imageContext = '';
	let fileContext = '';
	let externalContext = '';
	
	results.forEach((result: any) => {
		if (result.data) {
			if (result.type === 'image') {
				imageContext = result.data;
			} else if (result.type === 'file') {
				fileContext = result.data;
			} else if (result.type === 'external') {
				externalContext = result.data;
			}
		}
	});
	
	// Build comprehensive system prompt
	const systemPrompt = `You are a helpful AI assistant with access to file and image analysis capabilities. Current date and time: ${new Date().toUTCString()}.

When users upload files or images, the content is automatically extracted and provided to you in the [FILE CONTENT] or [IMAGE ANALYSIS] sections. You CAN see and analyze this content directly. Respond based on the actual content provided, not as if you cannot access it.${externalContext ? '\n\n' + externalContext : ''}`;
	
	// Build user message with context
	let userMessage = '';
	
	// Add image analysis to user message
	if (imageContext) {
		userMessage += `[IMAGE ANALYSIS]\n${imageContext}\n\n`;
	}
	
	// Add file content to user message
	if (fileContext) {
		userMessage += `[FILE CONTENT]\n${fileContext}\n\n`;
	}
	
	// Add user's question/message
	if (message) {
		if (imageContext || fileContext) {
			userMessage += `[USER'S QUESTION]\n${message}`;
		} else {
			userMessage = message;
		}
	} else if (imageContext || fileContext) {
		// If only file/image with no message
		userMessage += `Please analyze the ${imageContext ? 'image' : 'file'} I've uploaded and provide detailed insights.`;
	}
	
	// Fallback if no message provided
	if (!userMessage) {
		userMessage = "Hello! How can I help you today?";
	}
	
	console.log('🤖 AI Request:', {
		hasImage: !!imageContext,
		hasFile: !!fileContext,
		userMessageLength: userMessage.length,
		imageContextLength: imageContext.length,
		fileContextLength: fileContext.length
	});
	
	const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
		messages: [
			{ role: 'system', content: systemPrompt },
			...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
			{ role: 'user', content: userMessage },
		],
		max_tokens: 4096,
		temperature: 0.7,
	});
	
	if (!response || !response.response) {
		throw new Error('Invalid response from AI');
	}
	
	const aiResponse = response.response;
	
	await stub.fetch('https://fake-host/messages', {
		method: 'POST',
		body: JSON.stringify({ role: 'user', content: userMessage }),
	});
	
	await stub.fetch('https://fake-host/messages', {
		method: 'POST',
		body: JSON.stringify({ role: 'assistant', content: aiResponse }),
	});
	
	return aiResponse;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		// Session management endpoints
		if (url.pathname === '/api/sessions') {
			const userId = 'user-default'; // In production, get from auth
			const id = env.CHAT_SESSIONS.idFromName(userId);
			const stub = env.CHAT_SESSIONS.get(id);
			
			// Create a new request with the correct URL for the Durable Object
			const doRequest = new Request('https://fake-host/sessions', {
				method: request.method,
				headers: request.headers,
				body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
			});
			
			return stub.fetch(doRequest);
		}

		// Chat endpoint
		if (url.pathname === '/api/chat' && request.method === 'POST') {
			return handleChat(request, env, ctx);
		}

		// Get chat history
		if (url.pathname === '/api/history' && request.method === 'GET') {
			const sessionId = url.searchParams.get('sessionId') || 'default';
			const id = env.CHAT_HISTORY.idFromName(sessionId);
			const stub = env.CHAT_HISTORY.get(id);
			return stub.fetch('https://fake-host/messages');
		}

		// Clear chat history
		if (url.pathname === '/api/history' && request.method === 'DELETE') {
			const sessionId = url.searchParams.get('sessionId') || 'default';
			const id = env.CHAT_HISTORY.idFromName(sessionId);
			const stub = env.CHAT_HISTORY.get(id);
			return stub.fetch('https://fake-host/messages', { method: 'DELETE' });
		}

		// Serve the HTML page
		if (url.pathname === '/' || url.pathname === '/index.html') {
			return new Response(getHTML(), {
				headers: { 'Content-Type': 'text/html' },
			});
		}

		return new Response('Not Found', { status: 404 });
	},
};

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	try {
		const body = await request.json() as { 
			message: string; 
			sessionId: string;
			image?: string;
			fileName?: string;
			fileData?: string;
		};
		const { message, sessionId, image, fileName, fileData } = body;
		
		if (!message && !image && !fileData) {
			throw new Error('Message, image, or file is required');
		}

		const aiResponse = await coordinateChat(
			env,
			message || '',
			sessionId,
			image,
			fileData,
			fileName
		);

		// Update session with last message
		const userId = 'user-default';
		const sessionsId = env.CHAT_SESSIONS.idFromName(userId);
		const sessionsStub = env.CHAT_SESSIONS.get(sessionsId);
		await sessionsStub.fetch('https://fake-host/sessions', {
			method: 'PUT',
			body: JSON.stringify({
				id: sessionId,
				lastMessage: message || 'Sent an attachment',
			}),
		});

		return new Response(
			JSON.stringify({
				response: aiResponse,
				sessionId,
			}),
			{
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			}
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('Chat Error:', errorMessage);
		
		return new Response(JSON.stringify({ 
			error: errorMessage,
		}), {
			status: 500,
			headers: { 
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	}
}

function getHTML(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Assistant - Chat History</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a;
            height: 100vh;
            display: flex;
            overflow: hidden;
        }
        
        /* Sidebar */
        .sidebar {
            width: 280px;
            background: #1e293b;
            border-right: 1px solid #334155;
            display: flex;
            flex-direction: column;
            transition: transform 0.3s ease;
        }
        .sidebar.collapsed {
            transform: translateX(-280px);
        }
        .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #334155;
        }
        .new-chat-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.95em;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .new-chat-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .new-chat-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .chat-list {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 8px;
            min-height: 0; /* Important for flex scrolling */
        }
        .chat-list::-webkit-scrollbar {
            width: 6px;
        }
        .chat-list::-webkit-scrollbar-track {
            background: #1e293b;
        }
        .chat-list::-webkit-scrollbar-thumb {
            background: #475569;
            border-radius: 3px;
        }
        .chat-list::-webkit-scrollbar-thumb:hover {
            background: #64748b;
        }
        .chat-item {
            padding: 12px;
            margin-bottom: 4px;
            background: #334155;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .chat-item:hover {
            background: #475569;
        }
        .chat-item.active {
            background: #3b82f6;
            color: white;
        }
        .chat-item-content {
            flex: 1;
            min-width: 0;
        }
        .chat-item-name {
            font-size: 0.9em;
            font-weight: 500;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #e2e8f0;
        }
        .chat-item.active .chat-item-name {
            color: white;
        }
        .chat-item-preview {
            font-size: 0.8em;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .chat-item.active .chat-item-preview {
            color: rgba(255,255,255,0.8);
        }
        .chat-item-actions {
            display: none;
            gap: 4px;
        }
        .chat-item:hover .chat-item-actions {
            display: flex;
        }
        .chat-action-btn {
            padding: 4px 8px;
            background: rgba(0,0,0,0.2);
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s;
        }
        .chat-action-btn:hover {
            background: rgba(0,0,0,0.4);
        }
        
        /* Main Content */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .toggle-sidebar {
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 100;
            background: #334155;
            border: none;
            color: #e2e8f0;
            width: 40px;
            height: 40px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            transition: all 0.2s;
        }
        .toggle-sidebar:hover {
            background: #475569;
        }
        .container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
            padding: 20px;
            height: 100vh; /* Add explicit height */
            max-height: 100vh; /* Prevent overflow */
            overflow: hidden; /* Prevent page scroll */
        }
        .header {
            padding: 20px 24px;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border-radius: 16px 16px 0 0;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .logo { font-size: 2em; }
        .header-content h1 { font-size: 1.4em; font-weight: 600; }
        .header-content p { font-size: 0.85em; opacity: 0.9; margin-top: 4px; }
        .header-actions {
            margin-left: auto;
            display: flex;
            gap: 12px;
        }
        .header-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s;
        }
        .header-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .status-indicator {
            width: 10px;
            height: 10px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 10px #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .chat-area {
            flex: 1;
            background: #1e293b;
            border-radius: 0 0 16px 16px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-height: 0; /* Important for flex scrolling */
            scroll-behavior: smooth;
        }
        .messages::-webkit-scrollbar {
            width: 8px;
        }
        .messages::-webkit-scrollbar-track {
            background: #1e293b;
        }
        .messages::-webkit-scrollbar-thumb {
            background: #475569;
            border-radius: 4px;
        }
        .messages::-webkit-scrollbar-thumb:hover {
            background: #64748b;
        }
        .message-wrapper {
            display: flex;
            gap: 12px;
            max-width: 80%;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message-wrapper.user {
            margin-left: auto;
            flex-direction: row-reverse;
        }
        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            flex-shrink: 0;
        }
        .avatar.user { background: #3b82f6; }
        .avatar.assistant { background: #8b5cf6; }
        .message {
            padding: 12px 16px;
            border-radius: 16px;
            line-height: 1.5;
            word-wrap: break-word;
            white-space: pre-wrap;
        }
        .message.user {
            background: #3b82f6;
            color: white;
            border-bottom-right-radius: 4px;
        }
        .message.assistant {
            background: #334155;
            color: #e2e8f0;
            border-bottom-left-radius: 4px;
        }
        .message.error {
            background: #ef4444;
            color: white;
        }
        .message.system {
            background: #10b981;
            color: white;
            text-align: center;
            padding: 8px 12px;
            font-size: 0.9em;
        }
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 8px;
        }
        .typing-dot {
            width: 8px;
            height: 8px;
            background: #cbd5e1;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
            0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
            30% { opacity: 1; transform: translateY(-8px); }
        }
        .input-area {
            padding: 20px 24px;
            background: #1e293b;
            border-top: 1px solid #475569;
            display: flex;
            gap: 12px;
        }
        .input-wrapper {
            flex: 1;
            display: flex;
            gap: 8px;
            background: #334155;
            border-radius: 24px;
            padding: 4px 4px 4px 20px;
            align-items: center;
        }
        input {
            flex: 1;
            border: none;
            background: transparent;
            color: #e2e8f0;
            font-size: 0.95em;
            padding: 10px 0;
            outline: none;
        }
        input::placeholder { color: #94a3b8; }
        .icon-btn {
            background: transparent;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 1.3em;
            padding: 8px;
            border-radius: 50%;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
        }
        .icon-btn:hover {
            background: #475569;
            color: #e2e8f0;
        }
        .icon-btn.listening {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }
        #send {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 0 24px;
            height: 48px;
            border-radius: 24px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        #send:hover {
            transform: translateY(-1px);
        }
        #send:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .attachment-preview {
            padding: 12px 24px;
            background: #334155;
            border-top: 1px solid #475569;
            display: none;
            align-items: center;
            gap: 12px;
        }
        .attachment-preview.active {
            display: flex;
        }
        .preview-content {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .preview-image {
            max-width: 80px;
            max-height: 80px;
            border-radius: 8px;
            object-fit: cover;
            border: 2px solid #475569;
        }
        .preview-info {
            color: #cbd5e1;
            font-size: 0.9em;
        }
        .preview-name {
            font-weight: 500;
            color: #e2e8f0;
            margin-bottom: 4px;
        }
        .remove-btn {
            background: #ef4444;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s;
        }
        .remove-btn:hover {
            background: #dc2626;
        }
        .file-input {
            display: none;
        }
        
        /* Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        .modal.active {
            display: flex;
        }
        .modal-content {
            background: #1e293b;
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .modal-title {
            font-size: 1.2em;
            color: #e2e8f0;
            margin-bottom: 16px;
        }
        .modal-input {
            width: 100%;
            padding: 12px;
            background: #334155;
            border: 1px solid #475569;
            border-radius: 8px;
            color: #e2e8f0;
            font-size: 0.95em;
            margin-bottom: 16px;
            outline: none;
        }
        .modal-input:focus {
            border-color: #3b82f6;
        }
        .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        .modal-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9em;
            font-weight: 500;
            transition: all 0.2s;
        }
        .modal-btn.primary {
            background: #3b82f6;
            color: white;
        }
        .modal-btn.primary:hover {
            background: #2563eb;
        }
        .modal-btn.secondary {
            background: #475569;
            color: #e2e8f0;
        }
        .modal-btn.secondary:hover {
            background: #64748b;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .sidebar {
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                z-index: 200;
            }
            .toggle-sidebar {
                display: flex;
            }
        }
    </style>
</head>
<body>
    <!-- Sidebar -->
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <button class="new-chat-btn" id="newChatBtn">
                <span>➕</span>
                <span>New Chat</span>
            </button>
        </div>
        <div class="chat-list" id="chatList">
            <!-- Chat items will be added here -->
        </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <button class="toggle-sidebar" id="toggleSidebar">☰</button>
        
        <div class="container">
            <div class="header">
                <div class="logo">🤖</div>
                <div class="header-content">
                    <h1>AI Assistant</h1>
                    <p id="chatTitle">New Chat</p>
                </div>
                <div class="header-actions">
                    <button class="header-btn" id="clearHistory">🗑️ Clear</button>
                    <button class="header-btn" id="renameChat">✏️ Rename</button>
                    <div class="status-indicator"></div>
                </div>
            </div>
            
            <div class="chat-area">
                <div class="messages" id="messages"></div>
                <div class="attachment-preview" id="attachmentPreview">
                    <div class="preview-content">
                        <img id="previewImage" class="preview-image" style="display:none" />
                        <div class="preview-info">
                            <div class="preview-name" id="previewName"></div>
                            <div class="preview-type" id="previewType"></div>
                        </div>
                    </div>
                    <button class="remove-btn" id="removeAttachment">Remove</button>
                </div>
                <div class="input-area">
                    <div class="input-wrapper">
                        <input type="text" id="input" placeholder="Type a message..." />
                        <button class="icon-btn" id="attachBtn" title="Upload file or image">📎</button>
                        <button class="icon-btn" id="voiceBtn" title="Voice input">🎤</button>
                    </div>
                    <button id="send">Send</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Rename Modal -->
    <div class="modal" id="renameModal">
        <div class="modal-content">
            <div class="modal-title">Rename Chat</div>
            <input type="text" class="modal-input" id="renameInput" placeholder="Enter new name..." />
            <div class="modal-actions">
                <button class="modal-btn secondary" id="cancelRename">Cancel</button>
                <button class="modal-btn primary" id="confirmRename">Save</button>
            </div>
        </div>
    </div>

    <input type="file" id="attachInput" class="file-input" accept="image/*,.txt,.pdf,.doc,.docx,.md,.json,.csv,.html,.xml,.js,.ts,.py,.css,.yml,.yaml,.cpp,.c,.java,.sh,.bash,.log,.sql" />

    <script>
        let currentSessionId = 'session-' + Math.random().toString(36).substr(2, 9);
        let currentChatName = 'New Chat';
        let sessions = [];

        const messagesDiv = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        const voiceBtn = document.getElementById('voiceBtn');
        const attachBtn = document.getElementById('attachBtn');
        const clearHistoryBtn = document.getElementById('clearHistory');
        const renameBtn = document.getElementById('renameChat');
        const newChatBtn = document.getElementById('newChatBtn');
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');
        const chatList = document.getElementById('chatList');
        const chatTitle = document.getElementById('chatTitle');
        const attachInput = document.getElementById('attachInput');
        const attachmentPreview = document.getElementById('attachmentPreview');
        const previewImage = document.getElementById('previewImage');
        const previewName = document.getElementById('previewName');
        const previewType = document.getElementById('previewType');
        const removeAttachment = document.getElementById('removeAttachment');
        const renameModal = document.getElementById('renameModal');
        const renameInput = document.getElementById('renameInput');
        const confirmRename = document.getElementById('confirmRename');
        const cancelRename = document.getElementById('cancelRename');

        let currentAttachment = null;
        let attachmentType = null;
        let attachmentFileName = null;

        // Initialize on page load
        window.addEventListener('load', async () => {
            await loadSessions();
            
            // If no sessions exist, create first one
            if (sessions.length === 0) {
                await createNewSession();
            } else {
                // Load the most recent session
                currentSessionId = sessions[0].id;
                currentChatName = sessions[0].name;
                chatTitle.textContent = currentChatName;
                await loadChatHistory(currentSessionId);
            }
        });

        // Toggle sidebar
        toggleSidebarBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        // Load all sessions
        async function loadSessions() {
            try {
                const response = await fetch('/api/sessions');
                const data = await response.json();
                sessions = data.sessions || [];
                console.log('Loaded sessions:', sessions.length);
                renderChatList();
            } catch (error) {
                console.error('Failed to load sessions:', error);
                sessions = [];
            }
        }

        // Render chat list
        function renderChatList() {
            chatList.innerHTML = '';
            sessions.forEach(session => {
                const item = document.createElement('div');
                item.className = 'chat-item' + (session.id === currentSessionId ? ' active' : '');
                item.innerHTML = \`
                    <div class="chat-item-content">
                        <div class="chat-item-name">\${session.name}</div>
                        <div class="chat-item-preview">\${session.lastMessage || 'No messages yet'}</div>
                    </div>
                    <div class="chat-item-actions">
                        <button class="chat-action-btn" onclick="renameSession('\${session.id}')">✏️</button>
                        <button class="chat-action-btn" onclick="deleteSession('\${session.id}')">🗑️</button>
                    </div>
                \`;
                item.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('chat-action-btn')) {
                        switchToSession(session.id);
                    }
                });
                chatList.appendChild(item);
            });
        }

        // Create new session
        async function createNewSession() {
            try {
                console.log('Creating new chat session...');
                
                const newId = 'session-' + Math.random().toString(36).substr(2, 9);
                const response = await fetch('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: newId, name: 'New Chat' })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to create session');
                }
                
                const data = await response.json();
                console.log('New session created:', data.session);
                
                // Add to sessions list
                sessions.unshift(data.session);
                
                // Switch to new session
                currentSessionId = data.session.id;
                currentChatName = data.session.name;
                
                // Update UI
                renderChatList();
                messagesDiv.innerHTML = '';
                chatTitle.textContent = currentChatName;
                
                // Add welcome message
                addMessage('Hello! How can I assist you today?', 'assistant', false);
                
                // Focus input
                input.focus();
                
                console.log('Switched to new chat:', currentSessionId);
            } catch (error) {
                console.error('Failed to create session:', error);
                addMessage('❌ Failed to create new chat. Please try again.', 'error');
            }
        }

        newChatBtn.addEventListener('click', async () => {
            // Disable button during creation
            newChatBtn.disabled = true;
            newChatBtn.innerHTML = '<span>⏳</span><span>Creating...</span>';
            
            await createNewSession();
            
            // Re-enable button
            newChatBtn.disabled = false;
            newChatBtn.innerHTML = '<span>➕</span><span>New Chat</span>';
        });

        // Switch to session
        async function switchToSession(sessionId) {
            currentSessionId = sessionId;
            const session = sessions.find(s => s.id === sessionId);
            if (session) {
                currentChatName = session.name;
                chatTitle.textContent = currentChatName;
            }
            renderChatList();
            messagesDiv.innerHTML = '';
            await loadChatHistory(sessionId);
        }

        // Load chat history
        async function loadChatHistory(sessionId) {
            try {
                const response = await fetch(\`/api/history?sessionId=\${sessionId}\`);
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        addMessage(msg.content, msg.role, false);
                    });
                } else {
                    addMessage('Hello! How can I assist you today?', 'assistant', false);
                }
            } catch (error) {
                console.error('Failed to load history:', error);
            }
        }

        // Rename session
        window.renameSession = function(sessionId) {
            const session = sessions.find(s => s.id === sessionId);
            if (session) {
                currentSessionId = sessionId;
                renameInput.value = session.name;
                renameModal.classList.add('active');
                renameInput.focus();
            }
        };

        renameBtn.addEventListener('click', () => {
            renameInput.value = currentChatName;
            renameModal.classList.add('active');
            renameInput.focus();
        });

        confirmRename.addEventListener('click', async () => {
            const newName = renameInput.value.trim();
            if (newName) {
                try {
                    await fetch('/api/sessions', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: currentSessionId, name: newName })
                    });
                    currentChatName = newName;
                    chatTitle.textContent = newName;
                    const session = sessions.find(s => s.id === currentSessionId);
                    if (session) session.name = newName;
                    renderChatList();
                    renameModal.classList.remove('active');
                } catch (error) {
                    console.error('Failed to rename:', error);
                }
            }
        });

        cancelRename.addEventListener('click', () => {
            renameModal.classList.remove('active');
        });

        renameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmRename.click();
        });

        // Delete session
        window.deleteSession = async function(sessionId) {
            if (confirm('Delete this chat?')) {
                try {
                    await fetch('/api/sessions', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: sessionId })
                    });
                    sessions = sessions.filter(s => s.id !== sessionId);
                    if (sessionId === currentSessionId) {
                        if (sessions.length > 0) {
                            await switchToSession(sessions[0].id);
                        } else {
                            await createNewSession();
                        }
                    }
                    renderChatList();
                } catch (error) {
                    console.error('Failed to delete:', error);
                }
            }
        };

        // Clear history
        clearHistoryBtn.addEventListener('click', async () => {
            if (confirm('Clear this chat history?')) {
                try {
                    await fetch(\`/api/history?sessionId=\${currentSessionId}\`, { method: 'DELETE' });
                    messagesDiv.innerHTML = '';
                    addMessage('Chat cleared! How can I help you?', 'system');
                } catch (error) {
                    console.error('Failed to clear:', error);
                }
            }
        });

        // Speech recognition
        let recognition = null;
        let isListening = false;

        function initSpeechRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                voiceBtn.style.display = 'none';
                return false;
            }

            try {
                recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                recognition.onstart = () => {
                    isListening = true;
                    voiceBtn.classList.add('listening');
                };

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    input.value = transcript;
                    setTimeout(() => sendMessage(), 500);
                };

                recognition.onerror = (event) => {
                    isListening = false;
                    voiceBtn.classList.remove('listening');
                    if (event.error === 'not-allowed') {
                        addMessage('❌ Microphone access denied.', 'error');
                    }
                };

                recognition.onend = () => {
                    isListening = false;
                    voiceBtn.classList.remove('listening');
                };

                return true;
            } catch (error) {
                voiceBtn.style.display = 'none';
                return false;
            }
        }

        initSpeechRecognition();

        voiceBtn.addEventListener('click', async () => {
            if (!recognition) return;
            if (isListening) {
                recognition.stop();
            } else {
                try {
                    await recognition.start();
                } catch (error) {
                    console.error('Voice error:', error);
                }
            }
        });

        // Image upload
        // Unified attachment upload (images and files)
        attachBtn.addEventListener('click', () => attachInput.click());
        attachInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Check file size (10MB limit for all files)
                if (file.size > 10 * 1024 * 1024) {
                    addMessage('⚠️ File too large (max 10MB).', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentAttachment = event.target.result;
                    attachmentFileName = file.name;
                    
                    // Determine if it's an image or other file type
                    const isImage = file.type.startsWith('image/');
                    attachmentType = isImage ? 'image' : 'file';
                    
                    const fileType = isImage 
                        ? 'Image • ' + (file.size / 1024).toFixed(0) + ' KB'
                        : (file.type || 'File') + ' • ' + (file.size / 1024).toFixed(0) + ' KB';
                    
                    showPreview(file.name, fileType, isImage ? event.target.result : null);
                };
                reader.readAsDataURL(file);
            }
        });

        function showPreview(name, type, imageData) {
            previewName.textContent = name;
            previewType.textContent = type;
            if (imageData) {
                previewImage.src = imageData;
                previewImage.style.display = 'block';
            } else {
                previewImage.style.display = 'none';
            }
            attachmentPreview.classList.add('active');
        }

        removeAttachment.addEventListener('click', () => {
            currentAttachment = null;
            attachmentType = null;
            attachmentFileName = null;
            attachmentPreview.classList.remove('active');
            attachInput.value = '';
        });

        function addMessage(content, type, animate = true) {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper ' + type;
            if (!animate) wrapper.style.animation = 'none';
            
            const avatar = document.createElement('div');
            avatar.className = 'avatar ' + type;
            avatar.textContent = type === 'user' ? '👤' : '🤖';
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            
            if (type === 'loading') {
                messageDiv.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
            } else {
                messageDiv.textContent = content;
            }
            
            if (type !== 'system') wrapper.appendChild(avatar);
            wrapper.appendChild(messageDiv);
            messagesDiv.appendChild(wrapper);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return wrapper;
        }

        async function sendMessage(messageText) {
            console.log('📤 sendMessage called, currentSessionId:', currentSessionId);
            
            const message = messageText || input.value.trim();
            if (!message && !currentAttachment) {
                console.log('⚠️ No message or attachment, returning');
                return;
            }

            console.log('✅ Sending message to session:', currentSessionId);

            let displayMessage = message;
            if (currentAttachment && attachmentType === 'image') {
                displayMessage = (message ? message + '\\n\\n' : '') + '📷 [Image: ' + attachmentFileName + ']';
            } else if (currentAttachment && attachmentType === 'file') {
                displayMessage = (message ? message + '\\n\\n' : '') + '📎 [File: ' + attachmentFileName + ']';
            }
            
            addMessage(displayMessage, 'user');
            input.value = '';
            sendBtn.disabled = true;

            const loadingMsg = addMessage('', 'loading');

            try {
                const payload = {
                    message: message || '',
                    sessionId: currentSessionId
                };

                console.log('📦 Payload:', payload);

                if (currentAttachment && attachmentType === 'image') {
                    payload.image = currentAttachment;
                } else if (currentAttachment && attachmentType === 'file') {
                    payload.fileData = currentAttachment;
                    payload.fileName = attachmentFileName;
                }

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                console.log('📥 Response status:', response.status);

                const data = await response.json();
                console.log('📥 Response data:', data);
                
                loadingMsg.remove();
                
                if (data.error) {
                    console.error('❌ Error from server:', data.error);
                    addMessage('❌ Error: ' + data.error, 'error');
                } else {
                    console.log('✅ Success! Adding AI response');
                    addMessage(data.response, 'assistant');
                    
                    // Update session in sidebar
                    const session = sessions.find(s => s.id === currentSessionId);
                    if (session) {
                        session.lastMessage = message || 'Sent an attachment';
                        session.updatedAt = Date.now();
                        renderChatList();
                    }
                }

                // FIXED: Clear attachment after sending
                if (currentAttachment) {
                    currentAttachment = null;
                    attachmentType = null;
                    attachmentFileName = null;
                    attachmentPreview.classList.remove('active');
                    attachInput.value = '';
                }
            } catch (error) {
                console.error('❌ Network/Fetch Error:', error);
                loadingMsg.remove();
                addMessage('❌ Network Error: ' + error.message, 'error');
            } finally {
                console.log('🔄 Re-enabling send button');
                sendBtn.disabled = false;
                input.focus();
                console.log('✅ sendMessage complete');
            }
        }

        sendBtn.addEventListener('click', () => sendMessage());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Debug: Check if input elements exist periodically
        setInterval(() => {
            const inputCheck = document.getElementById('input');
            const sendCheck = document.getElementById('send');
            const inputArea = document.querySelector('.input-area');
            
            if (!inputCheck || !sendCheck || !inputArea) {
                console.error('🚨 INPUT ELEMENTS MISSING!', {
                    input: !!inputCheck,
                    sendBtn: !!sendCheck,
                    inputArea: !!inputArea
                });
            }
        }, 5000); // Check every 5 seconds
        
        // Global error handler to catch any breaking errors
        window.addEventListener('error', (event) => {
            console.error('🚨 GLOBAL ERROR:', event.error);
            console.error('Message:', event.message);
            console.error('File:', event.filename);
            console.error('Line:', event.lineno);
            
            // Ensure input stays functional
            const sendBtn = document.getElementById('send');
            if (sendBtn) {
                sendBtn.disabled = false;
            }
            const input = document.getElementById('input');
            if (input) {
                input.disabled = false;
            }
        });
        
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 UNHANDLED PROMISE REJECTION:', event.reason);
            
            // Ensure input stays functional
            const sendBtn = document.getElementById('send');
            if (sendBtn) {
                sendBtn.disabled = false;
            }
        });
    </script>
</body>
</html>`;
}