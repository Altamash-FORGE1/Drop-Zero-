// Drop Zero - Frontend Logic

// 1. Global Transition Logic (Needs to be accessible by Google Callback)
function enterDashboard() {
    const landing = document.getElementById('landing-view');
    const dashboard = document.getElementById('dashboard-app');
    
    if (!landing || !dashboard) return;

    // Save session state so refresh doesn't reset the app
    sessionStorage.setItem('isLoggedIn', 'true');

    landing.classList.add('opacity-0');
    setTimeout(() => {
        landing.classList.add('hidden');
        dashboard.classList.remove('hidden');
        dashboard.style.display = 'flex'; // Ensure flex layout
        setTimeout(() => {
            dashboard.classList.remove('opacity-0');
            // Use the globally exposed load function
            if (window.loadDashboardData) window.loadDashboardData();
        }, 50);
    }, 500); // Reduced delay for snappier feel
}

// 2. Global Google Callback
window.handleCredentialResponse = (response) => {
    console.log("Google Login Successful");
    enterDashboard();
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) lucide.createIcons();

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('header button.md\\:hidden');
    const sidebar = document.getElementById('sidebar');
    
    mobileMenuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        sidebar.classList.toggle('fixed');
        sidebar.classList.toggle('inset-0');
    });

    // Check for existing session
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        // Skip landing animation and go straight to dashboard
        const landing = document.getElementById('landing-view');
        const dashboard = document.getElementById('dashboard-app');
        landing.classList.add('hidden');
        dashboard.classList.remove('hidden');
        dashboard.style.display = 'flex';
        document.getElementById('dashboard-app').classList.remove('opacity-0');
        loadDashboardData();
    }

    // Guest Login / Bypass Logic
    const guestBtn = document.getElementById('guest-login-btn');
    guestBtn?.addEventListener('click', () => {
        enterDashboard();
    });

    // Navigation logic
    const sidebarLinks = document.querySelectorAll('.sidebar-link, #ai-fab');
    const pages = document.querySelectorAll('.page-view');

    function showPage(pageId) {
        pages.forEach(p => p.classList.add('hidden'));
        const targetPage = document.getElementById(`page-${pageId}`);
        console.log(`Navigating to: ${pageId}`); // Debugging check
        if (targetPage) targetPage.classList.remove('hidden');
        if (pageId === 'exchange') loadExchangeItems();
        if (pageId === 'vault') loadVaultItems();
        if (pageId === 'analytics') initAnalyticsDashboard();

        sidebarLinks.forEach(link => {
            if (link.dataset.page === pageId) link.classList.add('active');
            else link.classList.remove('active');
        });
    }

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.dataset.page) {
                e.preventDefault();
                showPage(link.dataset.page);
            }
        });
    });

    // Sign Out Logic
    const signOutBtn = document.getElementById('sign-out-btn');
    signOutBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        const dashboard = document.getElementById('dashboard-app');
        const landing = document.getElementById('landing-view');
        
        sessionStorage.removeItem('isLoggedIn');
        dashboard.classList.add('opacity-0');
        
        setTimeout(() => {
            dashboard.classList.add('hidden');
            landing.classList.remove('hidden');
            
            // Clear Google session simulation
            if (window.google) {
                google.accounts.id.disableAutoSelect();
            }
            
            setTimeout(() => landing.classList.remove('opacity-0'), 50);
        }, 1000);
    });

    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const chevronIcon = document.getElementById('chevron-icon');
    
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('w-64');
        sidebar.classList.toggle('w-20');
        const isCollapsed = sidebar.classList.contains('w-20');
        if (chevronIcon) chevronIcon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        document.querySelectorAll('.sidebar-label').forEach(el => {
            el.style.display = isCollapsed ? 'none' : 'inline';
        });
    });

    // Exchange Hub Logic
    window.toggleExchangeUploadForm = () => {
        document.getElementById('exchange-upload-form')?.classList.toggle('hidden');
    };

    async function loadExchangeItems() {
        const exchangeGrid = document.getElementById('exchange-grid');
        if (!exchangeGrid) return;
        
        const acquired = JSON.parse(localStorage.getItem('acquiredItems') || '[]');

        try {
            const res = await fetch('/api/exchange/items');
            const items = await res.json();

            if (items.length === 0) {
                exchangeGrid.innerHTML = `<p class="col-span-full text-center text-slate-500 py-20 border-2 border-dashed border-white/5 rounded-2xl">The community hasn't shared anything yet.</p>`;
                return;
            }

            exchangeGrid.innerHTML = items.map(item => {
                const isAcquired = acquired.includes(item.id);
                const badgeClass = item.type === 'Borrow' ? 'bg-emerald-500/20 text-emerald-400' : 
                                 item.type === 'Rent' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400';
                
                return `
                <div id="item-${item.id}" class="glass-card flex flex-col group transition-all duration-500">
                    <div class="flex justify-between items-start mb-3">
                        <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter ${badgeClass}">
                            ${item.type}
                        </span>
                        <button onclick="toggleInterest(${item.id})" class="text-gray-500 hover:text-red-400 transition-colors" title="Not Interested">
                            <i data-lucide="eye-off" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="relative h-48 mb-4 rounded-xl overflow-hidden bg-white/5">
                        ${item.image_filename 
                            ? `<img src="/api/exchange/view/${item.image_filename}" class="w-full h-full object-cover transition-transform group-hover:scale-110">`
                            : `<div class="w-full h-full flex items-center justify-center text-gray-600"><i data-lucide="book" class="w-12 h-12"></i></div>`
                        }
                        ${isAcquired ? `<div class="absolute inset-0 bg-emerald-500/80 backdrop-blur-sm flex items-center justify-center text-white font-bold"><i data-lucide="check-circle" class="mr-2"></i> ACQUIRED</div>` : ''}
                    </div>
                    <h3 class="text-white font-bold truncate">${item.title}</h3>
                    <p class="text-[10px] text-gray-500 mb-2 uppercase">By ${item.donor_name}</p>
                    <div class="mt-auto pt-4">
                        ${item.type === 'Borrow' ? `
                            <p class="text-[10px] text-emerald-400 font-bold uppercase">5 Days Free</p>
                            <p class="text-xs text-gray-500 mb-4">Return by: ${new Date(Date.now() + 432000000).toLocaleDateString()}</p>
                        ` : item.type === 'Rent' ? `
                            <p class="text-white font-bold">₹${(item.price * 0.3).toFixed(2)} <span class="text-[10px] text-gray-500">/ 10 Days</span></p>
                            <p class="text-[10px] text-blue-400 mb-4 uppercase">Rental Protocol</p>
                        ` : `
                            <p class="text-white font-bold mb-4">₹${item.price}</p>
                        `}
                        
                        ${!isAcquired ? `
                            <button onclick="handleTransaction(${item.id}, '${item.type}', ${item.price})" class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all">PROCEED</button>
                        ` : `
                            <button disabled class="w-full py-2.5 rounded-lg bg-white/5 text-gray-500 text-xs font-bold">IN POSSESSION</button>
                        `}
                    </div>
                </div>`;
            }).join('');
            if (window.lucide) lucide.createIcons();
        } catch (err) { console.error("Failed to load items", err); }
    }

    window.toggleInterest = (id) => {
        const el = document.getElementById(`item-${id}`);
        if (el) {
            el.classList.add('fade-out');
            setTimeout(() => el.style.display = 'none', 500);
        }
    };

    // Vault Logic
    async function loadVaultItems() {
        const vaultGrid = document.getElementById('vault-grid');
        if (!vaultGrid) return;
        try {
            const res = await fetch('/api/vault/items');
            const items = await res.json();
            if (items.length === 0) {
                vaultGrid.innerHTML = `<p class="col-span-full text-center text-slate-500 py-20 border-2 border-dashed border-white/5 rounded-2xl">Your vault is empty.</p>`;
                return;
            }
            vaultGrid.innerHTML = items.map(item => {
                const isImage = item.file_type.startsWith('image/');
                return `
                <div class="glass-card flex flex-col group p-4 border-white/5">
                    <div class="relative h-32 mb-4 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                        ${isImage ? `<img src="/api/exchange/view/${item.filename}" class="w-full h-full object-cover">` : `<i data-lucide="file-text" class="w-12 h-12 text-blue-400"></i>`}
                    </div>
                    <h3 class="text-white font-medium text-sm truncate mb-1" title="${item.original_name}">${item.original_name}</h3>
                    <p class="text-[9px] text-gray-500 mb-4 uppercase tracking-wider">${item.upload_date}</p>
                    <div class="flex gap-2 mt-auto">
                        <a href="/api/exchange/view/${item.filename}" target="_blank" class="flex-1 text-center py-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-[10px] font-bold text-blue-400 transition-all">VIEW</a>
                        <button onclick="deleteVaultItem(${item.id})" class="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>`;
            }).join('');
            if (window.lucide) lucide.createIcons();
        } catch (err) { console.error("Failed to load vault items", err); }
    }

    window.uploadVaultItem = async (input) => {
        if (!input.files[0]) return;
        const formData = new FormData();
        formData.append('file', input.files[0]);
        try {
            const res = await fetch('/api/vault/upload', { method: 'POST', body: formData });
            if (res.ok) {
                loadVaultItems();
                input.value = '';
            } else {
                alert("Failed to upload document.");
            }
        } catch (err) { console.error(err); }
    };

    window.deleteVaultItem = async (id) => {
        if (!confirm("Are you sure you want to delete this document from your vault?")) return;
        try {
            const res = await fetch(`/api/vault/delete/${id}`, { method: 'DELETE' });
            if (res.ok) loadVaultItems();
        } catch (err) { console.error(err); }
    };

    window.loadVaultItems = loadVaultItems;

    window.handleTransaction = (id, type, price) => {
        let finalPrice = 0, meta = "";
        if (type === 'Borrow') { finalPrice = 0; meta = "Free Borrowing - Late fee of ₹20/day after 5 days applies."; }
        else if (type === 'Rent') { finalPrice = price * 0.3; meta = "10 Day Rental Period Access."; }
        else { finalPrice = price; meta = "Permanent Ownership Transfer."; }

        document.getElementById('upi-amount').textContent = `₹${finalPrice.toFixed(2)}`;
        document.getElementById('upi-meta').textContent = meta;
        document.getElementById('upi-modal').classList.remove('hidden');
        document.getElementById('confirm-payment-btn').onclick = () => processPayment(id);
    };

    window.closeUPIModal = () => document.getElementById('upi-modal').classList.add('hidden');

    async function processPayment(id) {
        const btn = document.getElementById('confirm-payment-btn');
        btn.disabled = true; btn.textContent = "VERIFYING...";
        setTimeout(() => {
            const acquired = JSON.parse(localStorage.getItem('acquiredItems') || '[]');
            acquired.push(id);
            localStorage.setItem('acquiredItems', JSON.stringify(acquired));
            closeUPIModal();
            loadExchangeItems();
            btn.disabled = false; btn.textContent = "CONFIRM TRANSACTION";
        }, 1500);
    }

    window.submitExchangeItem = async () => {
        const title = document.getElementById('exchange-title').value;
        const type = document.getElementById('exchange-type').value;
        const price = document.getElementById('exchange-price').value;
        const donor = document.getElementById('exchange-donor').value;
        const fileInput = document.getElementById('exchange-file-input');
        
        if (!title || !price) return alert('Please fill in required fields.');

        const formData = new FormData();
        formData.append('title', title); formData.append('type', type);
        formData.append('price', price); formData.append('donor_name', donor || 'Anonymous');
        if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

        const res = await fetch('/api/exchange/upload', { method: 'POST', body: formData });
        if (res.ok) {
            toggleExchangeUploadForm(); loadExchangeItems();
            ['exchange-title', 'exchange-price', 'exchange-donor'].forEach(id => document.getElementById(id).value = '');
            fileInput.value = '';
        }
    };

    // AI Chat Logic
    let chatHistory = [
        { role: 'system', content: 'You are Drop Zero AI, a helpful assistant specialized in student academic and financial risk management.' }
    ];

    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');

    chatInput?.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            const userMsg = chatInput.value.trim();
            
            // Update UI and History
            appendMessage('user', userMsg);
            chatHistory.push({ role: 'user', content: userMsg });
            chatInput.value = '';
            chatInput.disabled = true;

            // Add thinking indicator
            const thinkingId = 'thinking-' + Date.now();
            appendMessage('ai', '<span class="animate-pulse">Thinking...</span>', thinkingId);

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: chatHistory })
                });
                
                document.getElementById(thinkingId)?.remove();

                if (res.ok) {
                    const data = await res.json();
                    if (data.response) {
                        appendMessage('ai', data.response);
                        chatHistory.push({ role: 'assistant', content: data.response });
                    }
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Server connection failed' }));
                    appendMessage('ai', `⚠️ ${errorData.error || 'The AI is currently unavailable.'}`);
                }
            } catch (err) {
                document.getElementById(thinkingId)?.remove();
                appendMessage('ai', "Error connecting to AI service.");
            } finally {
                chatInput.disabled = false;
                chatInput.focus();
            }
        }
    });

    function appendMessage(role, text, id = null) {
        const div = document.createElement('div');
        if (id) div.id = id;
        // Enhanced UI: user messages on the right, AI on the left with distinct styles
        div.className = `max-w-[85%] p-4 rounded-2xl mb-4 transition-all animate-in slide-in-from-bottom-2 ${
            role === 'user' 
            ? 'bg-blue-600/20 ml-auto text-white rounded-tr-none border border-blue-500/30' 
            : 'glass-bubble mr-auto text-blue-100 rounded-tl-none border border-white/5'
        }`;
        
        div.innerHTML = typeof text === 'string' ? text.replace(/\n/g, '<br>') : text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Initial Data Load Simulation
    async function loadDashboardData() {
        const mockData = { income: 15000, attendance: 75, delays: 2 };
        
        // Ensure elements exist before updating
        if (!document.getElementById('risk-result')) return;
        
        try {
            const res = await fetch('/api/risk-assessment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(mockData)
            });
            
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            
            const result = await res.json();
            
            const riskEl = document.getElementById('risk-result');
            riskEl.textContent = result.risk_level || "Unknown";
            riskEl.className = `text-6xl font-black tracking-tighter mb-2 ${
                result.risk_level === 'High' ? 'text-red-500' : result.risk_level === 'Medium' ? 'text-yellow-500' : 'text-emerald-500'
            }`;
            
            document.getElementById('income-stat').textContent = `₹${mockData.income.toLocaleString()}`;
            document.getElementById('attendance-stat').textContent = `${mockData.attendance}%`;

            const insightRes = await fetch('/api/student/insight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockData)
            });
            const insightData = await insightRes.json();
            document.getElementById('strategy-text').textContent = insightData.insight;
        } catch (err) {
            console.error("Failed to load dashboard data", err);
        }
    }

    // Expose loadDashboardData to the global scope
    window.loadDashboardData = loadDashboardData;
});