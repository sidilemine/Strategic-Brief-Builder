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
    // Generate section elements
    const generateSection = document.getElementById('generate-section');
    const emailInput = document.getElementById('email-input');
    const generateBriefBtn = document.getElementById('generate-brief-btn');

    // Brief status elements
    const briefStatusMessage = document.getElementById('brief-status-message');
    // Removed briefOutputCode, copyBriefBtn, copyStatus references as they are no longer used

    // --- State ---
    let isLoading = false;
    let conversationHistory = [];
    let topics = []; // Will be populated with { id, name, status ('pending', 'active', 'completed', 'skipped') }
    let currentTopic = null; // The topic object currently being discussed
    let currentAssistantQuestion = null; // The actual question text

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
    // Removed COMPLETION_SIGNAL constant as it's handled by backend YES/NO check

    // --- Functions ---

    // Removed copyBriefToClipboard function as brief is emailed

    function initializeTopics() {
        topics = TOPIC_DEFINITIONS.map(topic => ({ ...topic, status: 'pending' }));
        currentTopic = null;
        renderTopicList();
    }

    function renderTopicList() {
        topicListElement.innerHTML = ''; // Clear existing list
        topics.forEach(topic => {
            const li = document.createElement('li');
            li.textContent = topic.name;
            li.id = `topic-${topic.id}`;
            li.className = topic.status; // Apply class based on status (pending, active, completed, skipped)
            topicListElement.appendChild(li);
        });
    }

    function updateTopicStatus(topicId, newStatus) {
        const topicIndex = topics.findIndex(t => t.id === topicId);
        if (topicIndex !== -1) {
            topics[topicIndex].status = newStatus;
            // Update currentTopic if the active one changed status
            if (currentTopic && currentTopic.id === topicId && newStatus !== 'active') {
                 // Handled by findNextTopic logic
            }
            renderTopicList(); // Re-render the list with updated classes
        }
    }

    function findNextTopic() {
        const nextPendingTopic = topics.find(t => t.status === 'pending');
        if (nextPendingTopic) {
            if (currentTopic) {
                 // Mark old topic as completed/skipped before switching
                 // This should be handled by the calling function (handleNextStep, handleSkipTopic)
            }
            currentTopic = nextPendingTopic;
            updateTopicStatus(currentTopic.id, 'active');
            return currentTopic;
        } else {
            currentTopic = null; // No more pending topics
            return null;
        }
    }

    // Function to display the seed question for a topic
    function displaySeedQuestion(topic) {
        if (!topic || !topic.seed) {
            console.error("Cannot display seed question for topic:", topic);
            questionTextElement.textContent = "Error: Could not load the first question for this topic.";
            // Disable inputs/buttons? Or allow skipping?
            answerInputElement.disabled = true;
            nextBtn.disabled = true;
            skipQuestionBtn.disabled = true;
            skipTopicBtn.disabled = false; // Allow skipping the broken topic
            return;
        }
        console.log(`Displaying seed question for: ${topic.name}`);
        questionTextElement.textContent = topic.seed;
        currentAssistantQuestion = topic.seed; // Store the seed question
        conversationHistory.push({ role: 'assistant', content: topic.seed }); // Add seed question to history
        answerInputElement.value = '';
        answerInputElement.disabled = false;
        nextBtn.disabled = false;
        skipQuestionBtn.disabled = false;
        skipTopicBtn.disabled = false;
        answerInputElement.focus();
    }

     async function getNextQuestionForTopic(topic) {
         if (!topic) return null;
         questionTextElement.textContent = `Thinking more about ${topic.name}...`;
         answerInputElement.value = '';
         answerInputElement.disabled = true;
         nextBtn.disabled = true;
         skipQuestionBtn.disabled = true;
         skipTopicBtn.disabled = true; // Keep disabled while loading

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
            questionTextElement.textContent = question;
            currentAssistantQuestion = question;
            conversationHistory.push({ role: 'assistant', content: question });
            answerInputElement.disabled = false;
            nextBtn.disabled = false;
            skipQuestionBtn.disabled = false;
            skipTopicBtn.disabled = false; // Re-enable skip topic
            answerInputElement.focus();
        } else {
            questionTextElement.textContent = 'Failed to get question. Please try submitting again or skip topic.';
            // Keep buttons enabled for user action
            answerInputElement.disabled = false;
            nextBtn.disabled = false;
            skipQuestionBtn.disabled = false;
            skipTopicBtn.disabled = false;
        }
    }

    async function checkTopicCompletion(topic) {
        if (!topic) return false;
        console.log(`Checking completion for topic: ${topic.name}`);
        // Temporarily disable buttons during check
        nextBtn.disabled = true;
        skipQuestionBtn.disabled = true;
        skipTopicBtn.disabled = true;

        const response = await callOpenAIProxy({
            type: 'check_topic_completion',
            topic: topic.id,
            history: conversationHistory
        });
        console.log(`Completion check response for ${topic.name}:`, response);
        // Re-enable buttons after check (unless moving to next topic/generating)
        // Handled by the calling function (handleNextStep)

        // Interpret response (expecting "YES" or "NO")
        return response && response.toUpperCase() === 'YES';
    }

    async function handleNextStep(skippedQuestion = false) {
        if (isLoading) return;
        if (!currentTopic) {
             console.error("handleNextStep called with no current topic.");
             enableGenerateBrief(); // Should not happen, but allow generation
             return;
        }

        const currentAnswer = answerInputElement.value.trim();
        if (!skippedQuestion && currentAnswer === '') {
            alert('Please provide an answer or skip the question.');
            return;
        }

        // Add user response (or skip indication) to history
        const historyEntry = skippedQuestion ? "User skipped question." : currentAnswer;
        conversationHistory.push({ role: 'user', content: historyEntry });

        // Check if the current topic is now complete
        const isTopicComplete = await checkTopicCompletion(currentTopic);

        if (isTopicComplete) {
            moveToNextTopicOrGenerate(currentTopic.id, 'completed');
        } else {
            // If topic not complete, get another question for the same topic
            // If topic not complete, get the next AI-generated question for the same topic
            await getNextQuestionForTopic(currentTopic);
        }
    }

    async function moveToNextTopicOrGenerate(currentTopicId, statusToSet) {
         updateTopicStatus(currentTopicId, statusToSet); // Mark current as done/skipped

         // Check if ALL topics are now done or skipped
         const allTopicsProcessed = topics.every(t => t.status === 'completed' || t.status === 'skipped');

         if (allTopicsProcessed) {
             enableGenerateBrief();
             return; // Exit early, no next topic to find
         }

         // Find the next topic that is still pending
         const nextTopic = findNextTopic(); // Sets the new currentTopic and marks it active

         if (nextTopic) {
             // Start the new topic with its seed question
             displaySeedQuestion(nextTopic);
         } else {
             // This case should ideally be caught by allTopicsProcessed check above,
             // but as a fallback, enable generation.
             console.warn("moveToNextTopicOrGenerate: No pending topic found, but not all topics seem processed. Enabling generation.");
             enableGenerateBrief();
         }
    }


    function enableGenerateBrief() {
        // Ensure this is only called when all topics are processed
        const allTopicsProcessed = topics.every(t => t.status === 'completed' || t.status === 'skipped');
        if (!allTopicsProcessed) {
            console.warn("Attempted to enable Generate Brief before all topics were processed.");
            return; // Do not enable yet
        }
        console.log("All topics processed. Enabling Generate Brief.");
        questionTextElement.textContent = 'All topics covered. Ready to generate the brief.';
        answerInputElement.disabled = true;
        nextBtn.style.display = 'none';
        skipQuestionBtn.style.display = 'none';
        skipTopicBtn.style.display = 'none';
        // Show the email input section instead of just the button
        generateSection.style.display = 'block';
        generateBriefBtn.disabled = false;
        emailInput.focus(); // Focus the email input
    }

    // Removed copyBriefToClipboard function

    // --- API Call Function ---
    async function callOpenAIProxy(payload) {
        if (isLoading) return null; // Return null if already loading
        isLoading = true;
        let originalButtonStates = { // Store original states to restore
             next: nextBtn.disabled,
             skipQ: skipQuestionBtn.disabled,
             skipT: skipTopicBtn.disabled,
             gen: generateBriefBtn.disabled,
             trans: translateRequestBtn.disabled
        };
        // Disable all action buttons during API call
        nextBtn.disabled = true;
        skipQuestionBtn.disabled = true;
        skipTopicBtn.disabled = true;
        generateBriefBtn.disabled = true;
        translateRequestBtn.disabled = true;

        // Specific loading indicators based on type
        if (payload.type === 'get_topic_question') {
            questionTextElement.textContent = `Thinking about ${payload.topic}...`;
            answerInputElement.disabled = true;
        } else if (payload.type === 'check_topic_completion') {
             // No specific text change, just button disabling
             console.log(`Checking completion for ${payload.topic}...`);
        } else if (payload.type === 'generate') {
            briefOutputCode.textContent = 'Generating Brief... Please wait.';
        } else if (payload.type === 'translate') {
            translatedQuestionsCode.textContent = 'Translating...';
        }

        try {
            // Use the renamed function endpoint
            const functionEndpoint = '/.netlify/functions/generate-brief-email'; // Corrected endpoint name
            const response = await fetch(functionEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // Handle the 202 Accepted status for background function start
            if (payload.type === 'generate' && response.status === 202) {
                console.log("Background brief generation started.");
                return { backgroundStarted: true }; // Special signal for background start
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.result; // For non-background calls (translate, get_question, check_completion)

        } catch (error) {
            console.error('Error calling OpenAI proxy:', error);
            alert(`Error: ${error.message}`);
            // Reset specific loading indicators on error
            if (payload.type === 'generate') briefStatusMessage.textContent = 'Brief generation request failed.';
            if (payload.type === 'translate') translatedQuestionsCode.textContent = 'Translation failed.';
            if (payload.type.includes('question') || payload.type.includes('completion')) {
                 questionTextElement.textContent = 'An error occurred. Please try again.';
                 answerInputElement.disabled = false; // Re-enable input on error
            }
            return null; // Indicate failure
        } finally {
            isLoading = false;
            // Restore button states *unless* the flow dictates they should change
            // (e.g., moving to generate brief) - this part is tricky,
            // the calling functions should handle final state.
            // For now, just re-enable based on stored state if they weren't meant to be disabled by flow.
             nextBtn.disabled = originalButtonStates.next;
             skipQuestionBtn.disabled = originalButtonStates.skipQ;
             skipTopicBtn.disabled = originalButtonStates.skipT;
             generateBriefBtn.disabled = originalButtonStates.gen;
             translateRequestBtn.disabled = originalButtonStates.trans;
             // Ensure input is re-enabled if it was a question/completion check
             if (payload.type.includes('question') || payload.type.includes('completion')) {
                  answerInputElement.disabled = false;
             }
        }
    }

    // --- Event Listeners ---
    startQuestionsBtn.addEventListener('click', async () => {
        const initialRequest = initialRequestInput.value.trim();
        if (initialRequest === '') {
            alert('Please enter your initial request first.');
            return;
        }
        if (isLoading) return;

        initializeTopics(); // Set up topic list and states
        conversationHistory = [{ role: 'user', content: `Initial Request: ${initialRequest}` }];

        initialRequestSection.style.display = 'none';
        questionSection.style.display = 'block';
        topicSidebar.style.display = 'flex'; // Show sidebar
        skipQuestionBtn.style.display = 'inline-block'; // Show skip buttons
        skipTopicBtn.style.display = 'inline-block';

        const firstTopic = findNextTopic(); // Get and activate the first topic
        if (firstTopic) {
            // Display the seed question for the first topic
            displaySeedQuestion(firstTopic);
        } else {
            // Should not happen with initial setup if TOPIC_DEFINITIONS is not empty
            console.error("Initialization error: No first topic found.");
            // Enable generation as a fallback? Or show error?
             questionTextElement.textContent = "Error initializing topics.";
            // enableGenerateBrief();
        }
    });

    nextBtn.addEventListener('click', () => {
        // Handles submitting an answer to the current question (seed or AI-generated)
        handleNextStep(false); // false = not skipped
    });

    skipQuestionBtn.addEventListener('click', () => {
        // Handles skipping the current question
        console.log("User skipped question:", currentAssistantQuestion);
        handleNextStep(true); // true = skipped
    });

    skipTopicBtn.addEventListener('click', async () => {
        // Handles skipping the entire current topic
         if (isLoading || !currentTopic) return;
         console.log(`User skipping topic: ${currentTopic.name}`);
         // Add a clear note to history about skipping the topic
         conversationHistory.push({ role: 'user', content: `User chose to skip the entire topic: ${currentTopic.name}` });
         // Move directly to the next topic or generation phase, marking current as skipped
         await moveToNextTopicOrGenerate(currentTopic.id, 'skipped');
    });


    translateRequestBtn.addEventListener('click', async () => {
        const initialText = initialRequestInput.value.trim();
        if (!initialText) {
            alert('Please enter your initial request first.');
            return;
        }
        if (isLoading) return;

        translationOutputDiv.style.display = 'block';
        translatedQuestionsCode.textContent = 'Translating...';

        const translation = await callOpenAIProxy({ type: 'translate', text: initialText });

        if (translation) {
            translatedQuestionsCode.textContent = translation;
        } else {
            translatedQuestionsCode.textContent = 'Translation failed.';
        }
    });

    generateBriefBtn.addEventListener('click', async () => {
        if (isLoading) return;

        const email = emailInput.value.trim();
        // Basic email validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
             alert('Please enter a valid email address.');
             emailInput.focus();
             return;
        }

        console.log("Requesting brief generation for:", email);
        console.log("Conversation History:", conversationHistory);

        // Show status message area
        questionSection.style.display = 'none';
        topicSidebar.style.display = 'none';
        briefOutputSection.style.display = 'block';
        briefStatusMessage.textContent = `Requesting brief generation for ${email}...`;
        generateBriefBtn.disabled = true; // Disable button after click

        // Call the background function
        const response = await callOpenAIProxy({
            type: 'generate',
            history: conversationHistory,
            emailAddress: email // Send email address to backend
        });

        // Check for the special signal indicating background start
        if (response && response.backgroundStarted) {
            briefStatusMessage.textContent = `Brief generation started. It will be emailed to ${email} shortly.`;
        } else {
            // Handle potential errors if the background function didn't start correctly
            briefStatusMessage.textContent = 'There was an issue starting the brief generation. Please try again later.';
            // Re-enable button on immediate failure?
            generateBriefBtn.disabled = false;
        }
    });

    // Removed copyBriefBtn listener

    // --- Initial Setup ---
    questionSection.style.display = 'none';
    briefOutputSection.style.display = 'none';
    translationOutputDiv.style.display = 'none';
    generateSection.style.display = 'none'; // Hide email input initially
    topicSidebar.style.display = 'none';
    skipQuestionBtn.style.display = 'none';
    skipTopicBtn.style.display = 'none';

}); // End DOMContentLoaded
