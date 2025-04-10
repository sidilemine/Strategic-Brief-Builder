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
    const generateBriefBtn = document.getElementById('generate-brief-btn');

    const briefOutputCode = document.getElementById('brief-output');
    const copyBriefBtn = document.getElementById('copy-brief-btn');
    const copyStatus = document.getElementById('copy-status');

    // --- State ---
    let isLoading = false;
    let conversationHistory = [];
    let topics = []; // Will be populated with { id, name, status ('pending', 'active', 'completed', 'skipped') }
    let currentTopic = null; // The topic object currently being discussed
    let currentAssistantQuestion = null; // The actual question text

    // --- Constants ---
    const TOPIC_DEFINITIONS = [
        { id: 'business_context', name: "Business Context" },
        { id: 'current_understanding', name: "Current Understanding" },
        { id: 'audience_definition', name: "Audience Definition" },
        { id: 'success_metrics', name: "Success Metrics" },
        { id: 'timeline_constraints', name: "Timeline & Constraints" },
        { id: 'previous_research', name: "Previous Research & Gaps" },
        { id: 'stakeholders_distribution', name: "Stakeholders & Distribution" }
    ];
    const COMPLETION_SIGNAL = "COMPLETION_SIGNAL"; // Matches backend signal

    // --- Functions ---

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

    async function getFirstQuestionForTopic(topic) {
         if (!topic) return null;
         questionTextElement.textContent = `Thinking about ${topic.name}...`;
         answerInputElement.value = '';
         answerInputElement.disabled = true;
         nextBtn.disabled = true;
         skipQuestionBtn.disabled = true;
         skipTopicBtn.disabled = true;

         const question = await callOpenAIProxy({
             type: 'get_topic_question',
             topic: topic.id,
             history: conversationHistory,
             is_first_question: true // Signal it's the first for this topic
         });

         handleNewQuestionResponse(question);
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
            await getNextQuestionForTopic(currentTopic);
        }
    }

    async function moveToNextTopicOrGenerate(currentTopicId, statusToSet) {
         updateTopicStatus(currentTopicId, statusToSet);
         const nextTopic = findNextTopic(); // Sets the new currentTopic and marks it active

         if (nextTopic) {
             // Start the new topic
             await getFirstQuestionForTopic(nextTopic);
         } else {
             // All topics done (completed or skipped)
             enableGenerateBrief();
         }
    }


    function enableGenerateBrief() {
        questionTextElement.textContent = 'All topics covered. Ready to generate the brief.';
        answerInputElement.disabled = true;
        nextBtn.style.display = 'none';
        skipQuestionBtn.style.display = 'none';
        skipTopicBtn.style.display = 'none';
        generateBriefBtn.style.display = 'inline-block';
        generateBriefBtn.disabled = false;
    }


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
            const response = await fetch('/.netlify/functions/openai-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.result;

        } catch (error) {
            console.error('Error calling OpenAI proxy:', error);
            alert(`Error: ${error.message}`);
            // Reset specific loading indicators on error
            if (payload.type === 'generate') briefOutputCode.textContent = 'Generation failed.';
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
            await getFirstQuestionForTopic(firstTopic);
        } else {
            // Should not happen with initial setup
            enableGenerateBrief();
        }
    });

    nextBtn.addEventListener('click', () => {
        handleNextStep(false); // False indicates question was not skipped
    });

    skipQuestionBtn.addEventListener('click', () => {
        handleNextStep(true); // True indicates question was skipped
    });

    skipTopicBtn.addEventListener('click', async () => {
         if (isLoading || !currentTopic) return;
         console.log(`Skipping topic: ${currentTopic.name}`);
         conversationHistory.push({ role: 'user', content: `User skipped topic: ${currentTopic.name}` });
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

        // Ensure final state is captured if needed (though should be handled by flow)
        console.log("Conversation History for Generation:", conversationHistory);
        questionSection.style.display = 'none';
        topicSidebar.style.display = 'none'; // Hide sidebar when showing brief
        briefOutputSection.style.display = 'block';
        briefOutputCode.textContent = 'Generating Brief... Please wait.';

        const generatedBrief = await callOpenAIProxy({ type: 'generate', history: conversationHistory });

        if (generatedBrief) {
            briefOutputCode.textContent = generatedBrief;
        } else {
            briefOutputCode.textContent = 'Brief generation failed.';
        }
    });

    copyBriefBtn.addEventListener('click', copyBriefToClipboard);

    // --- Initial Setup ---
    questionSection.style.display = 'none';
    briefOutputSection.style.display = 'none';
    translationOutputDiv.style.display = 'none';
    generateBriefBtn.style.display = 'none';
    topicSidebar.style.display = 'none'; // Hide sidebar initially
    skipQuestionBtn.style.display = 'none';
    skipTopicBtn.style.display = 'none';

}); // End DOMContentLoaded
