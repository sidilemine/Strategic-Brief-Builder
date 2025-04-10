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

    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const questionTextElement = document.getElementById('question-text');
    const answerInputElement = document.getElementById('answer-input');

    const backBtn = document.getElementById('back-btn');
    const nextBtn = document.getElementById('next-btn');
    const generateBriefBtn = document.getElementById('generate-brief-btn');

    const briefOutputCode = document.getElementById('brief-output');
    const copyBriefBtn = document.getElementById('copy-brief-btn');
    const copyStatus = document.getElementById('copy-status');

    // --- State ---
    let currentQuestionIndex = 0;
    let isLoading = false; // To prevent multiple API calls
    const userAnswers = {}; // Store answers keyed by question index and initial request

    // --- Questions ---
    // Based on the prompt, structured for easy access
    const questions = [
        // Business Context
        { id: 'business_challenge', text: "What specific business challenge or opportunity are you trying to address?" },
        { id: 'business_objectives', text: "Where does this project fit within your broader business objectives?" },
        // Current Understanding
        { id: 'current_knowledge', text: "What do you already know about this topic/audience?" },
        { id: 'assumptions', text: "What assumptions are you making that you'd like to verify?" },
        // Audience Definition
        { id: 'audience_definition', text: "Who specifically are you trying to understand better? Please describe demographics, psychographics, behaviors, etc." },
        { id: 'audience_segments', text: "Are there any specific segments within this audience that are particularly important?" },
        // Success Metrics
        { id: 'success_metrics', text: "How will you measure the success of this research or strategy work?" },
        { id: 'decision_making', text: "What decisions will be made based on these insights?" },
        // Timeline and Constraints
        { id: 'timeline', text: "What is your timeline for this project?" },
        { id: 'constraints', text: "Are there any budget constraints or other limitations we should be aware of?" },
        // Previous Research
        { id: 'previous_research', text: "Have you conducted any previous research on this topic? If yes, what did you learn?" },
        { id: 'knowledge_gaps', text: "What gaps remain in your understanding?" },
        // Stakeholders
        { id: 'stakeholders', text: "Who will be using these insights within your organization?" },
        { id: 'insight_format', text: "What format would be most useful for sharing these insights internally?" }
    ];

    // --- Functions ---

    // Helper to get answer by question ID, using the index from the questions array
    function getAnswerById(id) {
        const index = questions.findIndex(q => q.id === id);
        return userAnswers[index] || 'N/A';
    }

    function generatePlaceholderBrief() {
        // Use the initial request stored earlier
        const initialRequest = userAnswers['initial_request'] || 'N/A';
        // Generate a simple title based on the initial request (can be improved)
        const projectTitle = initialRequest.substring(0, 30) + (initialRequest.length > 30 ? '...' : '');

        const briefContent = `
# Strategic Brief: ${projectTitle}

## Business Context
- **Challenge/Opportunity:** ${getAnswerById('business_challenge')}
- **Broader Objectives:** ${getAnswerById('business_objectives')}

## Project Objectives
- **Primary Objective:** [Synthesized from answers - Placeholder]
- **Secondary Objectives:** [Synthesized from answers - Placeholder]
- **Expected Business Outcomes:** [Synthesized from answers - Placeholder]

## Target Audience
- **Definition:** ${getAnswerById('audience_definition')}
- **Key Segments:** ${getAnswerById('audience_segments')}

## Key Questions to Explore
- [Generated/Synthesized Question 1 - Placeholder]
- [Generated/Synthesized Question 2 - Placeholder]
- [Generated/Synthesized Question 3 - Placeholder]
- **Initial Request:** ${initialRequest}

## Current Knowledge & Gaps
- **Known:** ${getAnswerById('current_knowledge')}
- **Assumptions:** ${getAnswerById('assumptions')}
- **Gaps:** ${getAnswerById('knowledge_gaps')}

## Success Metrics
- **Measurement:** ${getAnswerById('success_metrics')}
- **Decisions:** ${getAnswerById('decision_making')}

## Timeline & Deliverables
- **Timeline:** ${getAnswerById('timeline')}
- **Constraints:** ${getAnswerById('constraints')}
- **Deliverable Format:** ${getAnswerById('insight_format')}

## Stakeholders & Distribution
- **Users:** ${getAnswerById('stakeholders')}
- **Distribution Format:** ${getAnswerById('insight_format')}

## Methodological Considerations
- [Suggested approaches - Placeholder based on context]
- **Previous Research:** ${getAnswerById('previous_research')}
        `.trim(); // Trim leading/trailing whitespace

        briefOutputCode.textContent = briefContent;
        briefOutputSection.style.display = 'block'; // Ensure the section is visible
    }

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
            const response = await fetch('/.netlify/functions/openai-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send the questions array along with other data
                body: JSON.stringify({ ...payload, questions: questions }),
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
            // generateBriefBtn might stay hidden depending on flow, re-enable if needed
             if (generateBriefBtn.style.display !== 'none') {
                 generateBriefBtn.disabled = false;
             }
        }
    }


    function updateProgress() {
        const progressPercentage = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
        progressBar.value = progressPercentage;
        progressText.textContent = `${progressPercentage}%`;
    }

    function displayQuestion(index) {
        if (index >= 0 && index < questions.length) {
            questionTextElement.textContent = questions[index].text;
            // Load saved answer if exists
            answerInputElement.value = userAnswers[index] || '';
            updateProgress();

            // Enable/disable back button
            backBtn.disabled = index === 0;

            // Change Next button text/visibility on the last question
            if (index === questions.length - 1) {
                nextBtn.style.display = 'none';
                generateBriefBtn.style.display = 'inline-block';
                generateBriefBtn.disabled = false; // Explicitly enable the button
            } else {
                nextBtn.style.display = 'inline-block';
                generateBriefBtn.style.display = 'none';
            }
        }
    }

    function saveAnswer() {
        // Save answer using the index as the key
        if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
            userAnswers[currentQuestionIndex] = answerInputElement.value.trim();
        }
    }

    // --- Event Listeners ---
    startQuestionsBtn.addEventListener('click', () => {
        if (initialRequestInput.value.trim() === '') {
            alert('Please enter your initial request first.');
            return;
        }
        userAnswers['initial_request'] = initialRequestInput.value.trim(); // Store initial request
        initialRequestSection.style.display = 'none';
        questionSection.style.display = 'block';
        currentQuestionIndex = 0;
        displayQuestion(currentQuestionIndex);
    });

    nextBtn.addEventListener('click', () => {
        saveAnswer();
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion(currentQuestionIndex);
        }
    });

    backBtn.addEventListener('click', () => {
        saveAnswer(); // Save current answer before going back
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion(currentQuestionIndex);
        }
    });

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
        if (isLoading) return;

        console.log("User Answers for Generation:", userAnswers); // Log answers for debugging
        questionSection.style.display = 'none';
        briefOutputSection.style.display = 'block';
        briefOutputCode.textContent = 'Generating Brief... Please wait.'; // Show loading

        // Call the proxy function for generation
        const generatedBrief = await callOpenAIProxy({ type: 'generate', answers: userAnswers });

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
