// Using require for Node.js environment in Netlify Functions
const OpenAI = require('openai');

// Ensure the API key is available in the environment variables
// This will be set in the Netlify UI during deployment
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error("OpenAI API key not found in environment variables.");
    // Return an error response immediately if the key is missing
    // Note: This specific return might not work before the handler,
    // but the check prevents the OpenAI client from being initialized without a key.
    // Proper error handling will be within the handler.
}

// Initialize OpenAI client (only if key exists)
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// --- Constants ---
// Removed COMPLETION_SIGNAL as completion is now checked per topic

// --- Helper Functions ---

// Removed getAnswerById as we now use conversation history

// Construct the prompt for generating the full brief based on conversation history
function constructBriefPrompt(history) {
    // Format history for the prompt
    const historyString = history.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
    ).join('\n');

    return `
You are an AI assistant helping create a professional strategic research brief.
Based on the following conversation history between an assistant (asking questions) and a user (providing answers), generate a comprehensive and well-structured strategic brief.

**Conversation History:**
${historyString}

**Instructions:**
1.  Synthesize the information provided throughout the conversation history.
2.  Structure the output exactly according to the following Markdown format.
3.  Fill in the sections based *only* on the information provided in the history. Do not add external knowledge.
4.  For "Project Objectives", infer 1-3 clear objectives based on the business context and challenges mentioned in the conversation.
5.  For "Key Questions to Explore", formulate 3-5 specific, actionable research questions that directly address the core need and knowledge gaps identified in the conversation. Use the initial request and subsequent answers as context.
6.  For "Methodological Considerations", briefly suggest 1-2 potential research approaches (e.g., qualitative interviews, quantitative survey, market analysis) that seem appropriate given the context discussed, but keep it high-level.
7.  Ensure the tone is professional and clear.
8.  Do NOT include the raw conversation history in the final brief output. Only use it to generate the synthesized content for each section.

**Output Format (Use Markdown):**

# Strategic Brief: [Generate a Concise Project Title based on the context]

## Business Context
[Synthesize the business challenge, opportunity, and objectives based on answers for 'business_challenge' and 'business_objectives']

## Project Objectives
- [Synthesized primary objective]
- [Synthesized secondary objective(s), if applicable]
- [Expected business outcomes based on answers]

## Target Audience
[Synthesize a detailed audience definition based on answers for 'audience_definition' and 'audience_segments']

## Key Questions to Explore
- [Generated Question 1]
- [Generated Question 2]
- [Generated Question 3]
- [Generated Question 4, if needed]
- [Generated Question 5, if needed]

## Current Knowledge & Gaps
[Summarize what is known ('current_knowledge', 'previous_research'), assumptions ('assumptions'), and gaps ('knowledge_gaps')]

## Success Metrics
[Synthesize how success will be measured ('success_metrics') and what decisions will be informed ('decision_making')]

## Timeline & Deliverables
[Combine timeline ('timeline'), constraints ('constraints'), and desired format ('insight_format')]

## Stakeholders & Distribution
[Identify stakeholders ('stakeholders') and reiterate the distribution format ('insight_format')]

## Methodological Considerations
[Suggest 1-2 high-level approaches based on context. Mention previous research findings ('previous_research') if relevant]

---
**Generated Brief:**
`; // The AI should start generating the brief right after this line.
}

// Construct the prompt for translating a vague request
function constructTranslatePrompt(text) {
    return `
You are an AI assistant skilled at refining business requests into actionable research questions.
A user has provided the following vague business request:

"${text}"

Your task is to translate this vague request into 3-5 specific, clear, and actionable research questions that would help address the underlying need. Focus on questions that research can realistically answer.

**Output Format:**
List the questions clearly, one per line, starting with a hyphen (-). Do not add any introductory or concluding text, just the questions.

**Example:**
Vague request: "We need to understand Gen Z better"
Translation:
- What specific platforms and content formats are most engaging for our target Gen Z segment?
- How does our brand positioning resonate with Gen Z values compared to competitors?
- What barriers prevent Gen Z from converting after initial brand awareness?

**Generated Research Questions:**
`; // The AI should start generating the questions right after this line.
}

// Construct prompt to get a question for a specific topic
function constructTopicQuestionPrompt(topicId, history, isFirstQuestion) {
     const historyString = history.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
    ).join('\n');

    const firstOrNext = isFirstQuestion ? "first" : "next relevant";

    return `
You are an AI assistant guiding a user through building a strategic research brief, focusing specifically on the topic: **${topicId.replace(/_/g, ' ')}**.

**Conversation History So Far:**
${historyString}

**Instructions:**
1. Review the conversation history provided.
2. Formulate the single ${firstOrNext}, open-ended, conversational question to ask the user specifically about the **${topicId.replace(/_/g, ' ')}** topic, considering what has already been discussed.
3. If asking the first question for the topic, make it a good starting point for that topic.
4. If asking a subsequent question, ensure it logically follows the previous answer and aims to gather more detail *for this specific topic*.
5. Do NOT ask about other topics.
6. Do NOT add introductory text like "Okay, the next question is:". Just provide the question itself.

**Question about ${topicId.replace(/_/g, ' ')}:**
`; // AI response starts here
}

// Construct prompt to check if a topic is sufficiently covered
function constructTopicCompletionCheckPrompt(topicId, history) {
    const historyString = history.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
    ).join('\n');

    return `
You are an AI assistant evaluating conversation history for completeness regarding a specific topic for a strategic brief.

**Topic to Evaluate:** ${topicId.replace(/_/g, ' ')}

**Conversation History:**
${historyString}

**Instructions:**
1. Analyze the *entire* conversation history provided, paying close attention to the user's inputs related to the topic **${topicId.replace(/_/g, ' ')}**. Consider if the user explicitly skipped questions or the topic.
2. Determine if the **${topicId.replace(/_/g, ' ')}** topic has been sufficiently covered to write a basic section in a strategic brief. It doesn't need exhaustive detail, just the core information.
3. Respond with only the word "YES" if the topic is sufficiently covered or was skipped.
4. Respond with only the word "NO" if more information is clearly needed for this topic based on the history.

**Is the topic "${topicId.replace(/_/g, ' ')}" sufficiently covered (YES/NO)?**
`; // AI response starts here
}

// constructBriefPrompt remains largely the same, using history.
// constructTranslatePrompt remains the same.


// --- Netlify Function Handler ---
exports.handler = async (event) => {
    // Ensure OpenAI client is initialized (API key check)
    if (!openai) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "OpenAI API key not configured on server." }),
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        // Updated payload structure for topic-driven flow
        const { type, history, text, topic, is_first_question } = body;

        let prompt;
        let model = "gpt-3.5-turbo"; // Default model
        let temperature = 0.5; // Default temperature

        if (type === 'get_topic_question' && topic && history !== undefined) {
            prompt = constructTopicQuestionPrompt(topic, history, is_first_question);
            model = "gpt-3.5-turbo"; // Keep question generation fast
            temperature = 0.7; // Allow a bit more creativity in question phrasing
        } else if (type === 'check_topic_completion' && topic && history !== undefined) {
            prompt = constructTopicCompletionCheckPrompt(topic, history);
            model = "gpt-3.5-turbo"; // Simple YES/NO check
            temperature = 0.1; // Be very deterministic for YES/NO
        } else if (type === 'generate' && history) {
            prompt = constructBriefPrompt(history); // Uses full history
            model = "gpt-4"; // Use powerful model for final synthesis
            temperature = 0.5;
        } else if (type === 'translate' && text) {
            prompt = constructTranslatePrompt(text);
            model = "gpt-3.5-turbo";
            temperature = 0.5;
        } else {
            console.error("Invalid request payload or missing fields:", body);
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request payload or missing required fields for the specified type' }) };
        }

        if (!prompt) {
             console.error("Failed to construct prompt for payload:", body);
             return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error: Could not construct prompt' }) };
        }

        console.log(`Calling OpenAI API (Type: ${type}, Model: ${model}, Temp: ${temperature})...`);

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: model,
            temperature: temperature,
            // max_tokens: type === 'generate' ? 1500 : 200, // Example: More tokens for generation
        });

        console.log("OpenAI API call successful.");

        let result = completion.choices[0]?.message?.content?.trim();

        // Clean up potential artifacts
        if (type === 'get_topic_question' && result) {
             result = result.replace(/^["']?(Question:|Next Question:)?\s*/i, '').replace(/["']?$/, '');
        } else if (type === 'check_topic_completion' && result) {
             // Ensure only YES or NO is returned
             if (result.toUpperCase() !== 'YES' && result.toUpperCase() !== 'NO') {
                 console.warn(`Unexpected completion check result: "${result}". Defaulting to NO.`);
                 result = 'NO'; // Default to NO if unexpected output
             } else {
                 result = result.toUpperCase(); // Standardize to uppercase
             }
        }

        if (!result) {
            throw new Error("No content received from OpenAI.");
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ result }), // Send back just the result text
        };

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        // Check for specific OpenAI errors if needed
        let errorMessage = "Failed to process request.";
        if (error.response) {
            console.error("OpenAI Error Data:", error.response.data);
            errorMessage = error.response.data?.error?.message || errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Server error: ${errorMessage}` }),
        };
    }
};
