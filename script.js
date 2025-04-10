document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const initialRequestSection = document.getElementById('initial-request-section');
    const questionSection = document.getElementById('question-section');
    const briefOutputSection = document.getElementById('brief-output-section');
    const topicSidebar = document.getElementById('topic-sidebar');
    const topicListElement = document.getElementById('topic-list');

    const initialRequestInput = document.getElementById('initial-request');
    const startQuestionsBtn = document.getElementById('start-questions-btn');
    const translateRequestBtn = document.getElementById('translate-request-btn');
    const translationOutputDiv = document.getElementById('translation-output');
    const translatedQuestionsCode = document.getElementById('translated-questions');

    const questionTextElement = document.getElementById('question-text');
    const answerInputElement = document.getElementById('answer-input');

    const nextBtn = document.getElementById('next-btn');
    const skipQuestionBtn = document.getElementById('skip-question-btn');
    const skipTopicBtn = document.getElementById('skip-topic-btn');
    const generateBriefBtn = document.getElementById('generate-brief-btn'); // Simple button

    // Re-added brief output elements
    const briefOutputCode = document.getElementById('brief-output');
    const copyBriefBtn = document.getElementById('copy-brief-btn');
    const copyStatus = document.getElementById('copy-status');

    // --- State ---
    let isLoading = false;
    let conversationHistory = [];
    // Added questionCount to topic state
    let topics = []; // Will be populated with { id, name, seed, status ('pending', 'active', 'completed', 'skipped'), questionCount }
    let currentTopic = null;
    let currentAssistantQuestion = null;

    // --- Constants ---
    const TOPIC_DEFINITIONS = [
        { id: 'business_context', name: "Business Context", seed: "Let's start with the business context. What specific business challenge or opportunity are you trying to address with this project?" },
        { id: 'current_understanding', name: "Current Understanding", seed: "Moving on to what's already known. What do you already understand about this topic or audience?" },
        { id: 'audience_definition', name: "Audience Definition", seed: "Now, let's define the audience. Who specifically are you trying to understand better (demographics, behaviors, etc.)?" },
        { id: 'success_metrics', name: "Success Metrics", seed: "Thinking about outcomes, how will you measure the success of this research or strategy work?" },
        { id: 'timeline_constraints', name: "Timeline & Constraints", seed: "What are the practical constraints? Please describe the timeline and any budget limitations." },
        { id: 'previous_research', name: "Previous Research & Gaps", seed: "Has any previous research been done on this? If so, what was learned, and what gaps remain?" },
        { id: 'stakeholders_distribution', name: "Stakeholders & Distribution", seed: "Finally, who will use these insights, and what format would be most useful for them?" }
    ];

    // --- Functions ---

    // Re-added copyBriefToClipboard function
    function copyBriefToClipboard() {
        const briefText = briefOutputCode.textContent;
        navigator.clipboard.writeText(briefText).then(() => {
            copyStatus.style.display = 'inline';
            setTimeout(() => {
                copyStatus.style.display = 'none';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy brief: ', err);
            alert('Failed to copy brief. Please copy manually.');
        });
    }

    function initializeTopics() {
        // Add questionCount, initialized to 0
        topics = TOPIC_DEFINITIONS.map(topic => ({ ...topic, status: 'pending', questionCount: 0 }));
        currentTopic = null;
        renderTopicList();
    }

    function renderTopicList() {
        topicListElement.innerHTML = ''; // Clear existing list
        topics.forEach(topic => {
            const li = document.createElement('li');
            li.textContent = topic.name;
            li.id = `topic-${topic.id}`;
            li.className = topic.status; // Apply class based on status
            topicListElement.appendChild(li);
        });
    }

    function updateTopicStatus(topicId, newStatus) {
        const topicIndex = topics.findIndex(t => t.id === topicId);
        if (topicIndex !== -1) {
            topics[topicIndex].status = newStatus;
            renderTopicList();
        }
    }

    function findNextTopic() {
        const nextPendingTopic = topics.find(t => t.status === 'pending');
        if (nextPendingTopic) {
            currentTopic = nextPendingTopic;
            updateTopicStatus(currentTopic.id, 'active');
            return currentTopic;
        } else {
            currentTopic = null;
            return null;
        }
    }

    function displaySeedQuestion(topic) {
        if (!topic || !topic.seed) {
            console.error("Cannot display seed question for topic:", topic);
            questionTextElement.textContent = "Error: Could not load the first question for this topic.";
            answerInputElement.disabled = true;
            nextBtn.disabled = true;
            skipQuestionBtn.disabled = true;
            skipTopicBtn.disabled = false;
            return;
        }
        console.log(`Displaying seed question for: ${topic.name}`);
        topic.questionCount = 1; // Initialize count
        questionTextElement.textContent = topic.seed;
        currentAssistantQuestion = topic.seed;
        conversationHistory.push({ role: 'assistant', content: topic.seed });
        answerInputElement.value = '';
        answerInputElement.disabled = false;
        nextBtn.disabled = false;
        skipQuestionBtn.disabled = false;
        skipTopicBtn.disabled = false;
        answerInputElement.focus();
    }

     async function getNextQuestionForTopic(topic) {
         if (!topic) return null;
         // Keep previous question visible, just disable input
         answerInputElement.value = '';
         answerInputElement.disabled = true;
         nextBtn.disabled = true;
         skipQuestionBtn.disabled = true;
         skipTopicBtn.disabled = true;

         const question = await callOpenAIProxy({
             type: 'get_topic_question',
             topic: topic.id,
             history: conversationHistory,
             is_first_question: false
         });

         handleNewQuestionResponse(question);
    }

    function handleNewQuestionResponse(question) {
        if (question) {
            if (currentTopic) currentTopic.questionCount++; // Increment count
            console.log(`Question count for ${currentTopic?.name}: ${currentTopic?.questionCount}`);
            questionTextElement.textContent = question;
            currentAssistantQuestion = question;
            conversationHistory.push({ role: 'assistant', content: question });
            answerInputElement.disabled = false;
            nextBtn.disabled = false;
            skipQuestionBtn.disabled = false;
            skipTopicBtn.disabled = false;
            answerInputElement.focus();
        } else {
            questionTextElement.textContent = 'An error occurred fetching the next step. Please try again.';
            answerInputElement.disabled = false; // Re-enable on error
            nextBtn.disabled = false;
            skipQuestionBtn.disabled = false;
            skipTopicBtn.disabled = false;
        }
    }

    async function checkTopicCompletion(topic) {
        if (!topic) return false;
        console.log(`Checking completion for topic: ${topic.name}`);
        nextBtn.disabled = true;
        skipQuestionBtn.disabled = true;
        skipTopicBtn.disabled = true;

        const response = await callOpenAIProxy({
            type: 'check_topic_completion',
            topic: topic.id,
            history: conversationHistory
        });
        console.log(`Completion check response for ${topic.name}:`, response);

        return response && response.toUpperCase() === 'YES';
    }

    async function handleNextStep(skippedQuestion = false) {
        if (isLoading) return;
        if (!currentTopic) {
             console.error("handleNextStep called with no current topic.");
             enableGenerateBrief();
             return;
        }

        const currentAnswer = answerInputElement.value.trim();
        if (!skippedQuestion && currentAnswer === '') {
            alert('Please provide an answer or skip the question.');
            return;
        }

        const historyEntry = skippedQuestion ? "User skipped question." : currentAnswer;
        conversationHistory.push({ role: 'user', content: historyEntry });

        const MAX_QUESTIONS_PER_TOPIC = 3;
        if (currentTopic.questionCount >= MAX_QUESTIONS_PER_TOPIC) {
            console.log(`Max questions (${MAX_QUESTIONS_PER_TOPIC}) reached for topic: ${currentTopic.name}. Moving on.`);
            moveToNextTopicOrGenerate(currentTopic.id, 'completed');
            return;
        }

        const isTopicComplete = await checkTopicCompletion(currentTopic);

        if (isTopicComplete) {
            moveToNextTopicOrGenerate(currentTopic.id, 'completed');
        } else {
            await getNextQuestionForTopic(currentTopic);
        }
    }

    async function moveToNextTopicOrGenerate(currentTopicId, statusToSet) {
         updateTopicStatus(currentTopicId, statusToSet);

         const allTopicsProcessed = topics.every(t => t.status === 'completed' || t.status === 'skipped');

         if (allTopicsProcessed) {
             enableGenerateBrief();
             return;
         }

         const nextTopic = findNextTopic();

         if (nextTopic) {
             displaySeedQuestion(nextTopic);
         } else {
             console.warn("moveToNextTopicOrGenerate: No pending topic found, but not all topics seem processed. Enabling generation.");
             enableGenerateBrief();
         }
    }

    function enableGenerateBrief() {
        const allTopicsProcessed = topics.every(t => t.status === 'completed' || t.status === 'skipped');
        if (!allTopicsProcessed) {
            console.warn("Attempted to enable Generate Brief before all topics were processed.");
            return;
        }
        console.log("All topics processed. Enabling Generate Brief.");
        questionTextElement.textContent = 'All topics covered. Ready to generate the brief.';
        answerInputElement.disabled = true;
        nextBtn.style.display = 'none';
        skipQuestionBtn.style.display = 'none';
        skipTopicBtn.style.display = 'none';
        // Show the simple generate button
        generateBriefBtn.style.display = 'inline-block';
        generateBriefBtn.disabled = false;
    }

    // --- API Call Function ---
    async function callOpenAIProxy(payload) {
        if (isLoading) return null;
        isLoading = true;
        let originalButtonStates = {
             next: nextBtn.disabled, skipQ: skipQuestionBtn.disabled, skipT: skipTopicBtn.disabled,
             gen: generateBriefBtn.disabled, trans: translateRequestBtn.disabled
        };
        nextBtn.disabled = true; skipQuestionBtn.disabled = true; skipTopicBtn.disabled = true;
        generateBriefBtn.disabled = true; translateRequestBtn.disabled = true;

        // Loading indicators
        if (payload.type === 'get_topic_question') {
            answerInputElement.disabled = true;
        } else if (payload.type === 'check_topic_completion') {
             console.log(`Checking completion for ${payload.topic}...`);
        } else if (payload.type === 'generate') {
            briefOutputCode.textContent = 'Generating Brief... Please wait.'; // Use brief output area
        } else if (payload.type === 'translate') {
            translatedQuestionsCode.textContent = 'Translating...';
        }

        try {
            const functionEndpoint = '/api/openai-proxy'; // Vercel endpoint
            const response = await fetch(functionEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // No 202 handling needed for synchronous flow

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // Try parsing JSON only if response is OK
            const data = await response.json();
            return data.result; // For non-background calls (translate, get_question, check_completion)

        } catch (error) {
            console.error('Error calling OpenAI proxy:', error); // Log the primary error

            // Attempt to get more details from the response if it exists
            let errorDetails = error.message; // Default message
            if (error.response && typeof error.response.text === 'function') {
                 try {
                     const errorText = await error.response.text();
                     console.error("Raw error response:", errorText);
                     // Try parsing as JSON, but handle failure
                     try {
                         const errorJson = JSON.parse(errorText);
                         if (errorJson.error) {
                             errorDetails = errorJson.error;
                         }
                     } catch (jsonError) {
                         // If not JSON, use the raw text if it's short, otherwise a generic message
                         errorDetails = errorText.length < 100 ? errorText : error.message;
                     }
                 } catch (textError) {
                     console.error("Could not read error response text:", textError);
                 }
            }

            alert(`Error: ${errorDetails}`); // Show more specific error if possible

            // Reset loading indicators on error
            if (payload.type === 'generate') briefOutputCode.textContent = 'Brief generation failed.';
            if (payload.type === 'translate') translatedQuestionsCode.textContent = 'Translation failed.';
            if (payload.type.includes('question') || payload.type.includes('completion')) {
                 questionTextElement.textContent = 'An error occurred fetching the next step. Please try again.';
                 answerInputElement.disabled = false;
            }
            return null;
        } finally {
            isLoading = false;
            // Restore button states carefully
             nextBtn.disabled = originalButtonStates.next;
             skipQuestionBtn.disabled = originalButtonStates.skipQ;
             skipTopicBtn.disabled = originalButtonStates.skipT;
             // Only re-enable generate if it was originally enabled (i.e., in generate state)
             generateBriefBtn.disabled = (generateBriefBtn.style.display === 'none') ? true : originalButtonStates.gen;
             translateRequestBtn.disabled = originalButtonStates.trans;
             if (payload.type.includes('question') || payload.type.includes('completion')) {
                  answerInputElement.disabled = false;
             }
        }
    }

    // --- Event Listeners ---
    startQuestionsBtn.addEventListener('click', async () => {
        const initialRequest = initialRequestInput.value.trim();
        if (initialRequest === '') {
            alert('Please enter your initial request first.'); return;
        }
        if (isLoading) return;

        initializeTopics();
        conversationHistory = [{ role: 'user', content: `Initial Request: ${initialRequest}` }];

        initialRequestSection.style.display = 'none';
        questionSection.style.display = 'block';
        topicSidebar.style.display = 'flex';
        skipQuestionBtn.style.display = 'inline-block';
        skipTopicBtn.style.display = 'inline-block';

        const firstTopic = findNextTopic();
        if (firstTopic) {
            displaySeedQuestion(firstTopic);
        } else {
            console.error("Initialization error: No first topic found.");
            questionTextElement.textContent = "Error initializing topics.";
        }
    });

    nextBtn.addEventListener('click', () => { handleNextStep(false); });
    skipQuestionBtn.addEventListener('click', () => { handleNextStep(true); });

    skipTopicBtn.addEventListener('click', async () => {
         if (isLoading || !currentTopic) return;
         console.log(`User skipping topic: ${currentTopic.name}`);
         conversationHistory.push({ role: 'user', content: `User chose to skip the entire topic: ${currentTopic.name}` });
         await moveToNextTopicOrGenerate(currentTopic.id, 'skipped');
    });

    translateRequestBtn.addEventListener('click', async () => {
        const initialText = initialRequestInput.value.trim();
        if (!initialText) { alert('Please enter your initial request first.'); return; }
        if (isLoading) return;

        translationOutputDiv.style.display = 'block';
        translatedQuestionsCode.textContent = 'Translating...';
        const translation = await callOpenAIProxy({ type: 'translate', text: initialText });
        translatedQuestionsCode.textContent = translation || 'Translation failed.';
    });

    generateBriefBtn.addEventListener('click', async () => {
        if (isLoading) return;

        console.log("Requesting brief generation...");
        console.log("Conversation History:", conversationHistory);

        questionSection.style.display = 'none';
        topicSidebar.style.display = 'none';
        briefOutputSection.style.display = 'block';
        briefOutputCode.textContent = 'Generating Brief... Please wait.';
        generateBriefBtn.disabled = true;

        const generatedBrief = await callOpenAIProxy({
            type: 'generate',
            history: conversationHistory
        });

        if (generatedBrief) {
            briefOutputCode.textContent = generatedBrief;
            copyBriefBtn.disabled = false; // Enable copy button
        } else {
            briefOutputCode.textContent = 'Brief generation failed.';
            copyBriefBtn.disabled = true; // Keep copy disabled on failure
        }
        // Re-enable generate button? Or assume one generation per session? For now, keep disabled.
        // generateBriefBtn.disabled = false;
    });

    // Re-add copyBriefBtn listener
    copyBriefBtn.addEventListener('click', copyBriefToClipboard);

    // --- Initial Setup ---
    questionSection.style.display = 'none';
    briefOutputSection.style.display = 'none';
    translationOutputDiv.style.display = 'none';
    generateBriefBtn.style.display = 'none'; // Hide generate button initially
    copyBriefBtn.disabled = true; // Disable copy initially
    topicSidebar.style.display = 'none';
    skipQuestionBtn.style.display = 'none';
    skipTopicBtn.style.display = 'none';

}); // End DOMContentLoaded
