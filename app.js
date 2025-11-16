// App RVM - Desenvolvido 100% com Google AI Studio
// Application State
const APP_STATE = {
    apiKey: null,
    assignments: [],
    history: []
};

// DOM Elements
const elements = {
    apiKey: document.getElementById('api-key'),
    saveKey: document.getElementById('save-key'),
    keyStatus: document.getElementById('key-status'),
    meetingDate: document.getElementById('meeting-date'),
    participants: document.getElementById('participants'),
    parts: document.getElementById('parts'),
    generateBtn: document.getElementById('generate-assignments'),
    resultsSection: document.getElementById('results-section'),
    assignmentsContainer: document.getElementById('assignments-container'),
    historyContainer: document.getElementById('history-container'),
    copyBtn: document.getElementById('copy-assignments'),
    printBtn: document.getElementById('print-assignments'),
    downloadBtn: document.getElementById('download-assignments'),
    loadingOverlay: document.getElementById('loading-overlay')
};

// Initialize App
function init() {
    loadFromLocalStorage();
    setupEventListeners();
    setDefaultDate();
    loadDefaultData();
    renderHistory();
}

// Load data from localStorage
function loadFromLocalStorage() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        APP_STATE.apiKey = savedKey;
        elements.keyStatus.textContent = '✓ Chave salva';
        elements.keyStatus.className = 'status success';
    }

    const savedHistory = localStorage.getItem('assignmentsHistory');
    if (savedHistory) {
        APP_STATE.history = JSON.parse(savedHistory);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    elements.saveKey.addEventListener('click', saveApiKey);
    elements.generateBtn.addEventListener('click', generateAssignments);
    elements.copyBtn.addEventListener('click', copyAssignments);
    elements.printBtn.addEventListener('click', printAssignments);
    elements.downloadBtn.addEventListener('click', downloadAssignments);
}

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    elements.meetingDate.value = today;
}

// Load default example data
function loadDefaultData() {
    elements.participants.value = `João Silva
Maria Santos
Pedro Oliveira
Ana Costa
Carlos Ferreira
Beatriz Lima
Rafael Mendes
Juliana Rocha`;

    elements.parts.value = `Presidente
Discurso de 10 minutos
Leitor
Vídeo Inicial
Primeira Conversa
Segunda Conversa
Terceira Conversa
Estudo Bíblico - Condutor
Estudo Bíblico - Leitor
Revisão
Conclusão`;
}

// Save API Key
function saveApiKey() {
    const key = elements.apiKey.value.trim();
    
    if (!key) {
        showStatus('error', 'Por favor, insira uma chave da API');
        return;
    }

    APP_STATE.apiKey = key;
    localStorage.setItem('geminiApiKey', key);
    showStatus('success', '✓ Chave salva com sucesso!');
    elements.apiKey.value = '';
}

// Show status message
function showStatus(type, message) {
    elements.keyStatus.textContent = message;
    elements.keyStatus.className = `status ${type}`;
    
    setTimeout(() => {
        elements.keyStatus.textContent = '';
        elements.keyStatus.className = 'status';
    }, 3000);
}

// Generate Assignments using Gemini API
async function generateAssignments() {
    if (!APP_STATE.apiKey) {
        alert('Por favor, configure sua chave da API primeiro!');
        return;
    }

    const date = elements.meetingDate.value;
    const participantsList = elements.participants.value.trim().split('\n').filter(p => p.trim());
    const partsList = elements.parts.value.trim().split('\n').filter(p => p.trim());

    if (!date || participantsList.length === 0 || partsList.length === 0) {
        alert('Por favor, preencha todos os campos!');
        return;
    }

    showLoading(true);

    try {
        const prompt = createPrompt(date, participantsList, partsList);
        const assignments = await callGeminiAPI(prompt);
        
        displayAssignments(assignments, date);
        saveToHistory(assignments, date);
        
        elements.resultsSection.style.display = 'block';
        elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Erro ao gerar designações:', error);
        alert('Erro ao gerar designações: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Create prompt for AI
function createPrompt(date, participants, parts) {
    return `Você é um assistente especializado em organizar designações para a Reunião Vida e Ministério das Testemunhas de Jeová.

Data da Reunião: ${date}

Participantes disponíveis:
${participants.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Partes da Reunião:
${parts.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Por favor, distribua as partes entre os participantes de forma equilibrada e justa. Considere:
- Cada pessoa deve receber no máximo 2 partes
- Tente variar as designações entre diferentes tipos de partes
- Partes mais importantes (como Presidente e Discurso) devem ser priorizadas para participantes experientes

Forneça a resposta EXATAMENTE neste formato JSON (sem texto adicional antes ou depois):
{
  "assignments": [
    {"part": "Nome da Parte", "person": "Nome da Pessoa"},
    ...
  ]
}`;
}

// Call Gemini API
async function callGeminiAPI(prompt) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    
    const response = await fetch(`${API_URL}?key=${APP_STATE.apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erro na API');
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Resposta da IA não está no formato esperado');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    return result.assignments;
}

// Display assignments
function displayAssignments(assignments, date) {
    APP_STATE.assignments = assignments;
    
    let html = `<div class="assignment-header">
        <h3>📅 Reunião de ${formatDate(date)}</h3>
    </div>`;
    
    assignments.forEach((assignment, index) => {
        html += `
            <div class="assignment-item">
                <span class="assignment-part">${assignment.part}</span>
                <span class="assignment-person">${assignment.person}</span>
            </div>
        `;
    });
    
    elements.assignmentsContainer.innerHTML = html;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Save to history
function saveToHistory(assignments, date) {
    const historyItem = {
        id: Date.now(),
        date: date,
        assignments: assignments,
        timestamp: new Date().toISOString()
    };
    
    APP_STATE.history.unshift(historyItem);
    
    // Keep only last 10 items
    if (APP_STATE.history.length > 10) {
        APP_STATE.history = APP_STATE.history.slice(0, 10);
    }
    
    localStorage.setItem('assignmentsHistory', JSON.stringify(APP_STATE.history));
    renderHistory();
}

// Render history
function renderHistory() {
    if (APP_STATE.history.length === 0) {
        elements.historyContainer.innerHTML = '<p class="empty-state">Nenhuma designação gerada ainda.</p>';
        return;
    }
    
    let html = '';
    APP_STATE.history.forEach(item => {
        const preview = item.assignments.slice(0, 3).map(a => a.part).join(', ');
        html += `
            <div class="history-item" onclick="loadHistoryItem(${item.id})">
                <div class="history-date">📅 ${formatDate(item.date)}</div>
                <div class="history-preview">${preview}...</div>
            </div>
        `;
    });
    
    elements.historyContainer.innerHTML = html;
}

// Load history item
window.loadHistoryItem = function(id) {
    const item = APP_STATE.history.find(h => h.id === id);
    if (item) {
        displayAssignments(item.assignments, item.date);
        elements.resultsSection.style.display = 'block';
        elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
};

// Copy assignments to clipboard
function copyAssignments() {
    const date = elements.meetingDate.value;
    let text = `Designações - Reunião Vida e Ministério\n`;
    text += `Data: ${formatDate(date)}\n\n`;
    
    APP_STATE.assignments.forEach(assignment => {
        text += `${assignment.part}: ${assignment.person}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        alert('Designações copiadas para a área de transferência!');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar designações');
    });
}

// Print assignments
function printAssignments() {
    window.print();
}

// Download assignments as text file
function downloadAssignments() {
    const date = elements.meetingDate.value;
    let text = `Designações - Reunião Vida e Ministério\n`;
    text += `Data: ${formatDate(date)}\n\n`;
    
    APP_STATE.assignments.forEach(assignment => {
        text += `${assignment.part}: ${assignment.person}\n`;
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `designacoes-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Show/hide loading overlay
function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
