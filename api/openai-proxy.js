// Using require for Node.js environment (Vercel standard)
const OpenAI = require('openai');

// --- Environment Variables ---
const openAIApiKey = process.env.OPENAI_API_KEY;

// --- Input Validation ---
if (!openAIApiKey) {
    console.error("OpenAI API key not configured.");
}

// --- OpenAI Client ---
const openai = openAIApiKey ? new OpenAI({ apiKey: openAIApiKey }) : null;

// --- Helper: Construct Brief Prompt ---
function constructBriefPrompt(history) {
    const historyString = history.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
    ).join('\n');
    // Identical prompt as before
    return `
You are an AI assistant helping create a professional strategic research brief...
[rest of brief prompt instructions]...

---
**Generated Brief:**
`;
}

// --- Helper: Construct Translate Prompt ---
function constructTranslatePrompt(text) {
    // Identical prompt as before
    return `
You are an AI assistant skilled at refining business requests into actionable research questions... [rest of prompt omitted for brevity]

**Generated Research Questions:**
`;
}

// --- Helper: Construct Topic Question Prompt ---
function constructTopicQuestionPrompt(topicId, history, isFirstQuestion) {
     const historyString = history.map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`).join('\n');
     const firstOrNext = isFirstQuestion ? "first" : "next relevant";
     // Modified instructions below
     return `
You are an AI assistant guiding a user through building a strategic research brief, focusing specifically on the topic: **${topicId.replace(/_/g, ' ')}**.

**Conversation History So Far:**
${historyString}

**Instructions:**
1. Review the conversation history provided.
2. Formulate the single ${firstOrNext}, open-ended, conversational question to ask the user specifically about the **${topicId.replace(/_/g, ' ')}** topic, considering what has already been discussed.
3. If asking the first question for the topic, make it a good starting point for that topic.
4. If asking a subsequent question (i.e., ${firstOrNext} is "next relevant"), ensure it logically follows the previous answer and aims to gather further detail *for this specific topic*.
5. Do NOT ask about other topics.
6. Do NOT add introductory text like "Okay, the next question is:". Just provide the question itself.

**Question about ${topicId.replace(/_/g, ' ')}:**
`; // AI response starts here
}

// --- Helper: Construct Topic Completion Check Prompt ---
function constructTopicCompletionCheckPrompt(topicId, history) {
    const historyString = history.map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`).join('\n');
    // Identical prompt as before
    return `
You are an AI assistant evaluating conversation history for completeness regarding a specific topic... [rest of prompt omitted for brevity]

**Is the topic "${topicId.replace(/_/g, ' ')}" sufficiently covered (YES/NO)?**
`;
}


// --- Vercel Serverless Function Handler (Synchronous) ---
// Note: Vercel typically uses module.exports or default export
module.exports = async (req, res) => {
    // --- Basic Checks ---
    if (!openAIApiKey || !openai) {
        return res.status(500).json({ error: "OpenAI API key not configured or client not initialized on server." });
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- Parse Payload ---
    // Vercel provides body directly in req.body
    const { type, history, text, topic, is_first_question } = req.body;

    try {
        let prompt;
        const model = "gpt-4o"; // Use gpt-4o for all tasks
        let temperature = 0.5;

        // Determine prompt and settings based on type
        if (type === 'generate' && history) {
            prompt = constructBriefPrompt(history);
            // Keep default temperature 0.5
        } else if (type === 'get_topic_question' && topic && history !== undefined) {
            prompt = constructTopicQuestionPrompt(topic, history, is_first_question);
            temperature = 0.7;
        } else if (type === 'check_topic_completion' && topic && history !== undefined) {
            prompt = constructTopicCompletionCheckPrompt(topic, history);
            temperature = 0.1;
        } else if (type === 'translate' && text) {
            prompt = constructTranslatePrompt(text);
            // Keep default temperature 0.5
        } else {
            console.error("Invalid request payload:", req.body);
            return res.status(400).json({ error: 'Invalid request payload or missing fields for the specified type' });
        }

        if (!prompt) {
             console.error("Failed to construct prompt for payload:", req.body);
              return res.status(500).json({ error: 'Internal server error: Could not construct prompt' });
         }

        // Explicit check for initialized OpenAI client before use
        if (!openai) {
             console.error("OpenAI client is not initialized. Check OPENAI_API_KEY environment variable.");
             return res.status(500).json({ error: "Server configuration error: OpenAI client not available." });
        }

        console.log(`Calling OpenAI API (Type: ${type}, Model: ${model}, Temp: ${temperature})...`);
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: model,
            temperature: temperature,
        });
        console.log("OpenAI API call successful.");

        let result = completion.choices[0]?.message?.content?.trim();

        // Clean up results (same logic as before)
        if (type === 'get_topic_question' && result) {
             result = result.replace(/^["']?(Question:|Next Question:)?\s*/i, '').replace(/["']?$/, '');
        } else if (type === 'check_topic_completion' && result) {
             if (result.toUpperCase() !== 'YES' && result.toUpperCase() !== 'NO') {
                 console.warn(`Unexpected completion check result: "${result}". Defaulting to NO.`);
                 result = 'NO';
             } else {
                 result = result.toUpperCase();
             }
        }

        if (!result) throw new Error("No content received from OpenAI.");

        // Return 200 OK with the result
        return res.status(200).json({ result });

    } catch (error) {
        console.error('Error processing request:', error);
        let errorMessage = error.message || "Failed to process request.";
        // OpenAI specific error handling can be added here if needed
        return res.status(500).json({ error: `Server error: ${errorMessage}` });
    }
};
