// =================================================
// FILE: js/admin-logic.js
// DESCRIPTION: Logic for Admin Dashboard and Content Management
// =================================================

const db = firebase.firestore();
const chapterId = "Algebra";
let quill;

document.addEventListener('DOMContentLoaded', () => {
    // ১. Quill এডিটর ইনিশিয়ালাইজ করা
    if (document.getElementById('editor')) {
        quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image', 'video'],
                    ['clean']
                ]
            }
        });
    }

    loadClassList();
    loadChapterSettings();
    
    // অথেন্টিকেশন চেক
    firebase.auth().onAuthStateChanged(user => {
        if (!user) window.location.href = "../../../../login.html";
    });
});

// চ্যাপ্টার সেটিংস লোড করা
async function loadChapterSettings() {
    try {
        const doc = await db.collection("chapters").doc(chapterId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('chapterName').value = data.name || "";
            document.getElementById('chapterSubtitle').value = data.subtitle || "";
            
            // পিডিএফ লিস্ট রেন্ডার
            const pdfContainer = document.getElementById('pdfListContainer');
            if (pdfContainer) {
                pdfContainer.innerHTML = "";
                if (data.pdfs) data.pdfs.forEach(p => addRow('pdfListContainer', p.id, p.title));
            }

            // কুইজ লিস্ট রেন্ডার
            const quizContainer = document.getElementById('quizListContainer');
            if (quizContainer) {
                quizContainer.innerHTML = "";
                if (data.quizzes) data.quizzes.forEach(q => addQuizRow('quizListContainer', q.id, q.title));
            }

            // CBT লিংক
            if (data.cbtLink) {
                const cbtInput = document.getElementById('cbtLink');
                if (cbtInput) cbtInput.value = data.cbtLink;
            }
        }
    } catch (e) {
        console.error("Error loading settings:", e);
    }
}

// নতুন রো যোগ করা (PDF এর জন্য)
function addRow(containerId, idVal = "", titleVal = "") {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" placeholder="ID / Drive ID" value="${idVal}" class="item-id">
        <input type="text" placeholder="Title" value="${titleVal}" class="item-title">
        <button class="btn btn-delete" style="width:40px; padding:10px;" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
}

// কুইজ রো যোগ করা
function addQuizRow(containerId, idVal = "", titleVal = "") {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <input type="text" placeholder="Quiz ID (e.g. Qset1)" value="${idVal}" class="quiz-id">
        <input type="text" placeholder="Quiz Title" value="${titleVal}" class="quiz-title">
        <button class="btn btn-delete" style="width:40px; padding:10px;" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
}

// চ্যাপ্টার সেটিংস সেভ করা
async function saveChapterSettings() {
    const name = document.getElementById('chapterName').value;
    const subtitle = document.getElementById('chapterSubtitle').value;
    const cbtLink = document.getElementById('cbtLink')?.value || "";
    
    const pdfs = [];
    document.querySelectorAll('#pdfListContainer .item-row').forEach(row => {
        const id = row.querySelector('.item-id').value;
        const title = row.querySelector('.item-title').value;
        if (id && title) pdfs.push({ id, title });
    });

    const quizzes = [];
    document.querySelectorAll('#quizListContainer .item-row').forEach(row => {
        const id = row.querySelector('.quiz-id').value;
        const title = row.querySelector('.quiz-title').value;
        if (id && title) quizzes.push({ id, title });
    });

    // বিদ্যমান ক্লাস লিস্ট পেতে
    let classes = [];
    try {
        const existingDoc = await db.collection("chapters").doc(chapterId).get();
        if (existingDoc.exists && existingDoc.data().classes) {
            classes = existingDoc.data().classes;
        }
    } catch (e) {
        console.error("Error getting existing classes:", e);
    }

    try {
        await db.collection("chapters").doc(chapterId).set({
            name,
            subtitle,
            pdfs,
            quizzes,
            classes, // বিদ্যমান ক্লাস লিস্ট রাখা
            cbtLink,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert("✅ সেটিংস সফলভাবে সেভ হয়েছে!");
    } catch (e) {
        alert("❌ এরর: " + e.message);
    }
}

// ক্লাস লিস্ট লোড করা (ড্রপডাউনের জন্য)
async function loadClassList() {
    const select = document.getElementById('existingClasses');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- নতুন ক্লাস তৈরি করুন --</option>';
    const snap = await db.collection("class_notes").get();
    snap.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.text = `${doc.data().title} (${doc.id})`;
        select.appendChild(opt);
    });
}

// সিলেক্ট করা ক্লাস লোড করা
async function loadSelectedClass() {
    const id = document.getElementById('existingClasses').value;
    const deleteBtn = document.getElementById('deleteBtn');
    
    if (!id) {
        document.getElementById('docId').value = "";
        document.getElementById('classTitle').value = "";
        quill.root.innerHTML = "";
        if (deleteBtn) deleteBtn.style.display = "none";
        return;
    }

    const doc = await db.collection("class_notes").doc(id).get();
    if (doc.exists) {
        document.getElementById('docId').value = doc.id;
        document.getElementById('classTitle').value = doc.data().title;
        quill.root.innerHTML = doc.data().content;
        if (deleteBtn) deleteBtn.style.display = "inline-block";
    }
}

// ক্লাস ডেটা সেভ করা
async function saveClassData() {
    const id = document.getElementById('docId').value.trim();
    const title = document.getElementById('classTitle').value.trim();
    const content = quill.root.innerHTML;

    if (!id || !title) return alert("ID এবং Title অবশ্যই দিতে হবে!");

    try {
        await db.collection("class_notes").doc(id).set({
            title,
            content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // চ্যাপ্টারের ক্লাস লিস্টে এই ক্লাসটি আছে কি না চেক করা এবং আপডেট করা
        const chapDoc = await db.collection("chapters").doc(chapterId).get();
        let classes = chapDoc.exists && chapDoc.data().classes ? chapDoc.data().classes : [];
        
        if (!classes.find(c => c.id === id)) {
            classes.push({ id, title });
            await db.collection("chapters").doc(chapterId).update({ classes });
        } else {
            // যদি ক্লাস আগে থেকে থাকে, তাহলে টাইটেল আপডেট করা
            const classIndex = classes.findIndex(c => c.id === id);
            if (classIndex !== -1) {
                classes[classIndex].title = title;
                await db.collection("chapters").doc(chapterId).update({ classes });
            }
        }

        alert("✅ ক্লাস সফলভাবে সেভ হয়েছে!");
        loadClassList();
    } catch (e) {
        alert("❌ এরর: " + e.message);
    }
}

// ক্লাস ডিলিট করা
async function deleteClassData() {
    const id = document.getElementById('docId').value;
    if (!id || !confirm("আপনি কি নিশ্চিত যে এই ক্লাসটি ডিলিট করতে চান?")) return;

    try {
        await db.collection("class_notes").doc(id).delete();
        
        // চ্যাপ্টার লিস্ট থেকেও রিমুভ করা
        const chapDoc = await db.collection("chapters").doc(chapterId).get();
        if (chapDoc.exists && chapDoc.data().classes) {
            let classes = chapDoc.data().classes.filter(c => c.id !== id);
            await db.collection("chapters").doc(chapterId).update({ classes });
        }

        alert("🗑️ ক্লাস ডিলিট হয়েছে।");
        location.reload();
    } catch (e) {
        alert("❌ এরর: " + e.message);
    }
}

// প্রিভিউ ফাংশন
function previewContent() {
    const content = quill.root.innerHTML;
    const formattedContent = formatMath(content);
    
    // নতুন উইন্ডোতে প্রিভিউ দেখান
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Content Preview</title>
            <link rel="stylesheet" href="../css/class-view.css">
            <style>
                body { padding: 20px; font-family: 'Hind Siliguri', sans-serif; }
                .preview-header { background: #3498db; color: white; padding: 15px; margin: -20px -20px 20px; }
            </style>
        </head>
        <body>
            <div class="preview-header">
                <h2>📖 Content Preview</h2>
                <p>এটি দেখতে হবে যেমন স্টুডেন্টরা দেখবে</p>
            </div>
            <div class="ql-editor">
                ${formattedContent}
            </div>
        </body>
        </html>
    `);
}

// ম্যাথ ফরম্যাটিং ফাংশন
function formatMath(html) {
    // ভগ্নাংশ ফরম্যাট: \frac{a}{b} -> <div class="fraction">...</div>
    html = html.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, 
        '<div class="fraction"><span class="numerator">$1</span><span class="denominator">$2</span></div>');
    
    // পাওয়ার ফরম্যাট: x^2 -> x<sup>2</sup>
    html = html.replace(/(\w+)\^\{([^}]+)\}/g, '$1<sup>$2</sup>');
    html = html.replace(/(\w+)\^(\d+)/g, '$1<sup>$2</sup>');
    
    // স্কয়ার রুট: \sqrt{x} -> √x
    html = html.replace(/\\sqrt\{([^}]+)\}/g, '√$1');
    
    // ম্যাথ বক্স: $$...$$
    html = html.replace(/\$\$([^$]+)\$\$/g, '<div class="math-box">$1</div>');
    
    return html;
}

// অথ চেক
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "../../../../login.html";
    }
});