const API_BASE = "/api";

// Navigation & Chat Interface Logic
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarLabels = document.querySelectorAll('.sidebar-label');
const aiFab = document.getElementById('ai-fab');
const themeToggle = document.getElementById('theme-toggle');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const pageViews = document.querySelectorAll('.page-view');

// Initialize Lucide Icons
lucide.createIcons();

const toggleSidebar = () => {
    const isCollapsed = sidebar.classList.toggle('w-20');
    sidebar.classList.toggle('w-64');
    
    const chevron = document.getElementById('chevron-icon');
    chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    
    sidebarLabels.forEach(label => {
        if (isCollapsed) {
            label.classList.add('opacity-0');
            setTimeout(() => label.classList.add('hidden'), 300);
        } else {
            label.classList.remove('hidden');
            setTimeout(() => label.classList.remove('opacity-0'), 50);
        }
    });
};

// Centralized Page Navigation
const navigateToPage = (pageId) => {
    // Update Sidebar Links
    sidebarLinks.forEach(link => {
        const isTarget = link.getAttribute('data-page') === pageId;
        link.classList.toggle('active', isTarget);
    });

    // Toggle Page Visibility
    pageViews.forEach(view => {
        view.classList.toggle('hidden', view.id !== `page-${pageId}`);
    });

    if (pageId === 'vault') fetchVaultFiles();
    if (pageId === 'exchange') fetchExchangeItems();
};

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage(link.getAttribute('data-page'));
    });
});

aiFab.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToPage(aiFab.getAttribute('data-page'));
});

const toggleTheme = () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    const icon = document.getElementById('theme-icon');
    // Toggle icon between Moon and Sun
    icon.innerHTML = isLight 
        ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>'
        : '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>';
};

sidebarToggle.addEventListener('click', toggleSidebar);
themeToggle.addEventListener('click', toggleTheme);

// 0. Connectivity Check
async function checkConnection() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        console.log("Backend Status:", data.status);
        console.log(`Database Status: ${data.database} (${data.total_records} records)`);
    } catch (e) {
        console.error("Critical Error: Backend is unreachable.");
    }
}

// 1. Risk Assessment Logic
async function fetchRisk() {
    try {
        const response = await fetch(`${API_BASE}/risk-assessment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ income: 18000, attendance: 72, delays: 4 })
        });
        
        if (!response.ok) throw new Error("Backend Error");

        const data = await response.json();
        const el = document.getElementById('risk-result');
        el.innerText = `${data.risk_level} Risk`;
        el.className = `text-5xl font-bold mb-2 ${data.risk_level === 'High' ? 'text-red-400' : data.risk_level === 'Medium' ? 'text-yellow-400' : 'text-green-400'}`;
        
        // High Risk Alert Pulse
        if (data.risk_level === 'High') aiFab.classList.add('pulse-red');
        else aiFab.classList.remove('pulse-red');

        // Update Masonry Stats
        document.getElementById('income-stat').innerText = "₹18,000";
        document.getElementById('attendance-stat').innerText = "72%";

        // Hardcoded data from user brief for demonstration, usually parsed from AI
        renderBriefDetails();
    } catch (e) { 
        console.error("Risk Assessment Failed:", e); 
        document.getElementById('risk-result').innerText = "Offline";
    }
}

function renderBriefDetails() {
    const financial = "• Insufficient Income: Leading to financial difficulties.<br>• Limited flexibility to absorb shocks.";
    const academic = "• Below Average Attendance: Suggests struggle to stay engaged.<br>• High risk of falling behind in coursework.";
    const social = "• Potential mental health impact due to stress.<br>• Risk of social isolation due to resources.";
    const strategy = "<b>Prioritize Financial Management:</b> Create a budget that allocates resources efficiently to ensure a stable financial foundation.";

    document.getElementById('financial-risk-list').innerHTML = financial;
    document.getElementById('academic-risk-list').innerHTML = academic;
    document.getElementById('social-risk-list').innerHTML = social;
    document.getElementById('strategy-text').innerHTML = strategy;
}

// 3. Vault Logic
async function fetchVaultFiles() {
    try {
        const res = await fetch(`${API_BASE}/vault/files`);
        const files = await res.json();
        renderVault(files);
    } catch (e) {
        console.error("Failed to fetch vault files:", e);
    }
}

function renderVault(files) {
    const container = document.getElementById('vault-list');
    const emptyState = document.getElementById('vault-empty-state');
    container.innerHTML = '';

    if (files.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    files.forEach(file => {
        const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.original_name);
        const icon = isImage ? 'image' : 'file-text';
        
        const card = document.createElement('div');
        card.className = "bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between group hover:border-slate-600 transition";
        card.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5 text-blue-400"></i>
                </div>
                <div class="overflow-hidden">
                    <p class="text-sm font-medium text-slate-200 truncate" title="${file.original_name}">${file.original_name}</p>
                    <a href="${API_BASE}/vault/view/${file.filename}" target="_blank" class="text-xs text-blue-500 hover:underline">View Document</a>
                </div>
            </div>
            <button onclick="deleteVaultFile(${file.id})" class="p-2 text-slate-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}

async function deleteVaultFile(fileId) {
    if (!confirm("Are you sure you want to remove this document?")) return;
    try {
        const res = await fetch(`${API_BASE}/vault/files/${fileId}`, { method: 'DELETE' });
        if (res.ok) fetchVaultFiles();
    } catch (e) {
        console.error("Delete failed:", e);
    }
}

document.getElementById('vault-upload-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/vault/upload`, {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            fetchVaultFiles();
            e.target.value = ''; // Reset input
        } else {
            alert("Upload failed");
        }
    } catch (err) {
        console.error("Upload error:", err);
    }
});

// 4. Exchange Hub Logic
async function fetchExchangeItems() {
    try {
        const res = await fetch(`${API_BASE}/exchange/items`);
        const items = await res.json();
        renderExchangeGrid(items);
    } catch (e) {
        console.error("Failed to fetch exchange items:", e);
    }
}

function renderExchangeGrid(items) {
    const grid = document.getElementById('exchange-grid');
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-20 text-center text-slate-500 italic">No items currently available for exchange.</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.id = `exchange-item-${item.id}`;
        card.className = "glass-card border border-white/5 flex flex-col justify-between hover:border-blue-500/30 transition group";
        
        const imgUrl = item.image_filename ? `${API_BASE}/vault/view/${item.image_filename}` : null;
        
        card.innerHTML = `
            <div>
                <div class="aspect-square bg-white/5 rounded-lg mb-4 overflow-hidden flex items-center justify-center relative">
                    ${imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover">` : '<span class="text-4xl">📚</span>'}
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <span class="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Donor: ${item.donor_name}</span>
                    </div>
                </div>
                <h3 class="font-bold text-white mb-1 truncate">${item.title}</h3>
                <p class="text-[10px] text-gray-500 uppercase tracking-tighter">Availability: Immediate</p>
            </div>
            <div class="flex flex-col gap-2 mt-6">
                <button onclick="handleExchangeInterest(${item.id}, true)" class="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2">
                    <i data-lucide="heart" class="w-3 h-3"></i> Interested
                </button>
                <button onclick="handleExchangeInterest(${item.id}, false)" class="w-full bg-white/5 hover:bg-white/10 text-gray-500 py-2.5 rounded-xl text-xs font-bold transition">
                    Not Interested
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
    lucide.createIcons();
}

function toggleExchangeUploadForm() {
    const form = document.getElementById('exchange-upload-form');
    form.classList.toggle('hidden');
}

async function submitExchangeItem() {
    const title = document.getElementById('exchange-title').value;
    const donor = document.getElementById('exchange-donor').value;
    const fileInput = document.getElementById('exchange-file-input');
    
    if (!title) return alert("Please provide an item title.");

    const formData = new FormData();
    formData.append('title', title);
    formData.append('donor_name', donor || 'Anonymous Student');
    if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch(`${API_BASE}/exchange/upload`, { method: 'POST', body: formData });
        if (res.ok) {
            fetchExchangeItems();
            toggleExchangeUploadForm();
        }
    } catch (e) { console.error("Upload failed", e); }
}

function handleExchangeInterest(id, interested) {
    const card = document.getElementById(`exchange-item-${id}`);
    if (!interested) {
        card.classList.add('opacity-50', 'grayscale', 'scale-95');
        setTimeout(() => card.remove(), 300);
    } else {
        alert("Request sent! The donor has been notified of your interest.");
    }
}

// 3. Chatbot
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');

// Initialize chat history with the system prompt and the initial AI message
let chatHistory = [
    {"role": "system", "content": "You are Drop Zero AI. You help students manage financial risk and find textbook donors."},
    {"role": "assistant", "content": "Hello Student! How can I assist you with your risk profile today?"}
];

// Helper to format AI responses (converts newlines and bullet points)
const formatAIResponse = (text) => {
    // Convert lines starting with * or - or digits into list items
    let formatted = text
        .replace(/^\s*[\*\-\•]\s*(.*)/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^\s*\d\.\s*(.*)/gm, '<li class="ml-4 list-decimal">$1</li>')
        .replace(/\n/g, '<br>');
    
    if (formatted.includes('<li')) return `<ul class="space-y-1">${formatted}</ul>`;
    return formatted;
};

chatInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const msg = chatInput.value.trim();
        chatBox.insertAdjacentHTML('beforeend', `
            <div class="flex flex-col items-end space-y-1">
                <span class="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Student</span>
                <div class="glass-bubble glass-bubble-user p-3 rounded-2xl rounded-tr-none max-w-[80%] text-sm text-white bubble-appear">
                    ${msg}
                </div>
            </div>
        `);
        chatInput.value = '';

        chatHistory.push({"role": "user", "content": msg}); // Add user message to history

        // Show Loading Indicator
        const loadingId = `loading-${Date.now()}`;
        chatBox.insertAdjacentHTML('beforeend', `
            <div id="${loadingId}" class="flex flex-col items-start space-y-1">
                <span class="text-[10px] uppercase tracking-widest text-blue-400 ml-2">Drop Zero AI</span>
                <div class="glass-bubble glass-bubble-ai p-4 rounded-2xl rounded-tl-none flex items-center gap-1 bubble-appear">
                    <span class="dot-pulse"></span>
                    <span class="dot-pulse" style="animation-delay: 0.2s"></span>
                    <span class="dot-pulse" style="animation-delay: 0.4s"></span>
                </div>
            </div>
        `);
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory }) // Send entire history
            });
            const data = await response.json(); // Attempt to parse JSON even if response is not ok
            if (!response.ok) {
                // If the server returned an error status, throw an error with its message
                throw new Error(data.error || "Server error occurred.");
            }
            
            // Remove Loading Indicator
            const loader = document.getElementById(loadingId);
            if (loader) loader.remove();

            chatBox.insertAdjacentHTML('beforeend', `
                <div class="flex flex-col items-start space-y-1">
                    <span class="text-[10px] uppercase tracking-widest text-blue-400 ml-2">Drop Zero AI</span>
                    <div class="glass-bubble glass-bubble-ai p-4 rounded-2xl rounded-tl-none max-w-[90%] text-sm text-blue-50 bubble-appear">
                        ${formatAIResponse(data.response)}
                    </div>
                </div>
            `);
            chatHistory.push({"role": "assistant", "content": data.response}); // Add AI response to history
        } catch (err) {
            console.error("Chatbot error:", err); // Log the actual error for debugging
            const loader = document.getElementById(loadingId);
            if (loader) loader.remove();
            
            chatBox.insertAdjacentHTML('beforeend', `<div class="text-red-400/80 p-2 text-xs italic">System Interrupt: ${err.message || 'Unknown error'}</div>`);
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});

// Init
window.onload = () => {
    checkConnection();
    fetchRisk();
};

async function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);
    
    // Transition from Landing to Dashboard
    const landing = document.getElementById('landing-view');
    const dashboard = document.getElementById('dashboard-app');
    const spline = document.querySelector('spline-viewer');
    
    landing.style.opacity = '0';
    if (spline) spline.style.opacity = '0';
    setTimeout(() => {
        landing.classList.add('hidden');
        if (spline) spline.classList.add('hidden');
        dashboard.classList.remove('hidden');
        setTimeout(() => dashboard.style.opacity = '1', 50);
    }, 1000);
}