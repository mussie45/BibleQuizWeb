/**
 * BibleQuiz - main.js
 * References datasets from quiz_data.js (or fallback JSON files)
 * and iterates questions randomly.
 */

"use strict";

// State
let currentQuizState = {
    mode: "general", // "general" or "verse"
    difficulty: "easy", // "easy", "medium", "hard"
    testament: "both", // "both", "ot", "nt"
    questionCount: 10,
    questionsQueue: [],
    currentIndex: 0,
    score: 0,
    timer: null,
    timeLeft: 15,
    isAnswered: false,
    dataReady: false
};

// Global datasets (loaded from quiz_data.js or fetched)
let bibleData = null;
let quizData = null;

// DOM Elements
const elements = {
    modeButtons: document.querySelectorAll(".mode-btn"),
    diffButtons: document.querySelectorAll(".diff-btn"),
    testamentButtons: document.querySelectorAll(".testament-btn"),
    countButtons: document.querySelectorAll(".count-btn"),
    difficultyGroup: document.getElementById("difficulty-group"),
    testamentGroup: document.getElementById("testament-group"),
    startQuizBtn: document.getElementById("start-quiz-btn"),
    modeBadge: document.getElementById("current-mode-badge"),
    questionProgress: document.getElementById("question-progress"),
    progressBar: document.getElementById("progress-bar"),
    timerBox: document.getElementById("timer-box"),
    timeLeft: document.getElementById("time-left"),
    questionDisplay: document.getElementById("question-display"),
    feedbackMsg: document.getElementById("feedback-msg"),
    optionsContainer: document.getElementById("options-container"),
    liveScore: document.getElementById("live-score"),
    totalAnswered: document.getElementById("total-answered"),
    nextBtn: document.getElementById("next-btn"),
    resultCard: document.getElementById("result-card"),
    resultIcon: document.getElementById("result-icon"),
    resultTitle: document.getElementById("result-title"),
    finalScore: document.getElementById("final-score"),
    finalTotal: document.getElementById("final-total"),
    scorePercentage: document.getElementById("score-percentage"),
    resultVerdict: document.getElementById("result-verdict"),
    playAgainBtn: document.getElementById("play-again-btn"),
    leaderboardBody: document.getElementById("leaderboard-body"),
    clearScoresBtn: document.getElementById("clear-scores-btn")
};

// --- DATA INITIALIZATION ---
async function initializeData() {
    // 1. Direct memory load from quiz_data.js (no CORS blockage on local file:///)
    if (window.bibleData && window.quizData) {
        bibleData = window.bibleData;
        quizData = window.quizData;
        currentQuizState.dataReady = true;
        console.log("Bible datasets successfully loaded from quiz_data.js");
        startNewQuiz();
        return;
    }

    // 2. Fallback fetch if running through a local web server
    try {
        const [bibleRes, quizRes] = await Promise.all([
            fetch("./kjv_bible_dataset.json"),
            fetch("./bible_quiz.json")
        ]);

        if (!bibleRes.ok) throw new Error("Could not fetch kjv_bible_dataset.json");
        if (!quizRes.ok) throw new Error("Could not fetch bible_quiz.json");

        bibleData = await bibleRes.json();
        quizData = await quizRes.json();
        currentQuizState.dataReady = true;
        console.log("Bible datasets loaded via fetch");
        startNewQuiz();
    } catch (err) {
        console.error("Data load error:", err);
        if (elements.questionDisplay) {
            elements.questionDisplay.textContent = "Scripture datasets could not be loaded. Please ensure quiz_data.js is present.";
        }
    }
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
    // Mode switcher buttons
    elements.modeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            elements.modeButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentQuizState.mode = btn.dataset.mode;

            if (currentQuizState.mode === "general") {
                elements.difficultyGroup.classList.remove("hidden");
                elements.testamentGroup.classList.add("hidden");
            } else {
                elements.difficultyGroup.classList.add("hidden");
                elements.testamentGroup.classList.remove("hidden");
            }
        });
    });

    // Difficulty switcher buttons
    elements.diffButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            elements.diffButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentQuizState.difficulty = btn.dataset.diff;
        });
    });

    // Testament switcher buttons
    elements.testamentButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            elements.testamentButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentQuizState.testament = btn.dataset.testament;
        });
    });

    // Question count buttons
    elements.countButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            elements.countButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentQuizState.questionCount = parseInt(btn.dataset.count, 10) || 10;
        });
    });

    // Start / Restart Quiz
    if (elements.startQuizBtn) {
        elements.startQuizBtn.addEventListener("click", () => {
            startNewQuiz();
        });
    }

    if (elements.playAgainBtn) {
        elements.playAgainBtn.addEventListener("click", () => {
            startNewQuiz();
            document.getElementById("quiz").scrollIntoView({ behavior: "smooth" });
        });
    }

    // Next Question Button
    if (elements.nextBtn) {
        elements.nextBtn.addEventListener("click", () => {
            nextQuestion();
        });
    }

    // Clear leaderboard history
    if (elements.clearScoresBtn) {
        elements.clearScoresBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to clear your quiz history?")) {
                localStorage.removeItem("bible_quiz_scores");
                renderLeaderboard();
            }
        });
    }
}

// Global mode select helper for top nav links
window.selectMode = function(modeName) {
    const targetBtn = Array.from(elements.modeButtons).find(btn => btn.dataset.mode === modeName);
    if (targetBtn) targetBtn.click();
    startNewQuiz();
};

// --- RANDOM ITERATION ENGINE ---

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Randomly generate question pool
function generateQuestionsQueue() {
    if (!currentQuizState.dataReady) return [];

    const requestedCount = currentQuizState.questionCount || 10;

    if (currentQuizState.mode === "general") {
        // General questions mode: read from quizData
        const diffKey = `${currentQuizState.difficulty}_questions`;
        const bank = quizData[diffKey] || [];
        const count = Math.min(requestedCount, bank.length);
        const selected = shuffle(bank).slice(0, count);

        return selected.map((item) => {
            const optionEntries = Object.entries(item.options || {});
            const optionsObj = {};

            optionEntries.forEach(([key, text]) => {
                const cleanKey = key.replace(".", "").trim().toUpperCase();
                optionsObj[cleanKey] = String(text);
            });

            const correctKey = String(item.correct_option || "")
                .replace(".", "")
                .trim()
                .toUpperCase();

            return {
                type: "general",
                questionText: item.question,
                options: optionsObj,
                correctKey: correctKey
            };
        });
    } else {
        // Choose by Verse challenge: read from bibleData (31,102 verses)
        let books = [];
        if (currentQuizState.testament === "ot") {
            books = [bibleData[0]]; // Old Testament
        } else if (currentQuizState.testament === "nt") {
            books = [bibleData[1]]; // New Testament
        } else {
            books = [bibleData[0], bibleData[1]]; // Both Testaments
        }

        // Collect all reference keys
        const allRefs = [];
        books.forEach(b => {
            if (b && typeof b === "object") {
                allRefs.push(...Object.keys(b));
            }
        });

        const count = Math.min(requestedCount, allRefs.length);

        // Pick unique random verses without slow array cloning
        const pickedRefs = [];
        const usedIndices = new Set();
        while (pickedRefs.length < count && pickedRefs.length < allRefs.length) {
            const randIdx = Math.floor(Math.random() * allRefs.length);
            if (!usedIndices.has(randIdx)) {
                usedIndices.add(randIdx);
                pickedRefs.push(allRefs[randIdx]);
            }
        }

        return pickedRefs.map((correctReference) => {
            // Find verse text
            let verseText = "";
            for (const book of books) {
                if (book && book[correctReference]) {
                    verseText = book[correctReference];
                    break;
                }
            }

            // Pick 3 random distinct wrong references
            const wrongRefs = [];
            while (wrongRefs.length < 3) {
                const randIdx = Math.floor(Math.random() * allRefs.length);
                const candidate = allRefs[randIdx];
                if (candidate !== correctReference && !wrongRefs.includes(candidate)) {
                    wrongRefs.push(candidate);
                }
            }

            const fourChoices = shuffle([correctReference, ...wrongRefs]);
            const keys = ["A", "B", "C", "D"];
            const optionsObj = {};
            let correctKey = "A";

            fourChoices.forEach((choice, idx) => {
                const k = keys[idx];
                optionsObj[k] = choice;
                if (choice === correctReference) {
                    correctKey = k;
                }
            });

            return {
                type: "verse",
                questionText: `Which Scripture reference contains this verse:\n"${verseText.replace(/^#\s*/, '').trim()}"`,
                options: optionsObj,
                correctKey: correctKey,
                correctRef: correctReference
            };
        });
    }
}

// --- QUIZ GAMEPLAY FLOW ---

function startNewQuiz() {
    if (!currentQuizState.dataReady) return;

    currentQuizState.questionsQueue = generateQuestionsQueue();
    currentQuizState.currentIndex = 0;
    currentQuizState.score = 0;

    // Reset UI Elements
    elements.resultCard.classList.add("hidden");
    elements.questionDisplay.classList.remove("hidden");
    elements.optionsContainer.classList.remove("hidden");
    elements.feedbackMsg.classList.remove("show");
    elements.feedbackMsg.className = "feedback-msg";
    elements.nextBtn.classList.remove("hidden");
    elements.nextBtn.disabled = true;

    // Update Badge
    if (currentQuizState.mode === "general") {
        const diffLabel = currentQuizState.difficulty.toUpperCase();
        elements.modeBadge.textContent = `Mode: General (${diffLabel})`;
    } else {
        const testLabel = currentQuizState.testament.toUpperCase();
        elements.modeBadge.textContent = `Mode: Verse (${testLabel})`;
    }

    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    clearInterval(currentQuizState.timer);
    currentQuizState.isAnswered = false;
    currentQuizState.timeLeft = 15;

    const totalQ = currentQuizState.questionsQueue.length;
    const currentQ = currentQuizState.questionsQueue[currentQuizState.currentIndex];

    if (!currentQ) {
        finishQuiz();
        return;
    }

    // Status bar updates
    const qNum = currentQuizState.currentIndex + 1;
    elements.questionProgress.textContent = `Question ${qNum} of ${totalQ}`;
    const progressPercent = (qNum / totalQ) * 100;
    elements.progressBar.style.width = `${progressPercent}%`;

    elements.liveScore.textContent = currentQuizState.score;
    elements.totalAnswered.textContent = currentQuizState.currentIndex;

    // Timer Reset
    elements.timeLeft.textContent = currentQuizState.timeLeft;
    elements.timerBox.classList.remove("danger");

    // Display question text
    elements.questionDisplay.textContent = currentQ.questionText;

    // Clear feedback
    elements.feedbackMsg.className = "feedback-msg";
    elements.feedbackMsg.textContent = "";

    // Render Options
    renderOptions(currentQ);

    // Disable Next button until user answers
    elements.nextBtn.disabled = true;
    if (currentQuizState.currentIndex === totalQ - 1) {
        elements.nextBtn.textContent = "Finish Quiz 🏁";
    } else {
        elements.nextBtn.textContent = "Next Question →";
    }

    // Start 15-second timer
    startTimer();
}

function renderOptions(questionObj) {
    elements.optionsContainer.innerHTML = "";
    elements.optionsContainer.classList.remove("disabled");

    const optionKeys = ["A", "B", "C", "D"];
    optionKeys.forEach(key => {
        const optionVal = questionObj.options[key];
        if (!optionVal) return;

        const button = document.createElement("button");
        button.className = "option";
        button.dataset.key = key;

        button.innerHTML = `<span class="opt-prefix">${key}</span> <span>${optionVal}</span>`;

        button.addEventListener("click", () => {
            if (!currentQuizState.isAnswered) {
                handleOptionSelect(key, questionObj);
            }
        });

        elements.optionsContainer.appendChild(button);
    });
}

function startTimer() {
    clearInterval(currentQuizState.timer);
    currentQuizState.timer = setInterval(() => {
        currentQuizState.timeLeft--;
        elements.timeLeft.textContent = currentQuizState.timeLeft;

        if (currentQuizState.timeLeft <= 5) {
            elements.timerBox.classList.add("danger");
        }

        if (currentQuizState.timeLeft <= 0) {
            clearInterval(currentQuizState.timer);
            handleTimeOut();
        }
    }, 1000);
}

function handleOptionSelect(selectedKey, questionObj) {
    clearInterval(currentQuizState.timer);
    currentQuizState.isAnswered = true;
    elements.optionsContainer.classList.add("disabled");

    const correctKey = questionObj.correctKey;
    const optionButtons = elements.optionsContainer.querySelectorAll(".option");

    optionButtons.forEach(btn => {
        const btnKey = btn.dataset.key;
        if (btnKey === correctKey) {
            btn.classList.add("correct");
        }
        if (btnKey === selectedKey && selectedKey !== correctKey) {
            btn.classList.add("wrong");
        }
    });

    if (selectedKey === correctKey) {
        currentQuizState.score++;
        elements.feedbackMsg.textContent = "✅ Correct! Good job! 🎉";
        elements.feedbackMsg.className = "feedback-msg show correct";
    } else {
        const refNote = questionObj.correctRef ? ` (${questionObj.correctRef})` : "";
        elements.feedbackMsg.textContent = `❌ Incorrect. Go and read your Bible! 📖${refNote}`;
        elements.feedbackMsg.className = "feedback-msg show wrong";
    }

    elements.liveScore.textContent = currentQuizState.score;
    elements.totalAnswered.textContent = currentQuizState.currentIndex + 1;
    elements.nextBtn.disabled = false;
}

function handleTimeOut() {
    currentQuizState.isAnswered = true;
    elements.optionsContainer.classList.add("disabled");

    const currentQ = currentQuizState.questionsQueue[currentQuizState.currentIndex];
    const correctKey = currentQ.correctKey;

    const optionButtons = elements.optionsContainer.querySelectorAll(".option");
    optionButtons.forEach(btn => {
        if (btn.dataset.key === correctKey) {
            btn.classList.add("correct");
        }
    });

    elements.feedbackMsg.textContent = `⏰ Time's up! Correct answer was ${correctKey}. Keep studying Scripture! 📖`;
    elements.feedbackMsg.className = "feedback-msg show wrong";

    elements.totalAnswered.textContent = currentQuizState.currentIndex + 1;
    elements.nextBtn.disabled = false;
}

function nextQuestion() {
    currentQuizState.currentIndex++;
    if (currentQuizState.currentIndex < currentQuizState.questionsQueue.length) {
        displayCurrentQuestion();
    } else {
        finishQuiz();
    }
}

// --- RESULTS & LEADERBOARD ---

function finishQuiz() {
    clearInterval(currentQuizState.timer);

    elements.questionDisplay.classList.add("hidden");
    elements.optionsContainer.classList.add("hidden");
    elements.feedbackMsg.classList.remove("show");
    elements.nextBtn.classList.add("hidden");
    elements.resultCard.classList.remove("hidden");

    const score = currentQuizState.score;
    const total = currentQuizState.questionsQueue.length;
    const percentage = Math.round((score / total) * 100);

    elements.finalScore.textContent = score;
    elements.finalTotal.textContent = total;
    elements.scorePercentage.textContent = `${percentage}%`;

    // Messages directly matching python script logic
    if (score === total) {
        elements.resultIcon.textContent = "🌟👑";
        elements.resultTitle.textContent = "Exceptional Scripture Master!";
        elements.resultVerdict.textContent = "That means your knowledge is deep! Great work and keep studying! 📖✨";
    } else if (score >= Math.ceil(total * 0.7)) {
        elements.resultIcon.textContent = "🎉📖";
        elements.resultTitle.textContent = "Well Done!";
        elements.resultVerdict.textContent = "Great effort! Keep reading your Bible to master every chapter and verse! 🙏";
    } else {
        elements.resultIcon.textContent = "📖💡";
        elements.resultTitle.textContent = "Keep Learning!";
        elements.resultVerdict.textContent = "Read your bible to improve your mark and knowledge! 😇❤️";
    }

    saveQuizScore(score, total, percentage);
    renderLeaderboard();
}

function saveQuizScore(score, total, percentage) {
    try {
        const history = JSON.parse(localStorage.getItem("bible_quiz_scores") || "[]");
        const newRecord = {
            mode: currentQuizState.mode === "general" ? "General" : "Verse Challenge",
            difficulty: currentQuizState.mode === "general" ? currentQuizState.difficulty.toUpperCase() : currentQuizState.testament.toUpperCase(),
            score: `${score}/${total}`,
            percentage: `${percentage}%`,
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
        history.unshift(newRecord);
        if (history.length > 15) history.pop();
        localStorage.setItem("bible_quiz_scores", JSON.stringify(history));
    } catch (e) {
        console.warn("Storage unavailable:", e);
    }
}

function renderLeaderboard() {
    if (!elements.leaderboardBody) return;
    try {
        const history = JSON.parse(localStorage.getItem("bible_quiz_scores") || "[]");
        if (history.length === 0) {
            elements.leaderboardBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding: 20px; color:#777;">
                        No games played yet. Complete a quiz to see your scores here!
                    </td>
                </tr>
            `;
            return;
        }

        elements.leaderboardBody.innerHTML = history.map((item, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${item.mode}</td>
                <td><span style="font-size:12px; font-weight:700; background:#E4EDE3; padding:2px 8px; border-radius:12px;">${item.difficulty}</span></td>
                <td><strong>${item.score}</strong></td>
                <td>${item.percentage}</td>
                <td style="color:#666; font-size:13px;">${item.date}</td>
            </tr>
        `).join("");
    } catch (e) {
        console.warn("Could not load leaderboard:", e);
    }
}

// Start on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    renderLeaderboard();
    initializeData();
});
