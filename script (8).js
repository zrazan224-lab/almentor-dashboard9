const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzcHkk5DWO-cAceWtUNiebdOBK5p30Fcy9xEbAQWwZ45jqTJb9yqByDBHReSJMN3MyDHg/exec';
let activeTab = 'tab1';

async function loadDashboard(tab) {
    const container = document.getElementById('dashboard');
    const syncDot = document.getElementById('sync-dot');
    
    syncDot.style.opacity = '0.3'; // Visual feedback
    
    try {
        const response = await fetch(`${SCRIPT_URL}?tab=${tab}`);
        const data = await response.text();
        renderTables(data);
        syncDot.style.opacity = '1';
    } catch (error) {
        container.innerHTML = `<div class="loader">Error loading data. Please check your connection.</div>`;
    }
}

function renderTables(csvData) {
    const container = document.getElementById('dashboard');
    container.innerHTML = ''; // Clear previous
    
    const rows = csvData.split('\n').map(r => r.split(','));
    let currentTableRows = [];
    let tableTitle = "Default Table";

    rows.forEach((row, index) => {
        const rowString = row.join('').trim();
        
        // Detect Table Title (e.g., lines starting with icons)
        if (rowString.includes('B2C')) {
            if (currentTableRows.length > 0) createHTMLTable(tableTitle, currentTableRows);
            tableTitle = row.find(cell => cell.includes('B2C')) || "Data Table";
            currentTableRows = [];
        } 
        // Skip empty rows and separator lines
        else if (rowString !== "" && !rowString.startsWith(',,')) {
            currentTableRows.push(row);
        }
    });

    // Create the last table
    if (currentTableRows.length > 0) {
        createHTMLTable(tableTitle, currentTableRows);
    }
}

function createHTMLTable(title, dataRows) {
    const container = document.getElementById('dashboard');
    const card = document.createElement('div');
    card.className = 'table-card';
    
    let tableHTML = `
        <div class="table-header">${title}</div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>${dataRows[1].map(h => `<th>${h || ''}</th>`).join('')}</tr>
                </thead>
                <tbody>
    `;

    // Add data rows starting from actual data (skipping headers)
    for (let i = 2; i < dataRows.length; i++) {
        if (dataRows[i].join('').trim() === "") continue;
        tableHTML += `<tr>${dataRows[i].map(c => `<td>${c || ''}</td>`).join('')}</tr>`;
    }

    tableHTML += `</tbody></table></div>`;
    card.innerHTML = tableHTML;
    container.appendChild(card);
}

function changeTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    loadDashboard(tab);
}

// Start
loadDashboard('tab1');
// Auto refresh every 60 seconds
setInterval(() => loadDashboard(activeTab), 60000);
