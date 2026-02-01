// =================================================
// FILE: js/script.js
// DESCRIPTION: Main logic for dynamic content loading
// =================================================

const db = firebase.firestore();
const auth = firebase.auth();
const chapterId = "Algebra"; // আপনার চ্যাপ্টার আইডি

// === পরিবর্তন: CountUp ক্লাসটি মডিউল থেকে সঠিকভাবে ইম্পোর্ট করা হয়েছে ===
import { CountUp } from "https://cdn.jsdelivr.net/npm/countup.js@2.0.7/dist/countUp.min.js";

// এই ভেরিয়েবলটি নিশ্চিত করবে যে চার্টের প্লাগইনটি শুধু একবার রেজিস্টার হবে
let isChartPluginRegistered = false;

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    // ১. অথেন্টিকেশন চেক
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadUserData(user);
            loadDynamicContent();
            checkAdminStatus(user);
            // বিদ্যমান ফাংশনগুলো কল করা
            initAppExtended(user);
        } else {
            // টেস্টিং এর জন্য রিডাইরেক্ট বন্ধ করা হয়েছে
            console.log("User not logged in - redirect disabled for testing");
            // window.location.href = "https://keshab1997.github.io/Study-With-Keshab/login.html";
        }
    });

    // ২. ডার্ক মোড লজিক
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            darkModeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        });
    }

    // ৩. সার্চ লজিক
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            filterContent(term);
        });
    }
}

// ইউজার ডেটা লোড করা
async function loadUserData(user) {
    document.getElementById('user-display-name').innerText = user.displayName || "ছাত্র/ছাত্রী";
    document.getElementById('user-email').innerText = user.email;
    if (user.photoURL) {
        document.getElementById('user-profile-pic').src = user.photoURL;
    }
}

// অ্যাডমিন বাটন দেখানো (যদি ইমেইল ম্যাচ করে)
function checkAdminStatus(user) {
    const adminEmails = ["keshabsarkar2018@gmail.com", "admin@example.com"]; // আপনার ইমেইল এখানে দিন
    if (adminEmails.includes(user.email)) {
        const adminBtn = document.getElementById('admin-btn-top');
        if (adminBtn) adminBtn.style.display = "block";
    }
}

// ফায়ারবেস থেকে ডাইনামিক কন্টেন্ট লোড করা
function loadDynamicContent() {
    db.collection("chapters").doc(chapterId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // হেডার আপডেট
            if (data.name) document.querySelector('.header-text h1').innerText = `অধ্যায়: ${data.name}`;
            if (data.subtitle) document.querySelector('.header-text p').innerText = data.subtitle;

            // ক্লাস লিস্ট রেন্ডার
            renderClassList(data.classes || []);

            // পিডিএফ লিস্ট রেন্ডার
            if (window.updatePdfList) {
                window.updatePdfList(data.pdfs || []);
            }

            // কুইজ লিস্ট রেন্ডার
            renderQuizList(data.quizzes || []);
            
            // CBT লিংক আপডেট
            const cbtBtn = document.querySelector('.color-cbt');
            if (cbtBtn && data.cbtLink) {
                cbtBtn.href = data.cbtLink;
            }
        }
    });
}

function renderClassList(classes) {
    const container = document.getElementById('dynamic-class-list');
    if (!container) return;
    
    if (classes.length === 0) {
        container.innerHTML = "<p>কোনো ক্লাস পাওয়া যায়নি।</p>";
        return;
    }

    container.innerHTML = classes.map(c => `
        <a href="class/template.html?id=${c.id}" class="class-link">
            <i class="fa-solid fa-play-circle"></i> ${c.title}
        </a>
    `).join('');
}

function renderQuizList(quizzes) {
    const container = document.getElementById('dynamic-quiz-list');
    if (!container) return;

    if (quizzes.length === 0) {
        container.innerHTML = "<p>কোনো কুইজ পাওয়া যায়নি।</p>";
        return;
    }

    container.innerHTML = quizzes.map(q => `
        <a href="quiz/${q.id}.html" class="quiz-link">
            <i class="fa-solid fa-pen-to-square"></i> ${q.title}
        </a>
    `).join('');
}

function filterContent(term) {
    const links = document.querySelectorAll('.link-container a');
    links.forEach(link => {
        const text = link.innerText.toLowerCase();
        link.style.display = text.includes(term) ? "inline-flex" : "none";
    });
}

/**
 * Extended initialization function for existing features
 * @param {firebase.User} user - The authenticated user object.
 */
function initAppExtended(user) {
    const preloader = document.getElementById("preloader");
    if (preloader) {
        preloader.style.display = "none";
    }

    // অধ্যায়ের নাম HTML ফাইল থেকে dynamically লোড করা হচ্ছে
    let chapterName = "Algebra";
    if (typeof CURRENT_CHAPTER_NAME !== "undefined") {
        chapterName = CURRENT_CHAPTER_NAME;
    }
    const chapterKey = chapterName.replace(/\s+/g, "_").replace(/,/g, ""); // Firestore-এর জন্য নিরাপদ কী

    // --- UI সেটআপ এবং ডেটা লোড ---
    setupUserProfile(user);
    setupUIInteractions();

    // --- Firebase থেকে অধ্যায়-ভিত্তিক ডেটা লোড ---
    loadChapterLeaderboard(db, chapterKey); // অধ্যায়-ভিত্তিক লিডারবোর্ড
    loadDashboardData(db, user.uid, chapterKey); // অধ্যায়-ভিত্তিক ড্যাশবোর্ড

    // আপনার উন্নত রেজাল্ট কার্ড ফাংশনটি এখানে কল করা হচ্ছে
    generateUserResult(db, user, chapterKey, chapterName);
}

// ===============================================
// --- UI Setup Functions ---
// ===============================================

function setupUserProfile(user) {
    const displayNameElement = document.getElementById("user-display-name");
    const emailElement = document.getElementById("user-email");
    const profilePicElement = document.getElementById("user-profile-pic");

    if (displayNameElement)
        displayNameElement.textContent = user.displayName || "ব্যবহারকারী";
    if (emailElement) emailElement.textContent = user.email;
    if (profilePicElement) {
        profilePicElement.src =
            user.photoURL || "/Study-With-Keshab/images/default-avatar.png";
    }
}

function setupUIInteractions() {
    // Dark Mode Toggle
    const darkModeToggle = document.getElementById("dark-mode-toggle");
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.replace("day-mode", "dark-mode");
        if (darkModeToggle)
            darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    if (darkModeToggle) {
        darkModeToggle.addEventListener("click", () => {
            if (document.body.classList.contains("dark-mode")) {
                document.body.classList.replace("dark-mode", "day-mode");
                darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem("theme", "day");
            } else {
                document.body.classList.replace("day-mode", "dark-mode");
                darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
                localStorage.setItem("theme", "dark");
            }
            if (window.myPieChart) window.myPieChart.update();
        });
    }

    // Search Bar
    const searchBar = document.getElementById("search-bar");
    if (searchBar) {
        searchBar.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase();
            document
                .querySelectorAll("main section.card")
                .forEach((section) => {
                    const title =
                        section
                            .querySelector("h2")
                            ?.textContent.toLowerCase() || "";
                    const content = section.textContent.toLowerCase();
                    section.style.display =
                        title.includes(query) || content.includes(query)
                            ? ""
                            : "none";
                });
        });
    }

    // Formula Modal
    const modal = document.getElementById("formula-modal");
    const openBtn = document.getElementById("formula-sheet-btn");
    if (modal && openBtn) {
        const closeBtn = modal.querySelector(".modal-close-btn");
        openBtn.addEventListener("click", () => modal.classList.add("active"));
        if (closeBtn)
            closeBtn.addEventListener("click", () =>
                modal.classList.remove("active"),
            );
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("active");
        });
    }

    // Back to Top button
    const backToTop = document.getElementById("back-to-top");
    if (backToTop) {
        window.addEventListener("scroll", () => {
            backToTop.style.display = window.scrollY > 300 ? "block" : "none";
        });
    }

    // Leaderboard Dropdown Click Handler
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (leaderboardBody) {
        leaderboardBody.addEventListener("click", function (event) {
            const button = event.target.closest(".toggle-details-btn");
            if (!button) return;

            const mainRow = button.closest(".leaderboard-row");
            const detailsRow = mainRow.nextElementSibling;

            document.querySelectorAll(".details-row").forEach((row) => {
                if (row !== detailsRow && row.style.display === "table-row") {
                    row.style.display = "none";
                    const prevBtnIcon =
                        row.previousElementSibling.querySelector(
                            ".toggle-details-btn i",
                        );
                    if (prevBtnIcon) {
                        prevBtnIcon.classList.remove("fa-chevron-up");
                        prevBtnIcon.classList.add("fa-chevron-down");
                    }
                }
            });

            const icon = button.querySelector("i");
            if (detailsRow.style.display === "table-row") {
                detailsRow.style.display = "none";
                icon.classList.remove("fa-chevron-up");
                icon.classList.add("fa-chevron-down");
            } else {
                detailsRow.style.display = "table-row";
                icon.classList.remove("fa-chevron-down");
                icon.classList.add("fa-chevron-up");
            }
        });
    }
}

// ===============================================
// --- Firebase Data Loading Functions ---
// ===============================================

function loadChapterLeaderboard(db, chapterKey) {
    const leaderboardBody = document.getElementById("leaderboard-body");
    if (!leaderboardBody) return;

    leaderboardBody.innerHTML =
        '<tr><td colspan="4" style="text-align:center; padding: 20px;">লিডারবোর্ড লোড হচ্ছে...</td></tr>';

    db.collection("users")
        .orderBy(`chapters.${chapterKey}.totalScore`, "desc")
        .limit(10)
        .get()
        .then((snapshot) => {
            if (snapshot.empty) {
                leaderboardBody.innerHTML =
                    '<tr><td colspan="4" style="text-align:center; padding: 20px;">এই অধ্যায়ের জন্য কোনো স্কোর পাওয়া যায়নি।</td></tr>';
                return;
            }

            let leaderboardHTML = "";
            let rank = 1;
            let foundScores = false;

            snapshot.forEach((doc) => {
                const userData = doc.data();
                const chapterData = userData.chapters?.[chapterKey];

                if (chapterData && chapterData.totalScore > 0) {
                    foundScores = true;

                    let icon = "";
                    if (rank === 1)
                        icon =
                            '<i class="fa-solid fa-trophy" style="color: #ffd700;"></i> ';
                    else if (rank === 2)
                        icon =
                            '<i class="fa-solid fa-medal" style="color: #c0c0c0;"></i> ';
                    else if (rank === 3)
                        icon =
                            '<i class="fa-solid fa-medal" style="color: #cd7f32;"></i> ';

                    let scoreDetailsHTML = "<li>কোনো বিস্তারিত স্কোর নেই।</li>";
                    if (chapterData.quiz_sets) {
                        const sortedSets = Object.entries(
                            chapterData.quiz_sets,
                        ).sort(
                            (a, b) =>
                                parseInt(a[0].replace(/[^0-9]/g, "")) -
                                parseInt(b[0].replace(/[^0-9]/g, "")),
                        );

                        scoreDetailsHTML = sortedSets
                            .map(([setName, setData]) => {
                                const cleanSetName = setName.replace(/_/g, " ");
                                return `<li><span class="label">${cleanSetName}:</span> ${setData.score}/${setData.totalQuestions}</li>`;
                            })
                            .join("");
                    }

                    leaderboardHTML += `
                        <tr class="leaderboard-row">
                            <td>${icon}${rank}</td>
                            <td>${userData.displayName || "Unknown User"}</td>
                            <td><strong>${chapterData.totalScore}</strong></td>
                            <td><button class="toggle-details-btn" aria-label="বিস্তারিত দেখুন"><i class="fas fa-chevron-down"></i></button></td>
                        </tr>
                        <tr class="details-row">
                            <td colspan="4"><div class="details-content"><ul>${scoreDetailsHTML}</ul></div></td>
                        </tr>
                    `;
                    rank++;
                }
            });

            if (foundScores) {
                leaderboardBody.innerHTML = leaderboardHTML;
            } else {
                leaderboardBody.innerHTML =
                    '<tr><td colspan="4" style="text-align:center; padding: 20px;">এই অধ্যায়ের জন্য কোনো স্কোর পাওয়া যায়নি।</td></tr>';
            }
        })
        .catch((error) => {
            console.error("Error loading chapter leaderboard:", error);
            leaderboardBody.innerHTML =
                '<tr><td colspan="4" style="text-align:center; padding: 20px;">ত্রুটি: লিডারবোর্ড লোড করা যায়নি।</td></tr>';
        });
}

function generateUserResult(db, user, chapterKey, chapterDisplayName) {
    const resultContainer = document.getElementById("result-card-container");
    const noResultMessage = document.getElementById("no-result-message");
    if (!resultContainer || !noResultMessage) return;

    db.collection("users")
        .orderBy(`chapters.${chapterKey}.totalScore`, "desc")
        .get()
        .then((snapshot) => {
            let userFound = false;
            let rank = 0;

            const filteredDocs = snapshot.docs.filter(
                (doc) => doc.data().chapters?.[chapterKey]?.totalScore > 0,
            );
            const totalParticipants = filteredDocs.length;

            filteredDocs.forEach((doc, index) => {
                if (doc.id === user.uid) {
                    userFound = true;
                    rank = index + 1;
                    const chapterData = doc.data().chapters[chapterKey];
                    const score = chapterData.totalScore || 0;
                    const userName = user.displayName || "Unknown User";
                    const userPhoto =
                        user.photoURL ||
                        "/Study-With-Keshab/images/default-avatar.png";

                    const totalCorrect = chapterData.totalCorrect || 0;

                    // === ## পরিবর্তন: মোট প্রশ্ন গণনার লজিক ঠিক করা হয়েছে ## ===
                    const totalQuestions = chapterData.quiz_sets
                        ? Object.values(chapterData.quiz_sets).reduce(
                              (sum, set) => sum + set.totalQuestions,
                              0,
                          )
                        : 0;

                    const accuracy =
                        totalQuestions > 0
                            ? Math.round((totalCorrect / totalQuestions) * 100)
                            : 0;
                    const betterThanPercentage =
                        totalParticipants > 1
                            ? Math.round(
                                  ((totalParticipants - rank) /
                                      (totalParticipants - 1)) *
                                      100,
                              )
                            : 100;

                    let rankClass = "rank-bronze";
                    if (rank <= 3) rankClass = "rank-gold";
                    else if (rank <= 10) rankClass = "rank-silver";

                    const badges = [];
                    const totalQuizzes = document.querySelectorAll(
                        "#quiz-sets .link-container a",
                    ).length;
                    const completedQuizzesCount =
                        chapterData.completedQuizzesCount || 0;

                    if (rank === 1) {
                        badges.push({
                            text: "🏆 অধ্যায়ের সেরা",
                            class: "topper",
                        });
                    } else if (rank <= 3) {
                        badges.push({
                            text: "🥈 শীর্ষ তিনে",
                            class: "top-three",
                        });
                    } else if (rank <= 10) {
                        badges.push({ text: "🥉 শীর্ষ দশে", class: "top-ten" });
                    } else if (
                        totalParticipants > 10 &&
                        rank <= Math.ceil(totalParticipants * 0.25)
                    ) {
                        badges.push({
                            text: "🌟 উঠতি তারকা",
                            class: "rising-star",
                        });
                    }

                    if (accuracy >= 95) {
                        badges.push({
                            text: "🎯 নির্ভুলতার রাজা",
                            class: "accuracy",
                        });
                    } else if (accuracy >= 85) {
                        badges.push({
                            text: "✅ দারুণ নির্ভুলতা",
                            class: "high-accuracy",
                        });
                    }

                    if (
                        totalQuizzes > 0 &&
                        completedQuizzesCount >= totalQuizzes
                    ) {
                        badges.push({
                            text: "💯 সম্পূর্ণকারী",
                            class: "completionist",
                        });
                    }

                    let motivationalMessage = "";
                    if (accuracy >= 90)
                        motivationalMessage =
                            "অসাধারণ! তোমার প্রস্তুতি শিখরে। চালিয়ে যাও!";
                    else if (accuracy >= 70)
                        motivationalMessage =
                            "দারুণ চেষ্টা! ভুলগুলো আরেকবার দেখে নিলেই তুমি সেরা হবে।";
                    else
                        motivationalMessage =
                            "চিন্তার কিছু নেই, প্রতিটি ভুলই নতুন কিছু শেখার সুযোগ। আবার চেষ্টা করো!";

                    const cleanChapterName = chapterDisplayName.replace(
                        "Biology ",
                        "",
                    );
                    const shareText = `আমি '${cleanChapterName}' অধ্যায়ে ${score} স্কোর করেছি! Study With Keshab-এ আমার র্যাঙ্ক #${rank}। তুমিও তোমার প্রস্তুতি যাচাই করো!`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + window.location.href)}`;
                    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(shareText)}`;

                    resultContainer.innerHTML = `
                    <div class="result-card ${rankClass}">
                        <div class="result-header">
                            <img src="${userPhoto}" alt="Profile Picture" class="result-profile-pic">
                            <h3 class="result-user-name">${userName}</h3>
                            <div class="rank-badge-container">
                                ${badges.map((b) => `<span class="badge-item ${b.class}">${b.text}</span>`).join("")}
                            </div>
                        </div>

                        <p class="motivational-quote">${motivationalMessage}</p>

                        <div class="result-stats-grid">
                            <div class="chart-container">
                                <canvas id="accuracy-chart"></canvas>
                            </div>
                            <div class="result-details">
                                <div class="result-item">
                                    <h4>প্রাপ্ত নম্বর</h4>
                                    <p class="score-display">
                                        <span id="user-score">${score}</span> / <span id="total-questions-display">${totalQuestions}</span>
                                    </p>
                                </div>
                                <div class="result-item">
                                    <h4>র্যাঙ্ক</h4>
                                    <p id="user-rank">#${rank}</p>
                                </div>
                            </div>
                        </div>

                        <p class="performance-comparison">
                            আপনি এই অধ্যায়ে <strong>${betterThanPercentage}%</strong> শিক্ষার্থীর চেয়ে এগিয়ে আছেন!
                        </p>

                        <div class="result-share">
                             <p>আপনার রেজাল্ট শেয়ার করুন!</p>
                            <div class="share-buttons">
                                <a href="${whatsappUrl}" target="_blank" class="share-btn whatsapp"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                                <a href="${facebookUrl}" target="_blank" class="share-btn facebook"><i class="fab fa-facebook-f"></i> Facebook</a>
                            </div>
                            <button id="download-result-btn"><i class="fa-solid fa-camera"></i> ছবি ডাউনলোড করুন</button>
                        </div>
                    </div>
                `;

                    new CountUp("user-score", score, { duration: 1.5 }).start();
                    new CountUp("total-questions-display", totalQuestions, {
                        duration: 1.5,
                    }).start();
                    new CountUp("user-rank", rank, {
                        prefix: "#",
                        duration: 1.5,
                    }).start();

                    createAccuracyChart(accuracy);

                    document
                        .getElementById("download-result-btn")
                        .addEventListener("click", function (e) {
                            const btn = e.currentTarget;
                            const originalText = btn.innerHTML;
                            btn.innerHTML =
                                '<i class="fa-solid fa-spinner fa-spin"></i> প্রসেসিং...';
                            btn.disabled = true;

                            const resultCard =
                                document.querySelector(".result-card");
                            html2canvas(resultCard, {
                                backgroundColor:
                                    document.body.classList.contains(
                                        "dark-mode",
                                    )
                                        ? "#1e1e1e"
                                        : "#ffffff",
                                scale: 2,
                                useCORS: true,
                            })
                                .then((canvas) => {
                                    const link = document.createElement("a");
                                    link.download = `StudyWithKeshab-${cleanChapterName}-Result.png`;
                                    link.href = canvas.toDataURL();
                                    link.click();

                                    btn.innerHTML = originalText;
                                    btn.disabled = false;
                                })
                                .catch((err) => {
                                    console.error("Download failed:", err);
                                    btn.innerHTML =
                                        '<i class="fa-solid fa-camera"></i> ডাউনলোড ব্যর্থ হয়েছে';
                                    btn.disabled = false;
                                });
                        });
                }
            });

            if (userFound) {
                noResultMessage.style.display = "none";
                resultContainer.style.display = "block";
            } else {
                resultContainer.style.display = "none";
                noResultMessage.style.display = "block";
            }
        })
        .catch((error) => {
            console.error("Error fetching user result: ", error);
            resultContainer.innerHTML = `<p style="text-align: center;">রেজাল্ট লোড করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।</p>`;
        });
}

function createAccuracyChart(accuracy) {
    const ctx = document.getElementById("accuracy-chart")?.getContext("2d");
    if (!ctx) return;

    if (!isChartPluginRegistered) {
        Chart.plugins.register({
            beforeDraw: function (chart) {
                if (chart.options.elements.center) {
                    const centerConfig = chart.options.elements.center;
                    const ctx = chart.chart.ctx;
                    const chartArea = chart.chartArea;
                    if (!chartArea) return;

                    const fontStyle = centerConfig.fontStyle || "Arial";
                    const txt = centerConfig.text;

                    ctx.save();
                    const fontSize = (chartArea.height / 114).toFixed(2);
                    ctx.font = `bold ${fontSize}em ${fontStyle}`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    const centerX = (chartArea.left + chartArea.right) / 2;
                    const centerY = (chartArea.top + chartArea.bottom) / 2;
                    ctx.fillStyle = centerConfig.color;
                    ctx.fillText(txt, centerX, centerY);
                    ctx.restore();
                }
            },
        });
        isChartPluginRegistered = true;
    }

    const chartData = {
        datasets: [
            {
                data: [accuracy, 100 - accuracy],
                backgroundColor: ["#2ecc71", "#e74c3c"],
                borderColor: document.body.classList.contains("dark-mode")
                    ? "#34495e"
                    : "#ffffff",
                borderWidth: 4,
            },
        ],
        labels: ["সঠিক", "ভুল"],
    };

    new Chart(ctx, {
        type: "doughnut",
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutoutPercentage: 75,
            legend: { display: false },
            tooltips: {
                callbacks: {
                    label: (tooltipItem, data) =>
                        `${data.labels[tooltipItem.index]}: ${data.datasets[0].data[tooltipItem.index]}%`,
                },
            },
            elements: {
                center: {
                    text: `${accuracy}%`,
                    color: document.body.classList.contains("dark-mode")
                        ? "#ffffff"
                        : "#2c3e50",
                    fontStyle: "'Hind Silguri', sans-serif",
                },
            },
        },
    });
}

function loadDashboardData(db, userId, chapterKey) {
    const quizLinks = document.querySelectorAll("#quiz-sets .link-container a");
    const totalQuizzesInChapter = quizLinks.length;

    db.collection("users")
        .doc(userId)
        .get()
        .then((doc) => {
            let chapterData = {};
            if (
                doc.exists &&
                doc.data().chapters &&
                doc.data().chapters[chapterKey]
            ) {
                chapterData = doc.data().chapters[chapterKey];
            }

            updateChapterProgress(
                chapterData.completedQuizzesCount || 0,
                totalQuizzesInChapter,
            );
            updatePieChart(
                chapterData.totalCorrect || 0,
                chapterData.totalWrong || 0,
            );
            updateUserAchievements(chapterData, totalQuizzesInChapter);
            loadDailyChallenge();
        })
        .catch((error) => {
            console.error("Error loading user dashboard data:", error);
            updateChapterProgress(0, totalQuizzesInChapter);
            updatePieChart(0, 0);
            updateUserAchievements({}, totalQuizzesInChapter);
            loadDailyChallenge();
        });
}

// ===============================================
// --- Dashboard Update Functions ---
// ===============================================

function updateChapterProgress(completed, total) {
    const progressBar = document.getElementById("chapter-progress-bar");
    const progressText = document.getElementById("chapter-progress-text");
    if (!progressBar || !progressText) return;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}% সম্পন্ন (${completed}/${total}টি কুইজ)`;
}

window.myPieChart = null;
function updatePieChart(correct, wrong) {
    const ctx = document.getElementById("quiz-pie-chart")?.getContext("2d");
    if (!ctx) return;
    if (window.myPieChart) window.myPieChart.destroy();
    const chartData =
        correct === 0 && wrong === 0
            ? {
                  labels: ["এখনো কোনো কুইজ দেননি"],
                  datasets: [{ data: [1], backgroundColor: ["#bdc3c7"] }],
              }
            : {
                  labels: ["সঠিক উত্তর", "ভুল ও উত্তর না দেওয়া"], // Label changed for clarity
                  datasets: [
                      {
                          data: [correct, wrong],
                          backgroundColor: ["#2ecc71", "#e74c3c"],
                          borderColor: document.body.classList.contains(
                              "dark-mode",
                          )
                              ? "#1e1e1e"
                              : "#ffffff",
                          borderWidth: 3,
                      },
                  ],
              };
    window.myPieChart = new Chart(ctx, {
        type: "pie",
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false, // চার্ট সাইজ ফিক্স
            legend: {
                position: "bottom",
                labels: {
                    fontColor: document.body.classList.contains("dark-mode")
                        ? "#e0e0e0"
                        : "#34495e",
                    fontFamily: "'Hind Siliguri', sans-serif",
                },
            },
            tooltips: {
                titleFontFamily: "'Hind Siliguri', sans-serif",
                bodyFontFamily: "'Hind Siliguri', sans-serif",
            },
        },
    });
}

function updateUserAchievements(chapterData, totalQuizzes) {
    const achievementsContainer = document.getElementById(
        "achievements-container",
    );
    if (!achievementsContainer) return;
    const completedCount = chapterData.completedQuizzesCount || 0;
    const achievementConfig = [
        {
            id: "first_quiz",
            title: "প্রথম পদক্ষেপ",
            icon: "fa-shoe-prints",
            criteria: (count) => count >= 1,
            desc: "এই অধ্যায়ের প্রথম কুইজ সম্পন্ন করেছেন!",
        },
        {
            id: "quiz_master",
            title: "কুইজ মাস্টার",
            icon: "fa-brain",
            criteria: (count) => count >= Math.ceil(totalQuizzes / 2),
            desc: `এই অধ্যায়ের অর্ধেক (${Math.ceil(totalQuizzes / 2)}টি) কুইজ সম্পন্ন করেছেন!`,
        },
        {
            id: "chapter_winner",
            title: "অধ্যায় বিজয়ী",
            icon: "fa-crown",
            criteria: (count) => count >= totalQuizzes,
            desc: "এই অধ্যায়ের সব কুইজ সম্পন্ন করেছেন!",
        },
    ];
    achievementsContainer.innerHTML = "";
    achievementConfig.forEach((ach) => {
        const unlocked = ach.criteria(completedCount);
        const badge = document.createElement("div");
        badge.className = `achievement-badge ${unlocked ? "unlocked" : ""}`;
        badge.title = `${ach.title} - ${ach.desc}`;
        badge.innerHTML = `<i class="fa-solid ${ach.icon}"></i><span>${ach.title}</span>`;
        achievementsContainer.appendChild(badge);
    });
}

function loadDailyChallenge() {
    const challengeText = document.getElementById("challenge-text");
    if (!challengeText) return;
    const challenges = [
        "আজকে কমপক্ষে ২টি কুইজ সেট সমাধান করো।",
        "সূত্র তালিকাটি সম্পূর্ণ মুখস্থ করে ফেলো।",
        "যেকোনো একটি ক্লাস নোট সম্পূর্ণ রিভিশন দাও।",
        "একটি কঠিন প্রশ্নের ব্যাখ্যা ভালো করে বুঝে নাও।",
    ];
    const dayOfYear = Math.floor(
        (new Date() - new Date(new Date().getFullYear(), 0, 0)) /
            (1000 * 60 * 60 * 24),
    );
    challengeText.textContent = challenges[dayOfYear % challenges.length];
}

// প্রি-লোডার বন্ধ করা
window.onload = () => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.style.opacity = '0';
    setTimeout(() => { if (preloader) preloader.style.display = 'none'; }, 500);
};