const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzcHkk5DWO-cAceWtUNiebdOBK5p30Fcy9xEbAQWwZ45jqTJb9yqByDBHReSJMN3MyDHg/exec';
let activeTab = 'tab1';

async function loadDashboard(tab) {
    const container = document.getElementById('dashboard');
    container.innerHTML = `<div class="loader">جاري سحب البيانات من Google Sheets...</div>`;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?tab=${tab}`);
        const data = await response.text();
        
        if (!data || data.includes('Error')) {
            container.innerHTML = `<div class="loader">حدث خطأ في رابط السكريبت أو البيانات فارغة.</div>`;
            return;
        }

        renderTables(data);
    } catch (error) {
        container.innerHTML = `<div class="loader">فشل الاتصال: تأكدي من نشر السكريبت كـ Anyone.</div>`;
        console.error(error);
    }
}

function renderTables(csvData) {
    const container = document.getElementById('dashboard');
    container.innerHTML = ''; 
    
    // تقسيم البيانات لصفوف
    const rows = csvData.split('\n').map(r => r.split(','));
    
    if (rows.length < 2) {
        container.innerHTML = `<div class="loader">البيانات التي وصلت غير كافية للعرض.</div>`;
        return;
    }

    let tableHTML = `
        <div class="table-card">
            <div class="table-header">Almentor Error Tracker Data</div>
            <div class="table-responsive">
                <table id="mainTable">
                    <thead><tr id="headerRow"></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = tableHTML;

    const headerRow = document.getElementById('headerRow');
    const tableBody = document.getElementById('tableBody');

    // البحث عن أول صف يحتوي على بيانات حقيقية ليكون هو العنوان
    let headerIndex = rows.findIndex(r => r.join('').trim().length > 10);
    if (headerIndex === -1) headerIndex = 0;

    // رسم العناوين
    rows[headerIndex].forEach(col => {
        const th = document.createElement('th');
        th.innerText = col.replace(/"/g, ''); // تنظيف علامات التنصيص
        headerRow.appendChild(th);
    });

    // رسم الصفوف
    for (let i = headerIndex + 1; i < rows.length; i++) {
        const rowData = rows[i];
        if (rowData.join('').trim().length < 2) continue; // تخطي الصفوف الفارغة

        const tr = document.createElement('tr');
        rowData.forEach(cell => {
            const td = document.createElement('td');
            td.innerText = cell.replace(/"/g, '');
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    }
}

function changeTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    loadDashboard(tab);
}

loadDashboard('tab1');
setInterval(() => loadDashboard(activeTab), 60000);
