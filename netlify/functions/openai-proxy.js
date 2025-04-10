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
const COMPLETION_SIGNAL = "COMPLETION_SIGNAL"; // Signal that no more questions are needed

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

// Construct the prompt for getting the next question
function constructNextQuestionPrompt(history) {
    // Define the core areas a strategic brief needs
    const briefSections = [
        "Business Context (Challenge/Opportunity, Broader Objectives)",
        "Current Understanding (Existing Knowledge, Assumptions)",
        "Audience Definition (Target Audience, Key Segments)",
        "Success Metrics (Measurement, Decision Impact)",
        "Timeline and Constraints (Budget, Deadlines, Limitations)",
        "Previous Research & Knowledge Gaps",
        "Stakeholders & Insight Format/Distribution"
    ];

    // Format history for the prompt
    const historyString = history.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
    ).join('\n');

    return `
You are an AI assistant guiding a user through building a strategic research brief.
Your goal is to ask clarifying questions one by one until all necessary information for a standard brief is gathered.

**Standard Brief Sections to Cover:**
${briefSections.map(s => `- ${s}`).join('\n')}

**Conversation History So Far:**
${historyString}

**Instructions:**
1. Analyze the conversation history.
2. Identify which standard brief sections still lack sufficient detail based *only* on the history provided.
3. If crucial information is missing, formulate the *single best, most natural next question* to ask the user to gather that information. The question should be open-ended and conversational.
4. If you determine that all standard brief sections have been reasonably covered based on the conversation history, respond with the exact text: ${COMPLETION_SIGNAL}
5. Do NOT ask multiple questions at once. Only provide the single next question OR the completion signal.
6. Do not add any introductory text like "Okay, the next question is:". Just provide the question itself or the completion signal.

**Next Question or Completion Signal:**
`; // AI response starts here
}


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
        // Updated payload structure: type is mandatory, others depend on type
        const { type, history, text } = body;

        let prompt;
        let model = "gpt-3.5-turbo"; // Default model, can be overridden

        if (type === 'get_next_question' && history) {
            prompt = constructNextQuestionPrompt(history);
            // Use a faster model for potentially quicker turn-around on questions
            model = "gpt-3.5-turbo";
        } else if (type === 'generate' && history) {
            prompt = constructBriefPrompt(history);
            // Use a more powerful model for better synthesis in brief generation
            model = "gpt-4"; // Or "gpt-4-turbo" etc.
        } else if (type === 'translate' && text) {
            prompt = constructTranslatePrompt(text);
            model = "gpt-3.5-turbo";
        } else {
            console.error("Invalid request payload:", body);
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request payload or missing required fields for the type' }) };
        }

        if (!prompt) {
             console.error("Failed to construct prompt for payload:", body);
             return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error: Could not construct prompt' }) };
        }

        console.log(`Calling OpenAI API (Type: ${type}, Model: ${model})...`);

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: model,
            temperature: 0.5, // Slightly lower temperature for more focused questions/briefs
            // Consider adding max_tokens if needed, especially for brief generation
        });

        console.log("OpenAI API call successful.");

        let result = completion.choices[0]?.message?.content?.trim();

        // Clean up potential artifacts if the model doesn't perfectly follow instructions
        if (type === 'get_next_question' && result && result !== COMPLETION_SIGNAL) {
            // Remove potential leading/trailing quotes or labels
             result = result.replace(/^["']?(Next Question:|Question:)?\s*/i, '').replace(/["']?$/, '');
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
