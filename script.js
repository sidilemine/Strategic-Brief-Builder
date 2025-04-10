document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const initialRequestSection = document.getElementById('initial-request-section');
    const questionSection = document.getElementById('question-section');
    const briefOutputSection = document.getElementById('brief-output-section');

    const initialRequestInput = document.getElementById('initial-request');
    const startQuestionsBtn = document.getElementById('start-questions-btn');
    const translateRequestBtn = document.getElementById('translate-request-btn');
    const translationOutputDiv = document.getElementById('translation-output');
    const translatedQuestionsCode = document.getElementById('translated-questions');

    // Removed progress bar elements
    const questionTextElement = document.getElementById('question-text');
    const answerInputElement = document.getElementById('answer-input');

    // Removed backBtn
    const nextBtn = document.getElementById('next-btn');
    const generateBriefBtn = document.getElementById('generate-brief-btn');

    const briefOutputCode = document.getElementById('brief-output');
    const copyBriefBtn = document.getElementById('copy-brief-btn');
    const copyStatus = document.getElementById('copy-status');

    // --- State ---
    // Removed currentQuestionIndex, userAnswers (replaced by history)
    let isLoading = false; // To prevent multiple API calls
    let conversationHistory = []; // Stores { role: 'user'/'assistant', content: '...' }
    let currentAssistantQuestion = null; // Store the latest question from the assistant

    // --- Functions ---

    // Removed getAnswerById, generatePlaceholderBrief (will rely on LLM)

    function copyBriefToClipboard() {
        const briefText = briefOutputCode.textContent;
        navigator.clipboard.writeText(briefText).then(() => {
            copyStatus.style.display = 'inline';
            setTimeout(() => {
                copyStatus.style.display = 'none';
            }, 2000); // Hide status after 2 seconds
        }).catch(err => {
            console.error('Failed to copy brief: ', err);
            alert('Failed to copy brief. Please copy manually.');
        });
    }

    // Function to call the Netlify serverless function
    async function callOpenAIProxy(payload) {
        if (isLoading) return; // Prevent concurrent calls
        isLoading = true;
        // Show some loading state (e.g., disable buttons, show spinner)
        translateRequestBtn.disabled = true;
        generateBriefBtn.disabled = true;
        briefOutputCode.textContent = 'Generating... Please wait.'; // Loading indicator for brief
        translatedQuestionsCode.textContent = 'Translating... Please wait.'; // Loading indicator for translation

        try {
            // Show loading state more specifically
            if (payload.type === 'get_next_question') {
                 questionTextElement.textContent = 'Thinking of the next question...';
                 answerInputElement.value = ''; // Clear input for next question
                 answerInputElement.disabled = true; // Disable input while loading
                 nextBtn.disabled = true;
            } else if (payload.type === 'generate') {
                 briefOutputCode.textContent = 'Generating Brief... Please wait.';
                 generateBriefBtn.disabled = true;
            } else if (payload.type === 'translate') {
                 translatedQuestionsCode.textContent = 'Translating...';
                 translateRequestBtn.disabled = true;
            }


            const response = await fetch('/.netlify/functions/openai-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send the relevant payload (history, text, etc.)
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.result; // The serverless function returns { result: "..." }

        } catch (error) {
            console.error('Error calling OpenAI proxy:', error);
            alert(`Error: ${error.message}`); // Show error to user
            // Reset loading indicators on error
            briefOutputCode.textContent = '';
            translatedQuestionsCode.textContent = '';
            return null; // Indicate failure
        } finally {
            isLoading = false;
            // Re-enable buttons
            translateRequestBtn.disabled = false;
            // Reset loading state
            answerInputElement.disabled = false;
            nextBtn.disabled = false;
            generateBriefBtn.disabled = false; // Re-enable if it was visible
            translateRequestBtn.disabled = false;
        }
    }

    // Removed updateProgress, displayQuestion, saveAnswer (logic integrated elsewhere)

    // --- Event Listeners ---
    startQuestionsBtn.addEventListener('click', async () => {
        const initialRequest = initialRequestInput.value.trim();
        if (initialRequest === '') {
            alert('Please enter your initial request first.');
            return;
        }
        if (isLoading) return;

        // Initialize conversation history with the user's initial request
        conversationHistory = [{ role: 'user', content: `Initial Request: ${initialRequest}` }];

        initialRequestSection.style.display = 'none';
        questionSection.style.display = 'block';
        questionTextElement.textContent = 'Getting first question...'; // Loading state
        answerInputElement.value = '';
        answerInputElement.disabled = true;
        nextBtn.disabled = true;

        // Fetch the first question from the AI
        const firstQuestion = await callOpenAIProxy({
            type: 'get_next_question',
            history: conversationHistory
        });

        if (firstQuestion && firstQuestion !== 'COMPLETION_SIGNAL') {
            questionTextElement.textContent = firstQuestion;
            currentAssistantQuestion = firstQuestion; // Store the question
            conversationHistory.push({ role: 'assistant', content: firstQuestion }); // Add AI question to history
            answerInputElement.disabled = false; // Enable input for user
            nextBtn.disabled = false;
            answerInputElement.focus();
        } else if (firstQuestion === 'COMPLETION_SIGNAL') {
            // Handle immediate completion (unlikely but possible)
            questionTextElement.textContent = 'All information gathered.';
            nextBtn.style.display = 'none';
            generateBriefBtn.style.display = 'inline-block';
            generateBriefBtn.disabled = false;
            answerInputElement.disabled = true;
        } else {
            questionTextElement.textContent = 'Failed to get the first question. Please try again.';
            // Optionally revert UI state
        }
    });

    nextBtn.addEventListener('click', async () => {
        const currentAnswer = answerInputElement.value.trim();
        if (currentAnswer === '') {
            alert('Please provide an answer.');
            return;
        }
        if (isLoading) return;

        // Add user's answer to history
        // We assume the last item in history is the question they are answering
        conversationHistory.push({ role: 'user', content: currentAnswer });

        // Fetch the next question
        const nextQuestion = await callOpenAIProxy({
            type: 'get_next_question',
            history: conversationHistory
        });

        if (nextQuestion && nextQuestion !== 'COMPLETION_SIGNAL') {
            questionTextElement.textContent = nextQuestion;
            currentAssistantQuestion = nextQuestion; // Store the new question
            conversationHistory.push({ role: 'assistant', content: nextQuestion }); // Add AI question to history
            answerInputElement.value = ''; // Clear input for next answer
            answerInputElement.focus();
        } else if (nextQuestion === 'COMPLETION_SIGNAL') {
            // Questioning complete, switch to Generate Brief
            questionTextElement.textContent = 'All information gathered. Ready to generate the brief.';
            answerInputElement.disabled = true;
            nextBtn.style.display = 'none';
            generateBriefBtn.style.display = 'inline-block';
            generateBriefBtn.disabled = false;
        } else {
            questionTextElement.textContent = 'Failed to get the next question. Please try again or generate the brief with current info.';
            // Keep UI enabled to allow retry or generation
            generateBriefBtn.style.display = 'inline-block'; // Allow generation even if next question fails
            generateBriefBtn.disabled = false;
        }
    });

    // Removed backBtn listener

    // Translate Request button
    translateRequestBtn.addEventListener('click', async () => {
        const initialText = initialRequestInput.value.trim();
        if (!initialText) {
            alert('Please enter your initial request first.');
            return;
        }
        if (isLoading) return;

        translationOutputDiv.style.display = 'block'; // Show the section
        translatedQuestionsCode.textContent = 'Translating...'; // Show loading

        const translation = await callOpenAIProxy({ type: 'translate', text: initialText });

        if (translation) {
            translatedQuestionsCode.textContent = translation;
        } else {
            translatedQuestionsCode.textContent = 'Translation failed.'; // Show error in output area
        }
    });

    // Generate Brief button
    generateBriefBtn.addEventListener('click', async () => {
        saveAnswer(); // Save the last answer
        // Add the final answer before generating
        if (!answerInputElement.disabled) { // Check if input is enabled (i.e., last question was asked)
             const finalAnswer = answerInputElement.value.trim();
             if (finalAnswer) {
                 conversationHistory.push({ role: 'user', content: finalAnswer });
             }
        }

        console.log("Conversation History for Generation:", conversationHistory); // Log history
        questionSection.style.display = 'none';
        briefOutputSection.style.display = 'block';
        briefOutputCode.textContent = 'Generating Brief... Please wait.'; // Show loading

        // Call the proxy function for generation using conversation history
        const generatedBrief = await callOpenAIProxy({ type: 'generate', history: conversationHistory });

        if (generatedBrief) {
            briefOutputCode.textContent = generatedBrief;
        } else {
            briefOutputCode.textContent = 'Brief generation failed.'; // Show error in output area
            // Optionally, show the placeholder brief as a fallback
            // generatePlaceholderBrief();
        }
    });

    // Copy Brief button
    copyBriefBtn.addEventListener('click', () => {
        copyBriefToClipboard();
    });

    // --- Initial Setup ---
    // Hide sections initially
    questionSection.style.display = 'none';
    briefOutputSection.style.display = 'none';
    translationOutputDiv.style.display = 'none';
    generateBriefBtn.style.display = 'none';

}); // End DOMContentLoaded
