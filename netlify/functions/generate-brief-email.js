// Using require for Node.js environment in Netlify Functions
const OpenAI = require('openai');
const sgMail = require('@sendgrid/mail');

// --- Environment Variables ---
const openAIApiKey = process.env.OPENAI_API_KEY;
const sendGridApiKey = process.env.SENDGRID_API_KEY;
const senderEmail = process.env.SENDER_EMAIL; // Email address verified with SendGrid

// --- Input Validation ---
if (!openAIApiKey) {
    console.error("OpenAI API key not configured.");
}
if (!sendGridApiKey) {
    console.error("SendGrid API key not configured.");
} else {
    sgMail.setApiKey(sendGridApiKey);
}
if (!senderEmail) {
    console.error("Sender email address (SENDER_EMAIL) not configured.");
}

// --- OpenAI Client ---
const openai = openAIApiKey ? new OpenAI({ apiKey: openAIApiKey }) : null;

// --- Helper: Construct Brief Prompt (remains the same) ---
function constructBriefPrompt(history) {
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
`;
}

// --- Helper: Construct Translate Prompt (remains the same) ---
function constructTranslatePrompt(text) {
    // This prompt remains unchanged from previous versions
    return `
You are an AI assistant skilled at refining business requests into actionable research questions... [rest of prompt omitted for brevity]

**Generated Research Questions:**
`;
}

// --- Helper: Construct Topic Question Prompt (MODIFIED) ---
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
4. If asking a subsequent question (i.e., ${firstOrNext} is "next relevant"), identify the *single most important piece of missing information* needed to improve coverage of this specific topic based on the history, and formulate your question to elicit that information. Ensure it logically follows the previous answer.
5. Do NOT ask about other topics.
6. Do NOT add introductory text like "Okay, the next question is:". Just provide the question itself.

**Question about ${topicId.replace(/_/g, ' ')}:**
`; // AI response starts here
}

// --- Helper: Construct Topic Completion Check Prompt (remains the same) ---
function constructTopicCompletionCheckPrompt(topicId, history) {
    const historyString = history.map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`).join('\n');
    // This prompt remains unchanged
    return `
You are an AI assistant evaluating conversation history for completeness regarding a specific topic... [rest of prompt omitted for brevity]

**Is the topic "${topicId.replace(/_/g, ' ')}" sufficiently covered (YES/NO)?**
`;
}

// --- Helper: Send Email ---
async function sendBriefByEmail(recipientEmail, briefContent) {
    if (!sendGridApiKey || !senderEmail) {
        console.error("SendGrid API Key or Sender Email not configured. Cannot send email.");
        return; // Or throw an error
    }

    // Extract title for subject line (simple approach)
    const titleMatch = briefContent.match(/^# Strategic Brief: (.*)/m);
    const subject = titleMatch ? `Your Strategic Brief: ${titleMatch[1]}` : "Your Generated Strategic Brief";

    const msg = {
        to: recipientEmail,
        from: senderEmail, // Use the verified sender email
        subject: subject,
        text: `Here is your generated strategic brief:\n\n${briefContent}`, // Plain text version
        html: `<p>Here is your generated strategic brief:</p><pre style="white-space: pre-wrap; word-wrap: break-word; background-color: #f8f8f8; padding: 15px; border-radius: 5px;">${briefContent.replace(/\n/g, '<br>')}</pre>`, // HTML version
    };

    try {
        console.log(`Sending email to ${recipientEmail}...`);
        await sgMail.send(msg);
        console.log('Email sent successfully.');
    } catch (error) {
        console.error('Error sending email via SendGrid:', error);
        if (error.response) {
            console.error("SendGrid Error Body:", error.response.body);
        }
        // Log error, but don't crash the background function if email fails
    }
}


// --- Netlify Function Handler ---
// This function now handles multiple types, but 'generate' runs in the background
exports.handler = async (event) => {
    // --- Basic Checks ---
    if (!openAIApiKey) return { statusCode: 500, body: JSON.stringify({ error: "OpenAI API key not configured on server." }) };
    if (!openai) return { statusCode: 500, body: JSON.stringify({ error: "OpenAI client not initialized." }) };
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    // --- Parse Payload ---
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON payload." }) };
    }
    const { type, history, text, topic, is_first_question, emailAddress } = body;

    // --- Handle GENERATE request (Background) ---
    if (type === 'generate' && history && emailAddress) {
        // Validate email format simply
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
             return { statusCode: 400, body: JSON.stringify({ error: "Invalid email address format provided." }) };
        }
         if (!sendGridApiKey || !senderEmail) {
             return { statusCode: 500, body: JSON.stringify({ error: "Email sending is not configured on the server." }) };
         }

        // Immediately return 202 Accepted to the client
        // The rest of the code runs in the background
        console.log(`Received generate request for ${emailAddress}. Starting background processing.`);
        setTimeout(async () => { // Use setTimeout to ensure response is sent before heavy lifting
            try {
                const prompt = constructBriefPrompt(history);
                const model = "gpt-4"; // Use powerful model for final synthesis
                const temperature = 0.5;

                console.log(`Background: Calling OpenAI API (Type: ${type}, Model: ${model})...`);
                const completion = await openai.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    model: model,
                    temperature: temperature,
                });
                console.log("Background: OpenAI API call successful.");

                const briefContent = completion.choices[0]?.message?.content?.trim();

                if (!briefContent) {
                    throw new Error("Background: No content received from OpenAI.");
                }

                // Send the email
                await sendBriefByEmail(emailAddress, briefContent);

            } catch (error) {
                console.error('Background Error during brief generation or emailing:', error);
                // Optionally: Send an error email to the user or an admin?
                // For now, just log it. The user got the initial "started" message.
            }
        }, 0); // Execute async task almost immediately after returning response

        // Return the 202 Accepted response
        return {
            statusCode: 202, // Accepted
            body: JSON.stringify({ message: "Brief generation process started." }),
        };
    }

    // --- Handle other request types (Synchronous) ---
    try {
        let prompt;
        let model = "gpt-3.5-turbo";
        let temperature = 0.5;

        if (type === 'get_topic_question' && topic && history !== undefined) {
            prompt = constructTopicQuestionPrompt(topic, history, is_first_question);
            temperature = 0.7;
        } else if (type === 'check_topic_completion' && topic && history !== undefined) {
            prompt = constructTopicCompletionCheckPrompt(topic, history);
            temperature = 0.1;
        } else if (type === 'translate' && text) {
            prompt = constructTranslatePrompt(text);
        } else {
            console.error("Invalid synchronous request payload:", body);
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request payload or missing fields for synchronous type' }) };
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
        });
        console.log("OpenAI API call successful.");

        let result = completion.choices[0]?.message?.content?.trim();

        // Clean up results
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

        return {
            statusCode: 200,
            body: JSON.stringify({ result }),
        };

    } catch (error) {
        console.error('Error processing synchronous request:', error);
        let errorMessage = error.message || "Failed to process request.";
        if (error.response) {
            console.error("OpenAI Error Data:", error.response.data);
            errorMessage = error.response.data?.error?.message || errorMessage;
        }
        return { statusCode: 500, body: JSON.stringify({ error: `Server error: ${errorMessage}` }) };
    }
};
