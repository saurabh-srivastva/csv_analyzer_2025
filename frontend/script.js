// --- DOM element references ---
const uploadArea = document.getElementById('upload-area');
const fileDropArea = document.getElementById('file-drop-area');
const fileInput = document.getElementById('file-upload');
const fileNameDisplay = document.getElementById('file-name');
const numRowsInput = document.getElementById('num-rows-input');

const resultsArea = document.getElementById('results-area');
const loadingSpinner = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

const summarySection = document.getElementById('summary-section');
const summaryText = document.getElementById('summary-text');

const previewSection = document.getElementById('preview-section');
const tableContainer = document.getElementById('table-container');

const descriptionSection = document.getElementById('description-section');
const descriptionContainer = document.getElementById('description-container');

// New stats section elements
const statsSection = document.getElementById('stats-section');
const columnSelector = document.getElementById('column-selector');
const calculateStatsBtn = document.getElementById('calculate-stats-btn');
const statsContainer = document.getElementById('stats-container');

const resetButton = document.getElementById('reset-button');
const themeToggleButton = document.getElementById('theme-toggle-btn');

// --- State variables ---
let currentFile = null; // To store the uploaded file reference
let columnData = []; // To store column info (name, type)

// --- Backend API URLs ---
const ANALYZE_URL = 'http://127.0.0.1:5000/analyze';
const DESCRIBE_URL = 'http://127.0.0.1:5000/describe';

// --- Event Listeners ---

fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files[0]));
fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.classList.add('drag-over');
});
fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('drag-over'));
fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.classList.remove('drag-over');
    handleFileSelection(e.dataTransfer.files[0]);
});

// **FIX**: Re-run analysis when the number of rows is changed
numRowsInput.addEventListener('change', () => {
    if (currentFile) {
        triggerAnalysis();
    }
});

resetButton.addEventListener('click', resetUI);
calculateStatsBtn.addEventListener('click', fetchDescriptiveStats);
themeToggleButton.addEventListener('click', () => document.body.classList.toggle('dark-theme'));

// --- Core Functions ---

function handleFileSelection(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
        displayError('Invalid file type. Please upload a CSV file.');
        return;
    }
    currentFile = file;
    fileNameDisplay.textContent = file.name;
    triggerAnalysis();
}

function triggerAnalysis() {
    if (!currentFile) return;

    // Show loading state
    uploadArea.classList.add('hidden');
    resultsArea.classList.remove('hidden');
    loadingSpinner.style.display = 'flex';
    hideAllSections();

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('rows', numRowsInput.value);

    fetch(ANALYZE_URL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.ok ? response.json() : response.json().then(err => { throw new Error(err.error || 'Server error') }))
    .then(data => {
        if (data.error) {
            displayError(data.error);
        } else {
            displayResults(data);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        displayError(error.message || 'An unexpected error occurred. Is the Python server running?');
    })
    .finally(() => {
        loadingSpinner.style.display = 'none';
    });
}

function displayResults(data) {
    // Store column data for later use
    columnData = data.description;

    // Display summary
    summaryText.textContent = `${data.filename} - ${data.rows} rows, ${data.columns} columns.`;
    summarySection.classList.remove('hidden');

    // Display data preview table
    tableContainer.innerHTML = data.head_html;
    previewSection.classList.remove('hidden');
    
    // Display column descriptions table
    descriptionContainer.innerHTML = ''; // Clear previous
    descriptionContainer.appendChild(createDescriptionTable(data.description));
    descriptionSection.classList.remove('hidden');

    // NEW: Populate the column selector for stats
    populateColumnSelector(data.description);
}

function fetchDescriptiveStats() {
    if (!currentFile) return;

    const selectedColumns = Array.from(columnSelector.querySelectorAll('input:checked')).map(input => input.value);
    
    if (selectedColumns.length === 0) {
        alert('Please select at least one numeric column to describe.');
        return;
    }

    statsContainer.innerHTML = '<div class="flex justify-center"><div class="spinner"></div></div>'; // Show spinner

    const formData = new FormData();
    formData.append('file', currentFile);
    selectedColumns.forEach(col => formData.append('columns', col));

    fetch(DESCRIBE_URL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.ok ? response.json() : response.json().then(err => { throw new Error(err.error || 'Server error') }))
    .then(data => {
        if (data.error) {
            statsContainer.innerHTML = `<p class="text-red-500">${data.error}</p>`;
        } else {
            statsContainer.innerHTML = data.stats_html;
        }
    })
    .catch(error => {
        statsContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
    });
}

// --- UI Helper Functions ---

function createDescriptionTable(descriptionData) {
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Column Name</th>
                <th>Data Type</th>
                <th>Non-Null Values</th>
                <th>Null Values</th>
            </tr>
        </thead>
        <tbody>
            ${descriptionData.map(col => `
                <tr>
                    <td class="font-mono">${col.column}</td>
                    <td>${col.dtype}</td>
                    <td>${col.non_null_count}</td>
                    <td>${col.null_count}</td>
                </tr>
            `).join('')}
        </tbody>`;
    return table;
}

function populateColumnSelector(descriptionData) {
    columnSelector.innerHTML = ''; // Clear previous checkboxes
    const numericColumns = descriptionData.filter(col => ['int64', 'float64'].includes(col.dtype));

    if (numericColumns.length > 0) {
        numericColumns.forEach(col => {
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'flex items-center';
            checkboxContainer.innerHTML = `
                <input id="col-${col.column}" type="checkbox" value="${col.column}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                <label for="col-${col.column}" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">${col.column}</label>
            `;
            columnSelector.appendChild(checkboxContainer);
        });
        statsSection.classList.remove('hidden');
    } else {
        statsSection.classList.add('hidden'); // Hide if no numeric columns
    }
}

function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    summarySection.classList.remove('hidden');
    resetButton.textContent = "Try Again";
}

function hideAllSections() {
    errorMessage.classList.add('hidden');
    summarySection.classList.add('hidden');
    previewSection.classList.add('hidden');
    descriptionSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    statsContainer.innerHTML = '';
    resetButton.textContent = "Analyze Another";
}

function resetUI() {
    currentFile = null;
    columnData = [];
    fileInput.value = '';
    uploadArea.classList.remove('hidden');
    resultsArea.classList.add('hidden');
    hideAllSections();
    fileNameDisplay.textContent = 'CSV files only';
}