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

// --- Helper: Construct Brief Prompt (Restored Full Instructions) ---
function constructBriefPrompt(history) {
    const historyString = history.map(turn =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`
    ).join('\n');
    // Restored full prompt instructions
    return `
You are an AI assistant helping create a professional strategic research brief.
Based on the following conversation history between an assistant (asking questions) and a user (providing answers), generate a comprehensive and well-structured strategic brief.

**Conversation History:**
${historyString}

**Instructions:**
1.  Synthesize the information provided throughout the conversation history.
2.  Structure the output exactly according to the following Markdown format.
3.  Fill in the sections based *only* on the information provided in the history. Do not add external knowledge. Consider user inputs like "User skipped question" or "User skipped topic..." when synthesizing.
4.  For "Project Objectives", infer 1-3 clear objectives based on the business context and challenges mentioned in the conversation.
5.  For "Key Questions to Explore", formulate 3-5 specific, actionable research questions that directly address the core need and knowledge gaps identified in the conversation. Use the initial request and subsequent answers as context.
6.  For "Methodological Considerations", briefly suggest 1-2 potential research approaches (e.g., qualitative interviews, quantitative survey, market analysis) that seem appropriate given the context discussed, but keep it high-level.
7.  Ensure the tone is professional and clear.
8.  Do NOT include the raw conversation history in the final brief output. Only use it to generate the synthesized content for each section.

**Output Format (Use Markdown):**

# Strategic Brief: [Generate a Concise Project Title based on the context]

## Business Context
[Synthesize the business challenge, opportunity, and objectives]

## Project Objectives
- [Synthesized primary objective]
- [Synthesized secondary objective(s), if applicable]
- [Expected business outcomes]

## Target Audience
[Synthesize a detailed audience definition]

## Key Questions to Explore
- [Generated Question 1]
- [Generated Question 2]
- [Generated Question 3]
- [...]

## Current Knowledge & Gaps
[Summarize knowns, assumptions, gaps]

## Success Metrics
[Synthesize measurement and decision impact]

## Timeline & Deliverables
[Combine timeline, constraints, format]

## Stakeholders & Distribution
[Identify stakeholders and format]

## Methodological Considerations
[Suggest approaches, mention previous research]

---
**Generated Brief:**
`; // AI response starts here
}

// --- Helper: Construct Translate Prompt (REFINED) ---
function constructTranslatePrompt(text) {
    // Refined prompt instructions
    return `
You are an AI assistant helping users clarify their initial strategic research needs.
A user has provided the following initial request:

"${text}"

Your task is to generate 3 distinct ways to rephrase or clarify this request, presenting each as a potential starting point for a strategic brief. Each option should focus on clarifying the user's core need from a slightly different angle (e.g., focusing on the problem, the audience, the desired outcome).

**Output Format:**
- List the 3 clarification options clearly.
- Start each option with a hyphen (-) and a space.
- Do NOT include any introductory or concluding text, commentary, examples, or labels like "Option 1". Just output the list of 3 clarification statements.

**Example Input:** "We need to understand Gen Z better"
**Example Output:**
- Clarify the specific business challenge related to Gen Z engagement.
- Define which segments of Gen Z are most critical to understand and why.
- Specify the key decisions that insights about Gen Z will inform.

**Clarification Options:**
`; // AI response starts here
}

// --- Helper: Construct Topic Question Prompt ---
function constructTopicQuestionPrompt(topicId, history, isFirstQuestion) {
     const historyString = history.map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`).join('\n');
     const firstOrNext = isFirstQuestion ? "first" : "next relevant";
     // Corrected prompt instructions
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
            prompt = constructBriefPrompt(history); // Use the corrected function
            // Keep default temperature 0.5
        } else if (type === 'get_topic_question' && topic && history !== undefined) {
            prompt = constructTopicQuestionPrompt(topic, history, is_first_question);
            temperature = 0.7;
        } else if (type === 'check_topic_completion' && topic && history !== undefined) {
            prompt = constructTopicCompletionCheckPrompt(topic, history);
            temperature = 0.1;
        } else if (type === 'translate' && text) {
            prompt = constructTranslatePrompt(text); // Use the refined function
            temperature = 0.6; // Slightly higher temp for more varied clarifications
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
        // Add cleanup for translate if needed (e.g., remove leading/trailing list markers if AI adds them)
        else if (type === 'translate' && result) {
             // Basic cleanup: remove potential leading/trailing markdown list characters if the AI didn't follow instructions perfectly
             result = result.replace(/^\s*-\s*/gm, '').trim();
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
