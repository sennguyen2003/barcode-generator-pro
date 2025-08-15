// js/code128-generator.js
function initializeCode128Generator(exportCanvasesToDirectory) {
    // --- UI Elements ---
    const getIcnBtn = document.getElementById('a128-get-icn-btn');
    const generateBtn = document.getElementById('a128-generate-btn');
    const saveAllBtn = document.getElementById('a128-save-all-btn');
    const fileInput = document.getElementById('a128-file-input');
    const filenameInput = document.getElementById('a128-filename-input');
    const icnInput = document.getElementById('a128-icn-input');
    const recordsTableBody = document.getElementById('a128-records-table-body');
    const barcodePreview = document.getElementById('a128-barcode-preview');
    
    // --- Data Storage ---
    let barcodeRecords = []; // Single source of truth for all records

    // --- Event Listeners ---
    getIcnBtn.addEventListener('click', getIcnFromPdf417Tab);
    generateBtn.addEventListener('click', addSingleRecordFromInputs);
    fileInput.addEventListener('change', handleFileImport);
    saveAllBtn.addEventListener('click', saveAllBarcodes);

    /**
     * Fetches ICN and DL Number from the PDF417 tab to populate the inputs.
     */
    function getIcnFromPdf417Tab() {
        const pdf417IcnField = document.getElementById('a417-inventory_control');
        const pdf417DlNumField = document.getElementById('a417-customer_id');

        if (pdf417IcnField && pdf417DlNumField) {
            const icnValue = pdf417IcnField.value;
            const dlNumValue = pdf417DlNumField.value;
            
            if (icnValue) {
                icnInput.value = icnValue;
            } else {
                alert("Inventory Control Number (ICN) is empty on the PDF417 tab. Please generate or enter it first.");
                return;
            }

            if (dlNumValue) {
                filenameInput.value = dlNumValue;
            }
        } else {
            alert("Could not find the necessary fields on the PDF417 tab.");
        }
    }

    /**
     * Handles the "Add to List" button click for manual entry.
     */
    function addSingleRecordFromInputs() {
        const icn = icnInput.value.trim();
        let filename = filenameInput.value.trim();
        
        if (!icn) {
            alert("ICN (Code 128 Data) cannot be empty.");
            icnInput.focus();
            return;
        }

        if (!filename) {
            filename = icn; // Default filename to ICN if empty
        }

        // Use the core function to add the record
        addRecord(filename, icn);
        
        // Clear inputs for the next entry
        filenameInput.value = '';
        icnInput.value = '';
        filenameInput.focus();
    }

    /**
     * Core function to add a new barcode record to the list,
     * whether from manual input or Excel.
     * @param {string} filename - The name for the barcode file.
     * @param {string} icn - The data for the barcode.
     */
    function addRecord(filename, icn) {
        const canvas = generateBarcodeCanvas(icn);
        if (!canvas) {
            console.error(`Failed to generate barcode for ICN: ${icn}. Skipping.`);
            return; // Skip adding if canvas generation fails
        }
        
        barcodeRecords.push({ filename, icn, canvas });
        updateRecordsTable();
        saveAllBtn.disabled = false;
    }

    /**
     * Generates a barcode image on a canvas element.
     * @param {string} text - The data to encode in the barcode.
     * @returns {HTMLCanvasElement|null} The canvas element or null on error.
     */
    function generateBarcodeCanvas(text) {
        const showText = document.getElementById('a128-show-text-check').checked;
        const height = parseInt(document.getElementById('a128-height-input').value) || 120;
        
        const canvas = document.createElement('canvas');
        try {
            bwipjs.toCanvas(canvas, {
                bcid: 'code128',
                text: text,
                height: height / 10,
                includetext: showText,
                textxalign: 'center',
            });
            return canvas;
        } catch (e) {
            console.error(`Barcode generation error for "${text}":`, e);
            return null;
        }
    }

    /**
     * Clears and redraws the entire records table based on the barcodeRecords array.
     */
    function updateRecordsTable() {
        recordsTableBody.innerHTML = '';
        barcodeRecords.forEach((record, index) => {
            const tr = document.createElement('tr');
            tr.dataset.index = index;
            tr.innerHTML = `<td>${record.filename}.png</td><td>${record.icn}</td>`;
            
            tr.addEventListener('click', () => {
                Array.from(recordsTableBody.children).forEach(row => row.classList.remove('selected'));
                tr.classList.add('selected');
                showPreview(index);
            });
            recordsTableBody.appendChild(tr);
        });
    }

    /**
     * Displays the preview of the selected barcode.
     * @param {number} index - The index of the record in the barcodeRecords array.
     */
    function showPreview(index) {
        const record = barcodeRecords[index];
        if (record && record.canvas) {
            barcodePreview.innerHTML = '';
            const img = document.createElement('img');
            img.src = record.canvas.toDataURL();
            barcodePreview.appendChild(img);
        } else {
            barcodePreview.innerHTML = '<p>Error generating barcode for this record.</p>';
        }
    }
    
    /**
     * Handles the file import process from Excel.
     */
    async function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: ['Filename', 'Code128'] });
                
                if (jsonData[0] && jsonData[0].Filename === 'Filename' && jsonData[0].Code128 === 'Code128') {
                    jsonData.shift();
                }

                const validData = jsonData.filter(row => row.Filename && row.Code128);
                if (validData.length === 0) {
                    alert("No valid data found in 'Filename' and 'Code128' columns.");
                    return;
                }
                
                let addedCount = 0;
                validData.forEach(row => {
                    addRecord(String(row.Filename).trim(), String(row.Code128).trim());
                    addedCount++;
                });

                alert(`Successfully added ${addedCount} records from the Excel file.`);

            } catch (err) {
                console.error("Error processing Excel file:", err);
                alert("Error processing Excel file: " + err.message);
            } finally {
                fileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    // --- Save Logic ---
    function _makeBackgroundTransparent(canvas) {
        const newCanvas = document.createElement('canvas');
        newCanvas.width = canvas.width;
        newCanvas.height = canvas.height;
        const ctx = newCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        const imageData = ctx.getImageData(0, 0, newCanvas.width, newCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
                data[i+3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return newCanvas;
    }

    async function saveAllBarcodes() {
        if (barcodeRecords.length === 0) {
            alert("No barcodes have been generated yet.");
            return;
        }
        
        const isTransparent = document.getElementById('a128-transparent-bg-check').checked;
        const canvasesToExport = [];
        const filenamesToExport = [];

        for (const record of barcodeRecords) {
            let canvas = record.canvas;
            if (canvas) {
                if (isTransparent) {
                    canvas = _makeBackgroundTransparent(canvas);
                }
                const sanitizedFilename = record.filename.replace(/[\\/*?:"<>|]/g, "_");
                canvasesToExport.push(canvas);
                filenamesToExport.push(`${sanitizedFilename}.png`);
            }
        }
        await exportCanvasesToDirectory(canvasesToExport, filenamesToExport);
    }
}