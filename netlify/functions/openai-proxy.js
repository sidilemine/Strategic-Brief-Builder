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

// --- Helper Functions ---

// Helper to get answer by question ID from the structured answers object
function getAnswerById(id, answers, questions) {
    const index = questions.findIndex(q => q.id === id);
    // Check if the index exists in answers object
    return answers && typeof answers[index] !== 'undefined' ? answers[index] : 'N/A';
}

// Construct the prompt for generating the full brief
function constructBriefPrompt(answers, questions) {
    const initialRequest = answers['initial_request'] || 'N/A';

    // Build the context string from answers
    const contextString = questions.map((q, index) =>
        `- ${q.text}: ${answers[index] || 'N/A'}`
    ).join('\n');

    return `
You are an AI assistant helping create a professional strategic research brief.
Based on the user's initial request and their answers to the clarifying questions below, generate a comprehensive and well-structured strategic brief.

**Initial Request:**
${initialRequest}

**Clarifying Questions & Answers:**
${contextString}

**Instructions:**
1.  Synthesize the provided information.
2.  Structure the output exactly according to the following Markdown format.
3.  Fill in the sections based *only* on the information provided in the answers. Do not add external knowledge.
4.  For "Project Objectives", infer 1-3 clear objectives based on the business context and challenges mentioned.
5.  For "Key Questions to Explore", formulate 3-5 specific, actionable research questions that directly address the core need and knowledge gaps identified in the answers. Include the original "Initial Request" as context if helpful, but focus on refined questions.
6.  For "Methodological Considerations", briefly suggest 1-2 potential research approaches (e.g., qualitative interviews, quantitative survey, market analysis) that seem appropriate given the context, but keep it high-level.
7.  Ensure the tone is professional and clear.
8.  Do NOT include the original clarifying questions and answers in the final brief output. Only use them to generate the synthesized content for each section.

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
        const { type, answers, text, questions: questionsData } = body; // Receive questions structure from client

        let prompt;
        let model = "gpt-3.5-turbo"; // Default model

        if (type === 'generate' && answers && questionsData) {
            prompt = constructBriefPrompt(answers, questionsData);
            model = "gpt-4"; // Use GPT-4 for better synthesis in brief generation if available/preferred
        } else if (type === 'translate' && text) {
            prompt = constructTranslatePrompt(text);
        } else {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body or type' }) };
        }

        console.log(`Calling OpenAI API (Type: ${type}, Model: ${model})...`);

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: model,
            temperature: 0.7, // Adjust for creativity vs. consistency
        });

        console.log("OpenAI API call successful.");

        const result = completion.choices[0]?.message?.content?.trim();

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
