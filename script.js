// Removed docx import as download functionality is removed

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
    const clarificationOptionsContainer = document.getElementById('clarification-options');
    const useClarificationsBtn = document.getElementById('use-clarifications-btn');


    const questionTextElement = document.getElementById('question-text');
    const answerInputElement = document.getElementById('answer-input');

    const nextBtn = document.getElementById('next-btn');
    const skipQuestionBtn = document.getElementById('skip-question-btn');
    const skipTopicBtn = document.getElementById('skip-topic-btn');
    const generateBriefBtn = document.getElementById('generate-brief-btn');

    // Updated brief output element reference
    const briefOutputHtml = document.getElementById('brief-output-html');
    const copyBriefBtn = document.getElementById('copy-brief-btn');
    const downloadDocxBtn = document.getElementById('download-docx-btn');
    const copyStatus = document.getElementById('copy-status');

    // --- State ---
    let isLoading = false;
    let conversationHistory = [];
    let topics = [];
    let currentTopic = null;
    let currentAssistantQuestion = null;
    let rawGeneratedBrief = ''; // Store the raw markdown brief

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

    function copyBriefToClipboard() {
        // Get text content from the HTML div
        const briefText = briefOutputHtml.textContent;
        navigator.clipboard.writeText(briefText).then(() => {
            alert('Brief copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy brief: ', err);
            alert('Failed to copy brief. Please copy manually.');
        });
    }

    // --- Function to render Markdown-like text as HTML ---
    function renderBriefHtml(markdownText) {
        if (!markdownText) {
            briefOutputHtml.innerHTML = '<p>Error: No brief content received.</p>';
            return;
        }

        // Store raw text for potential use (e.g., DOCX generation)
        rawGeneratedBrief = markdownText;

        // Basic Markdown-to-HTML conversion
        let htmlContent = markdownText
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')       // H1
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')      // H2
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')     // H3
            .split('\n') // Split into lines to handle lists and paragraphs
            .map(line => line.trimEnd()) // Trim trailing space
            .reduce((acc, line) => {
                if (line.startsWith('- ') || line.startsWith('  - ')) {
                    const text = line.replace(/^[\s*-]+\s*/, '');
                    const isIndented = line.startsWith('  -');
                    // Check if previous element was the end of a list
                    if (acc.endsWith('</ul>')) {
                         // Remove closing tag to continue list
                         acc = acc.substring(0, acc.length - 5);
                         acc += `<li style="margin-left: ${isIndented ? '20px' : '0'};">${text}</li>`;
                    } else if (acc.endsWith('</li>')) {
                         // Continue existing list
                         acc += `<li style="margin-left: ${isIndented ? '20px' : '0'};">${text}</li>`;
                    } else {
                         // Start a new list
                         acc += `<ul><li style="margin-left: ${isIndented ? '20px' : '0'};">${text}</li>`;
                    }
                } else {
                    // If previous line was a list item, close the list
                    if (acc.endsWith('</li>')) {
                        acc += '</ul>';
                    }
                    // Add paragraph or heading (already converted) or break
                    if (line.startsWith('<h')) {
                         acc += line; // Add heading tags directly
                    } else if (line.trim() === '') {
                         acc += '<br>'; // Use <br> for empty lines for spacing
                    } else {
                         acc += `<p>${line}</p>`; // Wrap other lines in <p>
                    }
                }
                return acc;
            }, '');

        // Close any open list at the end
        if (htmlContent.endsWith('</li>')) {
            htmlContent += '</ul>';
        }

        briefOutputHtml.innerHTML = htmlContent;
    }


    // --- Function to generate and download DOCX using 'docx' library ---
    async function downloadBriefAsDocx() {
        // Use the stored raw markdown text for DOCX generation
        const briefText = rawGeneratedBrief;
        if (!briefText || briefText === 'Generating Brief... Please wait.' || briefText === 'Brief generation failed.') {
            alert('Brief content is not available for download.');
            return;
        }

        try {
            copyStatus.textContent = "Generating DOCX...";
            copyStatus.style.display = 'inline';

            const lines = briefText.split('\n');
            const docSections = [];
            let currentListItems = [];

            // Define numbering for lists (Corrected Syntax)
            const numbering = new Numbering({
                config: [
                    {
                        reference: "bullet-numbering",
                        levels: [
                            {
                                level: 0,
                                format: "bullet",
                                text: "\u2022", // Bullet character
                                alignment: AlignmentType.LEFT,
                                style: {
                                    paragraph: {
                                        indent: { left: 720, hanging: 360 },
                                    },
                                },
                            },
                             {
                                level: 1, // For indented lists
                                format: "bullet",
                                text: "\u25E6", // White bullet
                                alignment: AlignmentType.LEFT,
                                style: {
                                    paragraph: {
                                        indent: { left: 1440, hanging: 360 },
                                    },
                                },
                            },
                        ],
                    },
                ], // End of config array
            }); // End of new Numbering call

            const flushList = () => {
                if (currentListItems.length > 0) {
                    currentListItems.forEach(item => {
                         const text = item.replace(/^[\s*-]+\s*/, '');
                         const isIndented = item.startsWith('  -');
                         docSections.push(new Paragraph({
                             children: [new TextRun(text)],
                             numbering: {
                                 reference: "bullet-numbering",
                                 level: isIndented ? 1 : 0,
                             },
                         }));
                    });
                    currentListItems = [];
                }
            };

            lines.forEach(line => {
                line = line.trimEnd();

                if (line.startsWith('# ')) {
                    flushList();
                    docSections.push(new Paragraph({
                        children: [new TextRun({ text: line.substring(2), bold: true, size: 32 })],
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                    }));
                } else if (line.startsWith('## ')) {
                    flushList();
                    docSections.push(new Paragraph({
                        children: [new TextRun({ text: line.substring(3), bold: true, size: 28 })],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 },
                    }));
                } else if (line.startsWith('### ')) {
                    flushList();
                     docSections.push(new Paragraph({
                        children: [new TextRun({ text: line.substring(4), bold: true, size: 24 })],
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 150, after: 80 },
                    }));
                } else if (line.startsWith('- ') || line.startsWith('  - ')) {
                    currentListItems.push(line);
                } else if (line.trim() === '') {
                    flushList();
                    docSections.push(new Paragraph(""));
                } else {
                    flushList();
                    docSections.push(new Paragraph({
                         children: [new TextRun(line)],
                         spacing: { after: 100 }
                    }));
                }
            });
            flushList(); // Add any remaining list items at the end

            // Create the document with numbering and styles
            const doc = new Document({
                numbering: numbering, // Use the defined numbering
                sections: [{
                    properties: {},
                    children: docSections,
                }],
                 styles: { // Use default styles
                     paragraphStyles: [
                         {
                             id: "Normal",
                             name: "Normal",
                             basedOn: "Normal",
                             next: "Normal",
                             quickFormat: true,
                             run: {
                                 size: 22,
                                 font: "Calibri",
                             },
                             paragraph: {
                                 spacing: { line: 276, after: 100 },
                             },
                         },
                     ],
                 },
            });

            const blob = await Packer.toBlob(doc);

            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            const titleMatch = briefText.match(/^# (.*)/m);
            const filename = titleMatch ? `${titleMatch[1].replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx` : 'strategic_insights_brief.docx';
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);

            copyStatus.textContent = "DOCX downloaded!";
            setTimeout(() => { copyStatus.style.display = 'none'; }, 2500);

        } catch (error) {
            console.error('Error generating DOCX:', error);
            if (error instanceof ReferenceError && (error.message.includes("Document is not defined") || error.message.includes("Packer is not defined"))) {
                 alert('Error: DOCX generation components failed to load. Build might be misconfigured.');
                 console.error("Bundled 'docx' library components not found. Check build process.");
            } else {
                 alert('Failed to generate .docx file.');
            }
            copyStatus.textContent = "DOCX generation failed.";
            setTimeout(() => { copyStatus.style.display = 'none'; }, 2500);
        }
    }


    function initializeTopics() {
        topics = TOPIC_DEFINITIONS.map(topic => ({ ...topic, status: 'pending', questionCount: 0 }));
        currentTopic = null;
        renderTopicList();
    }

    function renderTopicList() {
        topicListElement.innerHTML = '';
        topics.forEach(topic => {
            const li = document.createElement('li');
            li.textContent = topic.name;
            li.id = `topic-${topic.id}`;
            li.className = topic.status;
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
        topic.questionCount = 1;
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
            if (currentTopic) currentTopic.questionCount++;
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
            answerInputElement.disabled = false;
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

        if (skippedQuestion) {
             console.log("Skipped question, getting next question for topic:", currentTopic.name);
             await getNextQuestionForTopic(currentTopic);
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
        console.log("All topics processed. Preparing for brief generation.");
        questionTextElement.textContent = 'Thank you! All topics are covered. I will now use your input to generate the strategic insights brief.';
        answerInputElement.disabled = true;
        answerInputElement.style.display = 'none';
        nextBtn.style.display = 'none';
        skipQuestionBtn.style.display = 'none';
        skipTopicBtn.style.display = 'none';
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

        if (payload.type === 'get_topic_question') {
            answerInputElement.disabled = true;
        } else if (payload.type === 'check_topic_completion') {
             console.log(`Checking completion for ${payload.topic}...`);
        } else if (payload.type === 'generate') {
            briefOutputHtml.innerHTML = '<p>Generating Brief... Please wait.</p>';
        } else if (payload.type === 'translate') {
            clarificationOptionsContainer.innerHTML = '<p>Translating...</p>';
        }

        try {
            const functionEndpoint = '/api/openai-proxy'; // Vercel endpoint
            const response = await fetch(functionEndpoint, {
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
            let errorDetails = error.message;
            if (error.response && typeof error.response.text === 'function') {
                 try {
                     const errorText = await error.response.text();
                     console.error("Raw error response:", errorText);
                     try {
                         const errorJson = JSON.parse(errorText);
                         if (errorJson.error) errorDetails = errorJson.error;
                     } catch (jsonError) {
                         errorDetails = errorText.length < 100 ? errorText : error.message;
                     }
                 } catch (textError) {
                     console.error("Could not read error response text:", textError);
                 }
            }
            alert(`Error: ${errorDetails}`);
            if (payload.type === 'generate') briefOutputHtml.innerHTML = '<p>Brief generation failed.</p>';
            if (payload.type === 'translate') clarificationOptionsContainer.innerHTML = '<p>Translation failed.</p>';
            if (payload.type.includes('question') || payload.type.includes('completion')) {
                 questionTextElement.textContent = 'An error occurred fetching the next step. Please try again.';
                 answerInputElement.disabled = false;
            }
            return null;
        } finally {
            isLoading = false;
             nextBtn.disabled = originalButtonStates.next;
             skipQuestionBtn.disabled = originalButtonStates.skipQ;
             skipTopicBtn.disabled = originalButtonStates.skipT;
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
        if (initialRequest === '') { alert('Please enter your initial request first.'); return; }
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
        clarificationOptionsContainer.innerHTML = '<p>Translating...</p>';
        const translation = await callOpenAIProxy({ type: 'translate', text: initialText });

        if (translation) {
            clarificationOptionsContainer.innerHTML = '';
            const lines = translation.split('\n').filter(line => line.trim() !== '');
            let currentMainOptionDiv = null;
            let mainOptionCounter = 0;

            lines.forEach((line) => {
                const isSubObjective = line.startsWith('  -');
                const lineText = line.replace(/^[\s*-]+\s*/, '');

                if (!isSubObjective) {
                    mainOptionCounter++;
                    currentMainOptionDiv = document.createElement('div');
                    currentMainOptionDiv.style.marginBottom = '10px';
                    currentMainOptionDiv.dataset.mainText = lineText;

                    const label = document.createElement('label');
                    label.style.fontWeight = 'bold';
                    label.style.display = 'block';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = lineText;
                    checkbox.name = `clarification_main_${mainOptionCounter}`;
                    checkbox.style.marginRight = '8px';
                    checkbox.addEventListener('change', (e) => {
                        const subCheckboxes = e.target.closest('div').querySelectorAll('input[type="checkbox"][data-sub-objective="true"]');
                        subCheckboxes.forEach(subCb => subCb.checked = e.target.checked);
                    });

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(lineText));
                    currentMainOptionDiv.appendChild(label);
                    clarificationOptionsContainer.appendChild(currentMainOptionDiv);

                } else if (currentMainOptionDiv) {
                    const subLabel = document.createElement('label');
                    subLabel.style.marginLeft = '25px';
                    subLabel.style.display = 'block';
                    subLabel.style.fontWeight = 'normal';
                    subLabel.style.fontSize = '0.9em';

                    const subCheckbox = document.createElement('input');
                    subCheckbox.type = 'checkbox';
                    subCheckbox.value = lineText;
                    subCheckbox.name = `clarification_sub_${mainOptionCounter}`;
                    subCheckbox.dataset.subObjective = "true";
                    subCheckbox.style.marginRight = '8px';
                    subCheckbox.addEventListener('change', (e) => {
                         if (!e.target.checked) {
                              const mainCheckbox = e.target.closest('div').querySelector('input[type="checkbox"]:not([data-sub-objective="true"])');
                              if (mainCheckbox) mainCheckbox.checked = false;
                         }
                    });

                    subLabel.appendChild(subCheckbox);
                    subLabel.appendChild(document.createTextNode(lineText));
                    currentMainOptionDiv.appendChild(subLabel);
                }
            });
        } else {
            clarificationOptionsContainer.innerHTML = '<p>Translation failed.</p>';
        }
    });

    useClarificationsBtn.addEventListener('click', () => {
        const selectedCheckboxes = clarificationOptionsContainer.querySelectorAll('input[type="checkbox"]:checked');
        let combinedText = '';
        let processedMains = new Set();

        clarificationOptionsContainer.querySelectorAll('div').forEach(mainDiv => {
            const mainCheckbox = mainDiv.querySelector('input[type="checkbox"]:not([data-sub-objective="true"])');
            const mainText = mainDiv.dataset.mainText;
            let blockToAdd = '';
            let mainAdded = false;

            if (mainCheckbox && mainCheckbox.checked) {
                 blockToAdd += `- ${mainText}\n`;
                 mainAdded = true;
                 processedMains.add(mainText);
            }

            mainDiv.querySelectorAll('input[type="checkbox"][data-sub-objective="true"]').forEach(subCheckbox => {
                 if (subCheckbox.checked) {
                      if (!mainAdded && !processedMains.has(mainText)) {
                           blockToAdd += `- ${mainText}\n`;
                           processedMains.add(mainText);
                           mainAdded = true;
                      }
                      blockToAdd += `  - ${subCheckbox.value}\n`;
                 }
            });

            if (blockToAdd) {
                 if (combinedText) combinedText += '\n';
                 combinedText += blockToAdd;
            }
        });


        if (combinedText) {
            initialRequestInput.value = combinedText.trim();
            initialRequestInput.focus();
            translationOutputDiv.style.display = 'none';
        } else {
            alert('Please select at least one clarification option or sub-objective.');
        }
    });


    generateBriefBtn.addEventListener('click', async () => {
        if (isLoading) return;

        console.log("Requesting brief generation...");
        console.log("Conversation History:", conversationHistory);

        questionSection.style.display = 'none';
        topicSidebar.style.display = 'none';
        briefOutputSection.style.display = 'block';
        // Update loading indicator for HTML display
        briefOutputHtml.innerHTML = '<p>Generating Brief... Please wait.</p>';
        generateBriefBtn.disabled = true;

        const generatedBrief = await callOpenAIProxy({
            type: 'generate',
            history: conversationHistory
        });

        if (generatedBrief) {
            // Render the brief as HTML
            renderBriefHtml(generatedBrief);
            copyBriefBtn.disabled = false;
            downloadDocxBtn.disabled = false; // Enable download button
        } else {
            briefOutputHtml.innerHTML = '<p>Brief generation failed.</p>'; // Show error in HTML div
            copyBriefBtn.disabled = true;
            downloadDocxBtn.disabled = true;
        }
        // generateBriefBtn.disabled = false;
    });

    copyBriefBtn.addEventListener('click', copyBriefToClipboard);

    downloadDocxBtn.addEventListener('click', downloadBriefAsDocx);


    // --- Initial Setup ---
    questionSection.style.display = 'none';
    briefOutputSection.style.display = 'none';
    translationOutputDiv.style.display = 'none';
    generateBriefBtn.style.display = 'none';
    copyBriefBtn.disabled = true;
    downloadDocxBtn.disabled = true;
    topicSidebar.style.display = 'none';
    skipQuestionBtn.style.display = 'none';
    skipTopicBtn.style.display = 'none';

}); // End DOMContentLoaded
