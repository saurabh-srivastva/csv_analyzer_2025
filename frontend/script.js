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

const statsSection = document.getElementById('stats-section');
const columnSelector = document.getElementById('column-selector');
const calculateStatsBtn = document.getElementById('calculate-stats-btn');
const statsContainer = document.getElementById('stats-container');

const resetButton = document.getElementById('reset-button');
const themeToggleButton = document.getElementById('theme-toggle-btn');

// NEW Plotting Elements
const plottingSection = document.getElementById('plotting-section');
const plotTypeSelect = document.getElementById('plot-type');
const plotColumnSelect = document.getElementById('plot-column');
const generatePlotBtn = document.getElementById('generate-plot-btn');
let myChart = null; // To hold the chart instance

// --- State variables ---
let currentFile = null; // To store the uploaded file reference
let columnData = []; // To store column info (name, type)

// --- Backend API URLs ---
const RENDER_BACKEND_URL = 'https://csv-analyzer-backend.onrender.com'; // Make sure this matches your backend URL
const ANALYZE_URL = `${RENDER_BACKEND_URL}/analyze`;
const DESCRIBE_URL = `${RENDER_BACKEND_URL}/describe`;
const PLOT_URL = `${RENDER_BACKEND_URL}/plot`;

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
numRowsInput.addEventListener('change', () => {
    if (currentFile) {
        triggerAnalysis();
    }
});
resetButton.addEventListener('click', resetUI);
calculateStatsBtn.addEventListener('click', fetchDescriptiveStats);
themeToggleButton.addEventListener('click', () => document.body.classList.toggle('dark-theme'));
generatePlotBtn.addEventListener('click', generatePlot); // NEW Event Listener

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
        displayError(error.message || 'An unexpected error occurred.');
    })
    .finally(() => {
        loadingSpinner.style.display = 'none';
    });
}

function displayResults(data) {
    columnData = data.description;
    summaryText.textContent = `${data.filename} - ${data.rows} rows, ${data.columns} columns.`;
    summarySection.classList.remove('hidden');
    tableContainer.innerHTML = data.head_html;
    previewSection.classList.remove('hidden');
    descriptionContainer.innerHTML = '';
    descriptionContainer.appendChild(createDescriptionTable(data.description));
    descriptionSection.classList.remove('hidden');
    populateColumnSelector(data.description);
    // NEW: Show plotting section and populate its dropdown
    populatePlotColumnSelector(data.description);
    plottingSection.classList.remove('hidden');
}

function fetchDescriptiveStats() {
    if (!currentFile) return;
    const selectedColumns = Array.from(columnSelector.querySelectorAll('input:checked')).map(input => input.value);
    if (selectedColumns.length === 0) {
        alert('Please select at least one numeric column.');
        return;
    }
    statsContainer.innerHTML = '<div class="flex justify-center"><div class="spinner"></div></div>';
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
    columnSelector.innerHTML = '';
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
        statsSection.classList.add('hidden');
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
    plottingSection.classList.add('hidden'); // NEW
    if (myChart) { // NEW
        myChart.destroy();
    }
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

// --- NEW Plotting Functions ---
function populatePlotColumnSelector(descriptionData) {
    plotColumnSelect.innerHTML = '';
    descriptionData.forEach(col => {
        const option = document.createElement('option');
        option.value = col.column;
        option.textContent = col.column;
        plotColumnSelect.appendChild(option);
    });
}

function generatePlot() {
    if (!currentFile) {
        alert('Please upload a file first.');
        return;
    }
    const plotType = plotTypeSelect.value;
    const columnName = plotColumnSelect.value;
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('plot_type', plotType);
    formData.append('column', columnName);
    fetch(PLOT_URL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.ok ? response.json() : response.json().then(err => { throw new Error(err.error || 'Server error') }))
    .then(plotData => {
        if (plotData.error) {
            alert(`Error: ${plotData.error}`);
        } else {
            renderChart(plotData.labels, plotData.data, plotType, columnName);
        }
    })
    .catch(error => {
        alert(`An error occurred: ${error.message}`);
    });
}

function renderChart(labels, data, plotType, columnName) {
    const ctx = document.getElementById('myChart').getContext('2d');
    if (myChart) {
        myChart.destroy();
    }
    myChart = new Chart(ctx, {
        type: plotType,
        data: {
            labels: labels,
            datasets: [{
                label: `Count of ${columnName}`,
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)', 'rgba(255, 159, 64, 0.5)',
                    'rgba(99, 255, 132, 0.5)', 'rgba(162, 54, 235, 0.5)',
                    'rgba(206, 255, 86, 0.5)', 'rgba(192, 75, 192, 0.5)',
                    'rgba(102, 153, 255, 0.5)', 'rgba(159, 255, 64, 0.5)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `Distribution for column: ${columnName}`
                }
            }
        }
    });
}