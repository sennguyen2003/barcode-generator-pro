// js/pdf417-generator.js (Phiên bản hoàn chỉnh, đã xác thực)

/**
 * Khởi tạo toàn bộ chức năng của trình tạo mã vạch PDF417 AAMVA.
 * Hàm này thiết lập giao diện người dùng, gắn các trình xử lý sự kiện,
 * và quản lý toàn bộ luồng dữ liệu của ứng dụng.
 * @param {function} exportCanvasesToDirectory - Một hàm được cung cấp từ bên ngoài để xử lý việc xuất nhiều canvas ra một thư mục.
 */
function initializePdf417Generator(exportCanvasesToDirectory) {
    // --- Lấy các phần tử DOM quan trọng ---
    const accordionContainer = document.getElementById('a417-accordion-container');
    const controlsContainer = document.getElementById('a417-controls');
    const recordsTableBody = document.getElementById('a417-records-table-body');
    const barcodePreview = document.getElementById('a417-barcode-preview');
    const formattedDataText = document.getElementById('a417-formatted-data');
    const rawDataText = document.getElementById('a417-raw-data');
    
    // --- Biến trạng thái toàn cục của module ---
    const a417_fields = {};       // Object để lưu trữ tham chiếu đến tất cả các ô input trên form.
    let a417_all_records = [];    // Mảng lưu trữ tất cả các bản ghi dữ liệu (từ Excel hoặc được tạo ra).
    let a417_barcode_images = {}; // Object lưu trữ các hình ảnh mã vạch đã được tạo ra, ánh xạ theo index.

    // --- Dữ liệu hằng số ---
    // Ánh xạ mã bang sang Số nhận dạng nhà phát hành (IIN) theo chuẩn AAMVA.
    const STATE_IIN_MAP = {
        'AL': '636033', 'AK': '636059', 'AZ': '636026', 'AR': '636021', 
        'CA': '636014', 'CO': '636020', 'CT': '636006', 'DE': '636011',
        'DC': '636043', 'FL': '636010', 'GA': '636055', 'HI': '636047', 
        'ID': '636050', 'IL': '636035', 'IN': '636037', 'IA': '636018', 
        'KS': '636022', 'KY': '636046', 'LA': '636007', 'ME': '636041', 
        'MD': '636003', 'MA': '636002', 'MI': '636032', 'MN': '636038', 
        'MS': '636051', 'MO': '636030', 'MT': '636008', 'NE': '636054', 
        'NV': '636049', 'NH': '636039', 'NJ': '636036', 'NM': '636009', 
        'NY': '636001', 'NC': '636004', 'ND': '636034', 'OH': '636023',
        'OK': '636058', 'OR': '636029', 'PA': '636025', 'RI': '636052', 
        'SC': '636005', 'SD': '636042', 'TN': '636053', 'TX': '636015', 'UT': '636040', 
        'VT': '636024', 'VA': '636000', 'WA': '636045', 'WV': '636061', 'WI': '636031', 'WY': '636060'
    };

    // Cấu trúc dữ liệu định nghĩa tất cả các trường trên giao diện người dùng, chia theo danh mục.
    const fieldDefinitions = {
        "Header Information": { icon: "fa-solid fa-file-invoice", fields: [
            {label: "Issuer Identification Number (IIN):", name: "iin", value: "636000"},
            {label: "AAMVA Version Number:", name: "aamva_version", value: "10"},
            {label: "Jurisdiction Version Number:", name: "jurisdiction_version", value: "00"},
            {label: "Number of Subfiles:", name: "subfile_count", value: "01", placeholder: "Auto-calculated"},
            {label: "DL Subfile Length:", name: "dl_subfile_length", value: "", placeholder: "Auto-calculated"},
            {label: "Jurisdiction Subfile Length:", name: "jurisdiction_subfile_length", value: "0000", placeholder: "Auto-calculated"}
        ]},
        "Identification Information": { icon: "fa-solid fa-user", fields: [
            {label: "Family Name (DCS):", name: "family_name", calculable: true}, 
            {label: "First Name (DAC):", name: "first_name", calculable: true},
            {label: "Middle Name(s) (DAD):", name: "middle_name",value:"NONE"}, 
            {label: "Name Suffix (DCU):", name: "name_suffix"},
            {label: "Date of Birth (DBB):", name: "dob", placeholder: "MMDDYYYY", calculable: true},
            {label: "Document Expiration Date (DBA):", name: "expiry_date", placeholder: "MMDDYYYY", calculable: true},
            {label: "Document Issue Date (DBD):", name: "issue_date", placeholder: "MMDDYYYY", calculable: true},
            {label: "Customer ID Number (DAQ):", name: "customer_id", calculable: true}, 
            {label: "Document Discriminator (DCF):", name: "document_discriminator", calculable: true},
            {label: "Country Identification (DCG):", name: "country", value: "USA"},
            {label: "Family Name Truncation (DDE):", name: "family_name_trunc", type: 'combobox', options: ["N", "T", "U"],value: "N "},
            {label: "First Name Truncation (DDF):", name: "first_name_trunc", type: 'combobox', options: ["N", "T", "U"],value: "N "},
            {label: "Middle Name Truncation (DDG):", name: "middle_name_trunc", type: 'combobox', options: ["N", "T", "U"],value: "N "}
        ]},
        "Address Information": { icon: "fa-solid fa-location-dot", fields: [
            {label: "Street 1 (DAG):", name: "street1"}, 
            {label: "Street 2 (DAH):", name: "street2"},
            {label: "City (DAI):", name: "city"}, 
            {label: "Jurisdiction Code (DAJ):", name: "state", value: "CA"},
            {label: "Postal Code (DAK):", name: "postal_code"}
        ]},
        "Physical Description": { icon: "fa-solid fa-person", fields: [
            {label: "Sex (DBC):", name: "sex", type: 'combobox', options: [["1", "1-Male"], ["2", "2-Female"], ["9", "9-Unknown"]]},
            {label: "Eye Color (DAY):", name: "eye_color", type: 'combobox', options: ["BLK", "BLU", "BRO","BNR", "GRY", "GRN", "HAZ", "MAR", "PNK"],value: "BLK"},
            {label: "Height (DAU):", name: "height", placeholder: "e.g., '068 in'"},
            {label: "Hair Color (DAZ):", name: "hair_color", type: 'combobox', options: ["BLK", "BRO", "BLN", "RED", "WHI", "GRY", "SDY", "BAL"], value: "BRO"},
            {label: "Race/Ethnicity (DCL):", name: "race", type: 'combobox', options: [" ","UNK", "IND", "ASN", "BLK", "HIS", "OTH", "UNK", "WHT"]},
            {label: "Weight - Pounds (DAW):", name: "weight_pounds"}, 
            {label: "Weight - Kilograms (DAX):", name: "weight_kg"},
            {label: "Weight Range (DCE):", name: "weight_range", type: 'combobox', options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]}
        ]},
        "Document Details": { icon: "fa-solid fa-stamp", fields: [
            {label: "Jurisdiction Vehicle Class (DCA):", name: "vehicle_class", value: "F ", type: 'combobox', options: ["A", "B", "C", "M", "F ","O"]},
            {label: "Jurisdiction Restrictions (DCB):", name: "restrictions",value:"NONE"},
            {label: "Jurisdiction Endorsements (DCD):", name: "endorsements",value:"NONE"},
            {label: "Standard Vehicle Classification (DCM):", name: "std_vehicle_class"},
            {label: "Standard Restriction Code (DCO):", name: "std_restriction"},
            {label: "Standard Endorsement Code (DCN):", name: "std_endorsement"},
            {label: "Compliance Type (DDA):", name: "compliance_type", type: 'combobox', options: [" ","F", "N"], value: "F"},
            {label: "Card Revision Date (DDB):", name: "card_revision_date", placeholder: "MMDDYYYY",value: "09122021"},
            {label: "Limited Duration Indicator (DDD):", name: "limited_duration", type: 'combobox', options: ["0", "1"]},
            {label: "HAZMAT Endorsement Expiry (DDC):", name: "hazmat_expiry", placeholder: "MMDDYYYY"},
            {label: "Under 18 Until (DDH):", name: "under_18", placeholder: "MMDDYYYY"},
            {label: "Under 19 Until (DDI):", name: "under_19", placeholder: "MMDDYYYY"},
            {label: "Under 21 Until (DDJ):", name: "under_21", placeholder: "MMDDYYYY"},
            {label: "Organ Donor Indicator (DDK):", name: "organ_donor", type: 'combobox', options: ["0", "1"],value: "0"},
            {label: "Veteran Indicator (DDL):", name: "veteran", type: 'combobox', options: ["0", "1"]}
        ]},
        "Jurisdiction-Specific Fields": { icon: "fa-solid fa-flag-usa", fields: [
            {label: "Place of Birth (DCI):", name: "place_of_birth"},
            {label: "Audit Information (DCJ):", name: "audit_info", calculable: true}, 
            {label: "Issuing Office (IOE):", name: "issuing_office", calculable: true}, 
            {label: "Inventory Control (DCK):", name: "inventory_control", calculable: true},
            {label: "Jurisdiction Eye Color (ZCA):", name: "zca_eye_color"},
            {label: "Jurisdiction Hair Color (ZCB):", name: "zcb_hair_color"},
            {label: "Jurisdiction Field C (ZCC):", name: "zcc_field"},
            {label: "Jurisdiction Field D (ZCD):", name: "zcd_field"},
            {label: "Jurisdiction Field E (ZCE):", name: "zce_field"},
            {label: "Jurisdiction Field F (ZCF):", name: "zcf_field"}
        ]},
        "Optional Fields": { icon: "fa-solid fa-plus-square", fields: [
            {label: "Alias Family Name (DBN):", name: "alias_family"},
            {label: "Alias Given Name (DBG):", name: "alias_given"},
            {label: "Alias Suffix Name (DBS):", name: "alias_suffix"}
        ]}
    };

    /**
     * Xây dựng giao diện người dùng (form, control) từ fieldDefinitions.
     */
    function buildFormAndControls() {
        // Hàm nội bộ để cập nhật IIN dựa trên bang được chọn.
        function updateIinBasedOnState() {
            const selectedState = a417_fields.state.value.toUpperCase();
            const iin = STATE_IIN_MAP[selectedState] || '636000'; // Mặc định nếu không tìm thấy
            a417_fields.iin.value = iin;
        }

        // Tạo HTML cho các accordion và các trường input.
        let accordionHtml = '';
        for (const category in fieldDefinitions) {
            const categoryInfo = fieldDefinitions[category];
            accordionHtml += `<div class="accordion-item">
                <button class="accordion-header"><i class="${categoryInfo.icon}"></i> ${category}</button>
                <div class="accordion-content">
                    <div class="grid-3-col">`;
            
            categoryInfo.fields.forEach(field => {
                const elementId = field.label.match(/\((.*?)\)/)?.[1] || '';
                
                let labelHtml = `<label for="a417-${field.name}" class="${field.calculable ? 'label-with-calculator' : ''}">
                                     <span>${field.label}</span>`;
                if (field.calculable) {
                    labelHtml += `<button class="field-calculator-btn" data-field-name="${field.name}" title="Generate for this field">
                                      <i class="fa-solid fa-calculator"></i>
                                  </button>`;
                }
                labelHtml += `</label>`;
                accordionHtml += labelHtml;

                if (field.type === 'combobox') {
                    const datalistId = `datalist-${field.name}`;
                    accordionHtml += `<input list="${datalistId}" id="a417-${field.name}" value="${field.value || ''}" placeholder="${field.placeholder || ''}" autocomplete="off">`;
                    accordionHtml += `<datalist id="${datalistId}">`;
                    field.options.forEach(opt => {
                        if (Array.isArray(opt)) {
                            accordionHtml += `<option value="${opt[0]}">${opt[1] || ''}</option>`;
                        } else {
                            accordionHtml += `<option value="${opt}"></option>`;
                        }
                    });
                    accordionHtml += `</datalist>`;
                } else { 
                    accordionHtml += `<input type="text" id="a417-${field.name}" 
                                   value="${field.value || ''}" 
                                   placeholder="${field.placeholder || ''}">`;
                }
                 accordionHtml += `<span>${elementId}</span>`;
            });
            accordionHtml += `</div></div></div>`;
        }
        accordionContainer.innerHTML = accordionHtml;

        // Lưu trữ tham chiếu đến tất cả các phần tử input vào object a417_fields.
        for (const category in fieldDefinitions) {
             fieldDefinitions[category].fields.forEach(field => {
                const element = document.getElementById(`a417-${field.name}`);
                if (element) {
                    a417_fields[field.name] = element;
                } else {
                    console.warn(`Element with id 'a417-${field.name}' not found.`);
                }
             });
        }
        
        // Tạo các nút điều khiển chính.
        const states = Object.keys(STATE_IIN_MAP).sort();
        let stateOptions = states.map(s => `<option value="${s}"></option>`).join('');
        
        controlsContainer.innerHTML = `
            <div class="state-selector-group">
                <label for="a417-state-selector-for-random">State:</label>
                <input list="a417-states-datalist" id="a417-state-selector-for-random" placeholder="e.g., CA" value="CA">
                <datalist id="a417-states-datalist">${stateOptions}</datalist>
            </div>
            <button id="a417-fill-all-btn"><i class="fa-solid fa-wand-magic-sparkles"></i> Fill All Fields</button>
            <label for="a417-excel-input" class="file-input-label"><i class="fa-solid fa-file-excel"></i> Import Excel</label>
            <input type="file" id="a417-excel-input" accept=".xlsx, .xls">
            <button id="a417-generate-current-btn"><i class="fa-solid fa-gears"></i> Generate Barcode</button>
        `;

        // Gắn các trình xử lý sự kiện.
        addAccordionListeners();
        addFieldCalculatorListeners();
        addTabListeners();
        
        document.getElementById('a417-fill-all-btn').addEventListener('click', generateAllRandomData);
        document.getElementById('a417-excel-input').addEventListener('change', importFromExcel);
        document.getElementById('a417-generate-current-btn').addEventListener('click', generateBarcodeForCurrentData);
        document.getElementById('a417-export-all-btn').addEventListener('click', exportAllImages);
        
        const stateSelector = document.getElementById('a417-state-selector-for-random');
        stateSelector.addEventListener('change', () => {
            a417_fields.state.value = stateSelector.value;
            updateIinBasedOnState();
        });
        if (a417_fields.state) {
            a417_fields.state.addEventListener('change', updateIinBasedOnState);
        }
    }

    /**
     * Gắn sự kiện đóng/mở cho các accordion.
     */
    function addAccordionListeners() {
        const headers = document.querySelectorAll('.accordion-header');
        headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                header.classList.toggle('active');
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    content.classList.remove('active');
                } else {
                    content.style.maxHeight = content.scrollHeight + 40 + "px"; 
                    content.classList.add('active');
                }
            });
            // Mặc định mở 2 accordion đầu tiên.
            if(index < 2) {
                header.click();
            }
        });
    }

    /**
     * Gắn sự kiện chuyển tab cho khu vực output.
     */
    function addTabListeners() {
        const tabLinks = document.querySelectorAll('.output-tabs .tab-link');
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.getAttribute('data-tab');
                document.querySelectorAll('.output-tabs .tab-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }
    
    /**
     * Gắn sự kiện cho các nút "tính toán" bên cạnh mỗi trường.
     */
    function addFieldCalculatorListeners() {
        accordionContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.field-calculator-btn');
            if (!button) return;

            const fieldName = button.dataset.fieldName;
            const state = document.getElementById('a417-state-selector-for-random').value.toUpperCase();

            // Ưu tiên hàm tạo riêng của bang, nếu không có thì dùng hàm chung.
            const generator = (fieldGenerators.specific[state] && fieldGenerators.specific[state][fieldName]) 
                              || fieldGenerators.generic[fieldName];
            
            if (generator) {
                generator();
            } else {
                console.warn(`No generator found for field '${fieldName}' in state '${state}'`);
            }
        });
    }
    
    // =======================================================================
    // === SECTION: UTILITY FUNCTIONS (Hàm tiện ích)                       ===
    // =======================================================================
    
    function get_letter_corresponding_month(month) {
        const letters = "ABCDEFGHIJKL";
        const monthStr = String(month);
        const monthInt = parseInt(monthStr, 10);
        if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
            return ''; 
        }
        return letters[monthInt - 1];
    }
    function showInputDataAlert(message) {
        console.warn("Input Data Alert:", message);
        alert("Lỗi tính toán: " + message);
    }
    function getNumberOfDaysFromBeginnigOfYear(date) {
        if(!date || date.length !== 8) return "000";
        const mdays_leap = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const mdays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const day = parseInt(date.slice(2, 4));
        const month = parseInt(date.slice(0, 2));
        const year = parseInt(date.slice(-4));
        if (isNaN(day) || isNaN(month) || isNaN(year)) return "000";
        let total_days = day;
        const daysArray = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? mdays_leap : mdays;
        for (let i = 1; i < month; i++) {
            total_days += daysArray[i];
        }
        return ("00" + total_days).slice(-3);
    }
    function randomDate(start, end) {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }
    function getFormattedDate_MMDDYYYY(date) {
        let year = date.getFullYear();
        let month = (1 + date.getMonth()).toString().padStart(2, '0');
        let day = date.getDate().toString().padStart(2, '0');
        return month + day + year;
    }
    function getRandomDateByYear(minYear, maxYear) {
        const minDate = new Date(minYear, 0, 1);
        const maxDate = new Date(maxYear, 11, 31);
        return randomDate(minDate, maxDate);
    }
    function getRandomDigit() { return "0123456789"[Math.floor(Math.random() * 10)]; }
    function getRandomNumericString(len) {
        let s = "";
        for (let i = 0; i < len; i++) s += getRandomDigit();
        return s;
    }
    function getRandomLetter() { return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; }
    function getRandomLetterAndDigit() {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    function getRandomLastName() {
        const lastnames = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson"];
        return lastnames[Math.floor(Math.random() * lastnames.length)];
    }
    function getRandomFirstName(sex) {
        const m_names = ["James","Robert","John","Michael","David","William","Richard","Joseph","Thomas","Charles"];
        const f_names = ["Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica","Sarah","Karen"];
        return (sex == "2") ? (f_names[Math.floor(Math.random() * f_names.length)]) : (m_names[Math.floor(Math.random() * m_names.length)]);
    }
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // =======================================================================
    // === SECTION: STATE-SPECIFIC & GENERIC GENERATORS                    ===
    // =======================================================================
    
    // --- Generic Generators (Dùng khi không có hàm riêng cho bang) ---
    const generic_calculate_documentNumber = () => { a417_fields.customer_id.value =getRandomNumericString(8); };
    const generic_calculate_ICN = () => { a417_fields.inventory_control.value = getRandomNumericString(12); };
    const generic_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomLetterAndDigit() + getRandomLetterAndDigit() + getRandomNumericString(10); };
    const randomize_family_name = () => { a417_fields.family_name.value = getRandomLastName(); };
    const randomize_first_name = () => { a417_fields.first_name.value = getRandomFirstName(a417_fields.sex.value); };
    const randomize_dob = () => { a417_fields.dob.value = getFormattedDate_MMDDYYYY(getRandomDateByYear(1960, 2002)); };
    const randomize_issue_date = () => { 
        const today = new Date();
        a417_fields.issue_date.value = getFormattedDate_MMDDYYYY(getRandomDateByYear(2020, today.getFullYear())); 
    };
    const randomize_expiry_date = () => {
        const issueDateStr = a417_fields.issue_date.value;
        if (!issueDateStr || issueDateStr.length !== 8) {
            randomize_issue_date(); // Phải có ngày cấp trước
        }
        const updatedIssueDateStr = a417_fields.issue_date.value;
        const month = parseInt(updatedIssueDateStr.substring(0, 2)) - 1;
        const day = parseInt(updatedIssueDateStr.substring(2, 4));
        const year = parseInt(updatedIssueDateStr.substring(4, 8));
        const issueDate = new Date(year, month, day);

        const state = document.getElementById('a417-state-selector-for-random').value.toUpperCase();
        const expiryYears = (state === 'AZ') ? 12 : 8; // Arizona có thời hạn 12 năm
        const expiryDate = new Date(issueDate.getFullYear() + expiryYears, issueDate.getMonth(), issueDate.getDate());
        a417_fields.expiry_date.value = getFormattedDate_MMDDYYYY(expiryDate);
    };

    // --- State-Specific Generators ---
    const AL_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(8); };
    const AL_calculate_ICN = () => {
        const { customer_id, issue_date } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 8 || !issue_date.value || issue_date.value.length !== 8) { showInputDataAlert("AL ICN Error: A valid 8-char Doc Num and Issue Date are required."); return; }
        const days = ("00" + (parseInt(getNumberOfDaysFromBeginnigOfYear(issue_date.value)) + 4)).slice(-3);
        a417_fields.inventory_control.value = `${customer_id.value}${getRandomNumericString(5)}${issue_date.value.slice(-2)}${days}01`;
    };
    const AL_calculate_expiry_date = () => {
        const issueDateStr = a417_fields.issue_date.value;
        if (!issueDateStr || issueDateStr.length !== 8) { showInputDataAlert("AL Expiry Date Error: A valid Issue Date is required."); return; }
        const month = issueDateStr.slice(0, 2);
        let day = parseInt(issueDateStr.slice(2, 4)) - 1;
        if (day < 1) day = 1; 
        const year = (parseInt(issueDateStr.slice(-4)) + 4).toString();
        a417_fields.expiry_date.value = month + day.toString().padStart(2, '0') + year;
    };
    
    const AK_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(7); };
    const AK_calculate_ICN = () => { a417_fields.inventory_control.value = "1000" + getRandomNumericString(6); };
    const AK_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("DD calculation error for AK. Incorrect issue date!"); return; }
        const randLetter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const ending = Math.random() < 0.5 ? "-0" : "-1";
        const dd = "8" + getRandomNumericString(6) + " " + getRandomNumericString(3) + issueDate.slice(-2) + issueDate.slice(0, 2) + issueDate.slice(2, 4) + randLetter() + randLetter() + randLetter() + ending;
        a417_fields.document_discriminator.value = dd;
    };

    const AZ_calculate_documentNumber = () => { a417_fields.customer_id.value = "D" + getRandomNumericString(8); };
    const AZ_calculate_ICN = () => { a417_fields.inventory_control.value = "48" + getRandomNumericString(9); };
    const AZ_calculate_DD = () => {
        const { dob, first_name, family_name } = a417_fields;
        if (!dob.value || dob.value.length !== 8 || !first_name.value || !family_name.value) { showInputDataAlert("AZ DD calculation error. DOB, First Name, and Last Name are required."); return; }
        a417_fields.document_discriminator.value = getRandomNumericString(4) + getRandomLetter() + getRandomLetter() + getRandomNumericString(3) + family_name.value.charAt(0).toUpperCase() + getRandomNumericString(4) + first_name.value.charAt(0).toUpperCase() + dob.value.slice(-1);
    };

    const AR_calculate_documentNumber = () => { a417_fields.customer_id.value = "9" + getRandomNumericString(8); };
    const AR_calculate_ICN = () => { a417_fields.inventory_control.value = "021011" + getRandomNumericString(10); };
    const AR_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(9) + " " + getRandomNumericString(4); };
    
    const CA_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomNumericString(7); };
    const CA_calculate_ICN = () => {
        const { customer_id, issue_date } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 8 || !issue_date.value || issue_date.value.length !== 8) { showInputDataAlert("CA ICN Error: Incorrect doc number (8 chars) or issue date."); return; }
        a417_fields.inventory_control.value = issue_date.value.slice(-2) + getNumberOfDaysFromBeginnigOfYear(issue_date.value) + customer_id.value + "0401";
    };
    const CA_calculate_DD = () => {
        const { issue_date, expiry_date } = a417_fields;
        if (!issue_date.value || issue_date.value.length !== 8 || !expiry_date.value || expiry_date.value.length !== 8) { showInputDataAlert("CA DD Error: Incorrect issue or expiry date."); return; }
        const suffix = ["AA", "BB", "DD"][Math.floor(Math.random() * 3)];
        const fullIssueDate = `${issue_date.value.slice(0, 2)}/${issue_date.value.slice(2, 4)}/${issue_date.value.slice(-4)}`;
        a417_fields.document_discriminator.value = `${fullIssueDate}${getRandomNumericString(5)}/${suffix}FD/${expiry_date.value.slice(-2)}`;
    };

    const CO_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(9); };
    const CO_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(7); };
    const CO_calculate_audit_info = () => {
        const issueDateStr = a417_fields.issue_date.value;
        if (!issueDateStr || issueDateStr.length !== 8) { showInputDataAlert("CO Audit Info calculation error: Incorrect issue date."); return; }
        const issueDate = new Date(parseInt(issueDateStr.slice(4, 8)), parseInt(issueDateStr.slice(0, 2)) - 1, parseInt(issueDateStr.slice(2, 4)));
        issueDate.setDate(issueDate.getDate() + 1);
        const formattedDate = (issueDate.getMonth() + 1).toString().padStart(2, '0') + issueDate.getDate().toString().padStart(2, '0') + issueDate.getFullYear().toString().slice(-2);
        a417_fields.audit_info.value = `CODL_0_${formattedDate}_${getRandomNumericString(5)}`;
    };

    const CT_calculate_documentNumber = () => {
        const dob = a417_fields.dob.value;
        if (!dob || dob.length !== 8) { showInputDataAlert("CT Doc Number Error: Incorrect birth date!"); return; }
        const year = parseInt(dob.slice(-4));
        const monthNumber = (year % 2) ? dob.slice(0, 2) : (parseInt(dob.slice(0, 2)) + 12).toString();
        a417_fields.customer_id.value = monthNumber + getRandomNumericString(7);
    };
    const CT_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 9) { showInputDataAlert("CT ICN Error: Incorrect doc num (9 digits)."); return; }
        a417_fields.inventory_control.value = docNum + "CT" + getRandomDigit() + getRandomLetter() + getRandomLetter() + getRandomLetter() + "01";
    };
    const CT_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("CT DD Error: Incorrect issue date!"); return; }
        const formattedDate = issueDate.slice(-2) + issueDate.slice(0, 2) + issueDate.slice(2, 4);
        a417_fields.document_discriminator.value = `${formattedDate}${getRandomNumericString(6)}01MV${getRandomLetter()}${getRandomDigit()}`;
    };

    const DE_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(7); };
    const DE_calculate_ICN = () => { a417_fields.inventory_control.value = "0110" + getRandomNumericString(12); };
    const DE_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("DE DD Error: Incorrect issue date!"); return; }
        const formattedDate = issueDate.slice(-4) + issueDate.slice(0, 2) + issueDate.slice(2, 4);
        a417_fields.document_discriminator.value = `L${formattedDate}${getRandomNumericString(6)}C`;
    };
    
    const FL_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomNumericString(12); };
    const FL_calculate_ICN = () => { a417_fields.inventory_control.value = "0100" + getRandomNumericString(12); };
    const FL_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomLetter() + getRandomNumericString(12); };

    const GA_calculate_documentNumber = () => { a417_fields.customer_id.value = "0" + getRandomNumericString(8); };
    const GA_calculate_ICN = () => { a417_fields.inventory_control.value = "1000" + getRandomNumericString(7); };
    const GA_calculate_DD = () => {
        const icn = a417_fields.inventory_control.value;
        if (!icn || icn.length !== 11) { showInputDataAlert("GA DD calculation error: A valid 11-char ICN is required."); return; }
        a417_fields.document_discriminator.value = icn;
    };

    const HI_calculate_documentNumber = () => { a417_fields.customer_id.value = "H00" + getRandomNumericString(6); };
    const HI_calculate_audit_info = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("HI Audit Info Error: Incorrect issue date."); return; }
        const d = new Date(issueDate.slice(-4), parseInt(issueDate.slice(0,2)) - 1, parseInt(issueDate.slice(2,4)));
        d.setDate(d.getDate() + 6);
        const formattedDate = ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + d.getFullYear();
        a417_fields.audit_info.value = issueDate.slice(-4) + formattedDate.slice(0,4) + "_106336_2_1" + getRandomNumericString(2);
    };
    const HI_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("HI DD calculation error: Incorrect issue date!"); return; }
        let randomPart = getRandomNumericString(6);
        for (let i = 0; i < 6; i++) { randomPart += getRandomLetterAndDigit(); }
        const formattedDate = issueDate.slice(-4) + issueDate.slice(0,2) + issueDate.slice(2,4);
        a417_fields.document_discriminator.value = formattedDate + randomPart + "-ICWH";
    };

    const IA_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(3) + getRandomLetter() + getRandomLetter() + getRandomNumericString(4); }; 
    const IA_calculate_DD = () => {
        const { expiry_date, family_name, first_name, sex } = a417_fields;
        if (expiry_date.value.length !== 8 || !family_name.value || !first_name.value) { showInputDataAlert("IA DD Error: Expiry date, first and last name are required."); return; }
        let sexCode = sex.value === '1' ? 'M' : (sex.value === '2' ? 'F' : sex.value);
        const ddValue = `${getRandomNumericString(9)}${family_name.value[0]}${first_name.value[0]}${getRandomNumericString(4)}${sexCode}${expiry_date.value.slice(2, 4)}${expiry_date.value.slice(0, 2)}${expiry_date.value.slice(-2)}D`;
        a417_fields.document_discriminator.value = ddValue;
    };
    const IA_calculate_ICN = () => {
        let docNum = a417_fields.customer_id.value;
        if (!docNum) { docNum = getRandomNumericString(3) + getRandomLetter() + getRandomLetter() + getRandomNumericString(4); a417_fields.customer_id.value = docNum; }
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("IA ICN Error: Incorrect issue date."); return; }
        const d = ("000" + (parseInt(getNumberOfDaysFromBeginnigOfYear(issueDate)) + 3)).slice(-3);
        a417_fields.inventory_control.value = docNum + issueDate.slice(-2) + d + "0101";
    };

    const ID_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomLetter() + getRandomNumericString(6) + getRandomLetter(); };
    const ID_calculate_ICN = () => { a417_fields.inventory_control.value = "MT" + getRandomNumericString(6) + "H" + getRandomNumericString(6) + "001"; };
    const ID_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(15); };

    const IL_calculate_documentNumber = () => {
        const familyName = a417_fields.family_name.value;
        if (!familyName) { showInputDataAlert("IL DocNumber Error: Last name is required!"); return; }
        a417_fields.customer_id.value = familyName[0].toUpperCase() + getRandomNumericString(11);
    };
    const IL_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 12) { showInputDataAlert("IL ICN Error: Doc num must be 12 chars!"); return; }
        a417_fields.inventory_control.value = `${docNum}IL${getRandomLetter()}${getRandomLetterAndDigit()}${getRandomLetter()}${getRandomLetter()}01`;
    };
    const IL_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("IL DD Error: Incorrect issue date!"); return; }
        const formattedDate = `${issueDate.slice(-4)}${issueDate.slice(0, 2)}${issueDate.slice(2, 4)}`;
        a417_fields.document_discriminator.value = `${formattedDate}${getRandomNumericString(3)}${getRandomLetter()}${getRandomLetter()}${getRandomNumericString(4)}`;
    };

    const IN_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(4) + "-" + getRandomNumericString(2) + "-" + getRandomNumericString(4); };
    const IN_calculate_ICN = () => { a417_fields.inventory_control.value = "03701" + getRandomNumericString(11); };
    const IN_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("IN DD Error: Incorrect issue date!"); return; }
        const formattedDate = issueDate.slice(0, 4) + issueDate.slice(-2);
        a417_fields.document_discriminator.value = `${formattedDate}${getRandomNumericString(3)}00${getRandomNumericString(3)}`;
    };
    const IN_calculate_issuing_office = () => { a417_fields.issuing_office.value = "0" + getRandomInt(21, 35).toString(); };
    
    const KS_calculate_documentNumber = () => { a417_fields.customer_id.value = "K00-" + getRandomNumericString(2) + "-" + getRandomNumericString(4); };
    const KS_calculate_ICN = () => {
        const { issue_date, customer_id } = a417_fields;
        if (!issue_date.value || !customer_id.value || customer_id.value.replace(/-/g, '').length !== 9) { showInputDataAlert("KS ICN Error: Issue Date and valid Doc Number are required."); return; }
        const days = ("000" + (parseInt(getNumberOfDaysFromBeginnigOfYear(issue_date.value)) + 3)).slice(-3);
        a417_fields.inventory_control.value = issue_date.value.slice(-2) + days + customer_id.value.replace(/-/g, '') + "0101";
    };
    const KS_calculate_DD = () => {
        const { dob, issue_date, expiry_date, family_name, first_name, sex } = a417_fields;
        if (!dob.value || !issue_date.value || !expiry_date.value || !family_name.value || !first_name.value || !sex.value) { showInputDataAlert("KS DD Error: All required fields (DOB, dates, names, sex) must be filled."); return; }
        let sexCode = sex.value === '1' ? 'M' : (sex.value === '2' ? 'F' : sex.value);
        const formattedDays = ("000" + (parseInt(getNumberOfDaysFromBeginnigOfYear(issue_date.value)) + 1)).slice(-3);
        const ddValue = `${dob.value.slice(-2, -1)}${formattedDays}${getRandomNumericString(6)}${dob.value.slice(-1)}${family_name.value[0]}${first_name.value[0]}${issue_date.value.slice(-2)}${formattedDays}${sexCode}${expiry_date.value.slice(-2)}${expiry_date.value.slice(2,4)}${get_letter_corresponding_month(expiry_date.value.slice(0,2))}B`;
        a417_fields.document_discriminator.value = ddValue;
    };

    const KY_calculate_documentNumber = () => {
        const lastName = a417_fields.family_name.value;
        if (!lastName) { showInputDataAlert("KY Doc num error: Last Name is required."); return; }
        a417_fields.customer_id.value = lastName.charAt(0).toUpperCase() + getRandomNumericString(8);
    };
    const KY_calculate_ICN = () => { a417_fields.inventory_control.value = "04601" + getRandomNumericString(11); };
    const KY_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("KY DD calculation error: Incorrect issue date!"); return; }
        const formattedDate = `${issueDate.slice(-4)}${issueDate.slice(0, 2)}${issueDate.slice(2, 4)}`;
        a417_fields.document_discriminator.value = `${formattedDate}${getRandomNumericString(8)} 01111`;
    };

    const LA_calculate_documentNumber = () => { a417_fields.customer_id.value = (Math.random() > 0.5 ? "00" : "01") + getRandomNumericString(7); };
    const LA_calculate_ICN = () => { a417_fields.inventory_control.value = "00700" + getRandomNumericString(11); };
    const LA_calculate_audit_info = () => { a417_fields.audit_info.value = getRandomNumericString(4); };
    const LA_calculate_issuing_office = () => { a417_fields.issuing_office.value = "0" + getRandomInt(21, 35).toString(); };
    
    const MA_calculate_documentNumber = () => { a417_fields.customer_id.value = "S" + getRandomNumericString(8); };
    const MA_calculate_ICN = () => {
        const { customer_id, issue_date } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 9 || !issue_date.value || issue_date.value.length !== 8) { showInputDataAlert("MA ICN Error: Doc Num ('S' + 8 digits) and Issue Date are required."); return; }
        a417_fields.inventory_control.value = issue_date.value.slice(-2) + getNumberOfDaysFromBeginnigOfYear(issue_date.value) + customer_id.value + "0601";
    };
    const MA_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("MA DD calculation error: Incorrect issue date!"); return; }
        a417_fields.document_discriminator.value = issueDate + " REV 02222016";
    };

    const MD_calculate_documentNumber = () => {
        const lastName = a417_fields.family_name.value;
        if (!lastName) { showInputDataAlert("MD Doc Num Error: Last name is required."); return; }
        a417_fields.customer_id.value = lastName.charAt(0).toUpperCase() + "-" + getRandomNumericString(3) + "-" + getRandomNumericString(3) + "-" + getRandomNumericString(3) + "-" + getRandomNumericString(3);
    };
    const MD_calculate_ICN = () => { a417_fields.inventory_control.value = "100" + getRandomNumericString(7); };
    const MD_calculate_DD = () => { a417_fields.document_discriminator.value = `${getRandomNumericString(6)}${getRandomLetter()}${getRandomLetter()}${getRandomDigit()}`; };

    const ME_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(7); };
    const ME_calculate_ICN = () => {
        const { customer_id, issue_date } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 7 || !issue_date.value || issue_date.value.length !== 8) { showInputDataAlert("ME ICN Error: Doc Num (7 digits) and Issue Date are required."); return; }
        const d = ("00" + (parseInt(getNumberOfDaysFromBeginnigOfYear(issue_date.value)) + 4)).slice(-3);
        a417_fields.inventory_control.value = `F${issue_date.value.slice(-2)}${d}${customer_id.value}0101`;
    };
    const ME_calculate_DD = () => { a417_fields.document_discriminator.value = '0'.repeat(17) + getRandomNumericString(8); };

    const MI_calculate_documentNumber = () => {
        const lastName = a417_fields.family_name.value;
        if (!lastName) { showInputDataAlert("MI Doc Number error: Last Name is required!"); return; }
        a417_fields.customer_id.value = lastName.charAt(0).toUpperCase() + getRandomNumericString(12);
    };
    
    // === HÀM ĐÃ SỬA LỖI TÍNH TOÁN ===
    const MI_calculate_ICN = () => {
        const { customer_id, expiry_date } = a417_fields;
        if (!customer_id.value || !expiry_date.value || expiry_date.value.length !== 8) { 
            showInputDataAlert("MI ICN error: Valid Doc Num and Expiry Date are required."); 
            return; 
        }
        const docNumWithoutSpaces = customer_id.value.replace(/\s/g, '');
        const expiry_YYYYMMDD = expiry_date.value.slice(-4) + expiry_date.value.slice(0, 2) + expiry_date.value.slice(2, 4);
        const exp_YYMM = expiry_date.value.slice(-2) + expiry_date.value.slice(0, 2);
        a417_fields.inventory_control.value = docNumWithoutSpaces + expiry_YYYYMMDD + exp_YYMM;
    };
    const MI_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(13); };

    const MN_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomNumericString(12); };
    const MN_calculate_ICN = () => {
        const { customer_id, issue_date } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 13 || !issue_date.value || issue_date.value.length !== 8) { showInputDataAlert("MN ICN Error: Doc Num (13 chars) and Issue Date are required."); return; }
        const d = ("00" + (parseInt(getNumberOfDaysFromBeginnigOfYear(issue_date.value)) + 3)).slice(-3);
        a417_fields.inventory_control.value = customer_id.value + "01" + d + "01";
    };
    const MN_calculate_DD = () => { a417_fields.document_discriminator.value = '0'.repeat(7) + getRandomNumericString(7); };

    const MO_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + "0" + getRandomNumericString(8); };
    const MO_calculate_ICN = () => {
        const { issue_date, customer_id } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 10 || !issue_date.value) { showInputDataAlert("MO ICN Error: Doc Num (10 chars) and Issue Date are required."); return; }
        const days = parseInt(getNumberOfDaysFromBeginnigOfYear(issue_date.value)) + 2;
        a417_fields.inventory_control.value = issue_date.value.slice(-2) + ("00" + days).slice(-3) + customer_id.value + "0101";
    };
    const MO_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("MO DD calculation error. Incorrect issue date!"); return; }
        a417_fields.document_discriminator.value = issueDate.slice(-2) + "14" + getRandomNumericString(4) + "00" + getRandomNumericString(2);
    };

    const MS_calculate_documentNumber = () => { a417_fields.customer_id.value = "80" + getRandomNumericString(7); };
    const MS_calculate_ICN = () => { a417_fields.inventory_control.value = "05100" + getRandomNumericString(6) + "23" + getRandomNumericString(3); };
    const MS_calculate_DD = () => {
        const { dob, issue_date, expiry_date, family_name, first_name, sex } = a417_fields;
        if (!dob.value || !issue_date.value || !expiry_date.value || !family_name.value || !first_name.value || !sex.value) { showInputDataAlert("MS DD Error: All required fields (DOB, dates, names, sex) must be filled."); return; }
        let s = "";
        for(let i = 0; i < 7; i++) { s += getRandomLetterAndDigit(); }
        const d = getNumberOfDaysFromBeginnigOfYear(issue_date.value);
        const monthLetter = get_letter_corresponding_month(expiry_date.value.slice(0, 2));
        if (!monthLetter) { showInputDataAlert("MS DD Error: Could not generate month letter for Expiry Date."); return; }
        a417_fields.document_discriminator.value = dob.value.slice(-2, -1) + getRandomLetter() + s + dob.value.slice(-1) + family_name.value.charAt(0).toUpperCase() + first_name.value.charAt(0).toUpperCase() + issue_date.value.slice(-2) + d + sex.value + expiry_date.value.slice(-2) + expiry_date.value.slice(2, 4) + monthLetter;
    };

    const MT_calculate_documentNumber = () => {
        const birthDate = a417_fields.dob.value;
        if (!birthDate || birthDate.length !== 8) { showInputDataAlert("MT Doc Num Error: Incorrect birth date!"); return; }
        a417_fields.customer_id.value = birthDate.slice(0, 2) + getRandomNumericString(3) + birthDate.slice(-4) + "41" + birthDate.slice(2, 4);
    };
    const MT_calculate_ICN = () => {
        let data1 = "";
        for (let i = 0; i < 6; i++) { data1 += getRandomLetterAndDigit(); }
        a417_fields.inventory_control.value = "1100" + getRandomDigit() + data1 + "FMT" + getRandomLetterAndDigit() + getRandomLetter() + getRandomLetter() + "001";
    };
    const MT_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("MT DD calculation error: Incorrect issue date!"); return; }
        const formattedDate = `${issueDate.slice(-4)}${issueDate.slice(0, 2)}${issueDate.slice(2, 4)}`;
        a417_fields.document_discriminator.value = formattedDate + getRandomNumericString(12);
    };

    const NC_calculate_documentNumber = () => { a417_fields.customer_id.value = "00000" + getRandomNumericString(7); };
    const NC_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 12) { showInputDataAlert("NC ICN Error: Doc Num (12 chars) is required!"); return; }
        a417_fields.inventory_control.value = docNum + "NC" + getRandomLetterAndDigit() + getRandomLetterAndDigit() + getRandomLetterAndDigit() + getRandomLetterAndDigit() + "01";
    };
    const NC_calculate_DD = () => { a417_fields.document_discriminator.value = "001" + getRandomNumericString(7); };

    const ND_calculate_documentNumber = () => {
        const { dob, family_name } = a417_fields;
        if (!dob.value || dob.value.length !== 8 || !family_name.value) { showInputDataAlert("ND Doc Num Error: Incorrect DOB or Last Name!"); return; }
        a417_fields.customer_id.value = (family_name.value + "XX").slice(0, 3).toUpperCase() + dob.value.slice(-2) + getRandomNumericString(4);
    };
    const ND_calculate_ICN = () => { a417_fields.inventory_control.value = "05100" + getRandomNumericString(11); };
    const ND_calculate_DD = () => {
        const { dob, expiry_date, height, customer_id, family_name, first_name, sex } = a417_fields;
        if (!dob.value || !expiry_date.value || !height.value || !customer_id.value || !family_name.value || !first_name.value || !sex.value) { showInputDataAlert("ND DD Error: All required fields must be filled."); return; }
        const sex_digit = sex.value === "1" ? "5" : "1";
        a417_fields.document_discriminator.value = dob.value.slice(-2, -1) + customer_id.value + family_name.value.charAt(0).toUpperCase() + first_name.value.charAt(0).toUpperCase() + sex_digit + "2" + expiry_date.value.slice(-1) + expiry_date.value.slice(2, 4) + getRandomLetter().toLowerCase() + getRandomLetter() + height.value + "YDZ";
    };

    const NE_calculate_documentNumber = () => { a417_fields.customer_id.value = "ABCEGHV"[Math.floor(Math.random() * 7)] + getRandomNumericString(8); };
    const NE_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 9) { showInputDataAlert("NE ICN error: Incorrect doc num (9 chars)!"); return; }
        const icnValue = docNum + "NETYCO01";
        a417_fields.inventory_control.value = icnValue;
        NE_calculate_DD(icnValue); 
    };
    const NE_calculate_DD = (icn_from_previous_function = null) => {
        const icn = icn_from_previous_function || a417_fields.inventory_control.value;
        if (!icn || icn.length !== 17) { showInputDataAlert("NE DD error: A valid 17-char ICN is required."); return; }
        a417_fields.document_discriminator.value = "054" + icn + getRandomNumericString(5);
    };

    const NH_calculate_documentNumber = () => { a417_fields.customer_id.value = "NHL" + getRandomNumericString(8); };
    const NH_calculate_ICN = () => {
        const icnValue = "0" + getRandomNumericString(7);
        a417_fields.inventory_control.value = icnValue;
        a417_fields.document_discriminator.value = icnValue;
    };
    const NH_calculate_DD = () => {
        const icnValue = a417_fields.inventory_control.value;
        if (!icnValue || icnValue.length !== 8) { showInputDataAlert("NH DD error: A valid 8-char ICN is required."); return; }
        a417_fields.document_discriminator.value = icnValue;
    };

    const NJ_calculate_documentNumber = () => {
        const { family_name, first_name, dob } = a417_fields;
        if (!family_name.value || !first_name.value || !dob.value || dob.value.length !== 8) { showInputDataAlert("NJ Doc Num Error: Last Name, First Name, and a valid DOB are required."); return; }
        a417_fields.customer_id.value = family_name.value.charAt(0).toUpperCase() + getRandomNumericString(4) + getRandomNumericString(5) + getRandomNumericString(5);
    };
    const NJ_calculate_ICN = () => {
        const lastName = a417_fields.family_name.value;
        if (!lastName) { showInputDataAlert("NJ ICN Error: Last Name is required."); return; }
        let random_data = "";
        for (let i = 0; i < 9; i++) { random_data += getRandomLetterAndDigit(); }
        random_data += "NJ" + getRandomNumericString(2);
        a417_fields.inventory_control.value = lastName.charAt(0).toUpperCase() + random_data + "SL01";
    };
    const NJ_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("NJ DD Error: Incorrect issue date!"); return; }
        const days = getNumberOfDaysFromBeginnigOfYear(issueDate);
        a417_fields.document_discriminator.value = `${getRandomLetter()}${issueDate.slice(-4)}${days}0000${getRandomNumericString(4)}`;
    };

    const NM_calculate_documentNumber = () => { a417_fields.customer_id.value = "0" + getRandomNumericString(8); };
    const NM_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 9) { showInputDataAlert("NM ICN Error: Doc Num (9 chars) is required."); return; }
        a417_fields.inventory_control.value = docNum + "01";
    };
    
    const NV_calculate_documentNumber = () => { a417_fields.customer_id.value = "1" + getRandomNumericString(9); };
    const NV_calculate_ICN = () => { a417_fields.inventory_control.value = "0019" + getRandomNumericString(7) + "01"; };
    const NV_calculate_DD = () => { a417_fields.document_discriminator.value = "0001" + getRandomNumericString(17); };

    const NY_calculate_documentNumber = () => { a417_fields.customer_id.value = "7" + getRandomNumericString(8); };
    const NY_calculate_DD = () => { 
        let s = "";
        for (let i = 0; i < 8; i++) { s += getRandomLetterAndDigit(); }
        a417_fields.document_discriminator.value = s + "06";
    };

    const OH_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomLetter() + getRandomNumericString(6); };
    const OH_calculate_ICN = () => { a417_fields.inventory_control.value = getRandomLetter() + getRandomNumericString(8); };
    const OH_calculate_DD = () => { a417_fields.document_discriminator.value = "0" + getRandomNumericString(7) + "0"; };

    const OK_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + "08" + getRandomNumericString(7); };
    const OK_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 10) { showInputDataAlert("OK ICN Error: Doc Num (10 chars) is required!"); return; }
        a417_fields.inventory_control.value = docNum + "OK" + getRandomLetterAndDigit() + getRandomLetterAndDigit() + "SL01";
    };
    const OK_calculate_DD = () => {
        const { customer_id, issue_date, dob } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 10 || !issue_date.value || !dob.value) { showInputDataAlert("OK DD Error: Valid Doc Num, Issue Date, and DOB are required."); return; }
        const dobFormatted = dob.value.slice(0, 4) + dob.value.slice(-2);
        const issueFormatted = issue_date.value.slice(0, 4) + issue_date.value.slice(-2);
        a417_fields.document_discriminator.value = `${customer_id.value}${dobFormatted}${issueFormatted}R`;
    };

    const OR_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(7); };
    const OR_calculate_ICN = () => { a417_fields.inventory_control.value = "AA" + getRandomNumericString(7); };
    const OR_calculate_DD = () => { a417_fields.document_discriminator.value = `200${getRandomNumericString(6)}`; };

    const PA_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(8); };
    const PA_calculate_ICN = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("PA ICN Error: Incorrect issue date!"); return; }
        a417_fields.inventory_control.value = "02500" + getRandomNumericString(6) + issueDate.slice(-2) + getRandomNumericString(3);
    };
    const PA_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("PA DD calculation error: Incorrect issue date!"); return; }
        a417_fields.document_discriminator.value = issueDate.slice(-2) + getNumberOfDaysFromBeginnigOfYear(issueDate) + getRandomNumericString(10) + "00000" + getRandomNumericString(5);
    };
    
    const RI_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(7); };
    const RI_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || (docNum.length !== 7 && docNum.length !== 8)) { showInputDataAlert("RI ICN Error: Doc Num (7 or 8 chars) is required!"); return; }
        a417_fields.inventory_control.value = `O${docNum}RI${getRandomLetter()}${getRandomLetter()}TL01`;
    };
    const RI_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(7); };

    const SC_calculate_documentNumber = () => { a417_fields.customer_id.value = "10" + getRandomNumericString(7); };
    const SC_calculate_DD = () => {
        const expiryDate = a417_fields.expiry_date.value;
        if (!expiryDate || expiryDate.length !== 8) { showInputDataAlert("SC DD Error: Incorrect expiry date!"); return; }
        const ddValue = `${getRandomNumericString(8)}${expiryDate.slice(0, 2)}${expiryDate.slice(-2)}${getNumberOfDaysFromBeginnigOfYear(expiryDate)}${getRandomNumericString(4)}`;
        a417_fields.document_discriminator.value = ddValue;
    };
        
    const SD_calculate_documentNumber = () => { a417_fields.customer_id.value = "01" + getRandomNumericString(6); };
    const SD_calculate_ICN = () => { a417_fields.inventory_control.value = "042000" + getRandomNumericString(10); };
    const SD_calculate_DD = () => {
        const { issue_date, customer_id } = a417_fields;
        if (!issue_date.value || issue_date.value.length !== 8 || !customer_id.value || customer_id.value.length !== 8) { showInputDataAlert("SD DD Error: Incorrect issue date or doc num."); return; }
        const ddValue = `${customer_id.value}${issue_date.value.slice(-4)}${issue_date.value.slice(0, 2)}${issue_date.value.slice(2, 4)}${getRandomNumericString(7)}`;
        a417_fields.document_discriminator.value = ddValue;
    };

    const TN_calculate_documentNumber = () => { a417_fields.customer_id.value = (Math.random() < 0.5 ? '0' : '1') + getRandomNumericString(8); };
    const TN_calculate_ICN = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("TN ICN Error: Incorrect issue date!"); return; }
        a417_fields.inventory_control.value = issueDate.slice(-2) + getNumberOfDaysFromBeginnigOfYear(issueDate) + getRandomNumericString(9) + "0101";
    };
    const TN_calculate_DD = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("TN DD Error: Incorrect issue date!"); return; }
        const formattedDate = issueDate.slice(-2) + issueDate.slice(0, 2) + issueDate.slice(2, 4);
        a417_fields.document_discriminator.value = getRandomNumericString(2) + "0" + formattedDate + getRandomNumericString(7);
    };

    const TX_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(8); };
    const TX_calculate_ICN = () => { a417_fields.inventory_control.value = "10000" + getRandomNumericString(6); };
    const TX_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(20); };

    const UT_calculate_documentNumber = () => { a417_fields.customer_id.value = "1" + getRandomNumericString(8); };
    const UT_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 9) { showInputDataAlert("UT ICN Error: Doc Num (9 chars) is required!"); return; }
        a417_fields.inventory_control.value = `${docNum}UT${getRandomDigit()}${getRandomDigit()}SL01`;
    };
    const UT_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(8); };
  
    const VA_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomNumericString(8); };
    const VA_calculate_ICN = () => { a417_fields.inventory_control.value = "0060101" + getRandomNumericString(9); };
    const VA_calculate_DD = () => { a417_fields.document_discriminator.value = "0" + getRandomNumericString(8); };

    const VT_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(8); };
    const VT_calculate_DD = () => {
        const { customer_id, issue_date } = a417_fields;
        if (!customer_id.value || customer_id.value.length !== 8 || !issue_date.value || issue_date.value.length !== 8) { showInputDataAlert("VT DD Error: Incorrect doc num or issue date."); return; }
        a417_fields.document_discriminator.value = `${issue_date.value.slice(0, 4)}${issue_date.value.slice(-2)}${getRandomNumericString(4)}${customer_id.value}`;
    };

    const WA_calculate_documentNumber = () => { a417_fields.customer_id.value = "WDL" + getRandomLetterAndDigit().repeat(8) + "B"; };
    const WA_calculate_audit_info = () => {
        const issueDate = a417_fields.issue_date.value;
        if (!issueDate || issueDate.length !== 8) { showInputDataAlert("WA Audit Info error: Incorrect issue date!"); return; }
        a417_fields.audit_info.value = getRandomLetter() + issueDate.slice(0, 2) + issueDate.slice(2, 4) + issueDate.slice(-2) + "98" + getRandomNumericString(4);
    };
    const WA_calculate_DD = () => {
        const docNum = a417_fields.customer_id.value;
        let inventory_control = a417_fields.inventory_control.value;
        if (!docNum || docNum.length !== 12) { showInputDataAlert("WA DD Error: A valid 12-char Doc Num is required."); return; }
        if (!inventory_control || inventory_control.length !== 13) { generic_calculate_ICN(); inventory_control = a417_fields.inventory_control.value; }
        a417_fields.document_discriminator.value = docNum + inventory_control;
    };
   
    const WI_calculate_documentNumber = () => {
        const lastName = a417_fields.family_name.value;
        if (!lastName) { showInputDataAlert("WI Doc Num error: Last Name is required!"); return; }
        a417_fields.customer_id.value = lastName.charAt(0).toUpperCase() + getRandomNumericString(3) + "-" + getRandomNumericString(4) + "-" + getRandomNumericString(4) + "-" + getRandomNumericString(2);
    };
    const WI_calculate_ICN = () => { a417_fields.inventory_control.value = "0130100" + getRandomNumericString(9); };
    const WI_calculate_DD = () => {
        const { family_name, issue_date } = a417_fields;
        if (!family_name.value || !issue_date.value) { showInputDataAlert("WI DD Error: Last Name and Issue Date are required!"); return; }
        const formattedDate = issue_date.value.slice(-4) + issue_date.value.slice(0, 2) + issue_date.value.slice(2, 4);
        a417_fields.document_discriminator.value = `OT${family_name.value.charAt(0).toUpperCase()}${getRandomLetter()}${getRandomLetter()}${formattedDate}${Math.random() < 0.5 ? "10" : "15"}${getRandomNumericString(6)}`;
    };

    const WV_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomLetter() + getRandomNumericString(6); };
    const WV_calculate_ICN = () => {
        const docNum = a417_fields.customer_id.value;
        if (!docNum || docNum.length !== 7) { showInputDataAlert("WV ICN Error: Doc Num (7 chars) is required!"); return; }
        a417_fields.inventory_control.value = docNum + "WV" + getRandomLetter() + getRandomLetter() + getRandomLetter() + getRandomLetter() + "01";
    };
    const WV_calculate_DD = () => {
        const { dob, expiry_date, family_name, first_name } = a417_fields;
        if (!dob.value || !expiry_date.value || !family_name.value || !first_name.value) { showInputDataAlert("WV DD Error: All required fields must be filled."); return; }
        a417_fields.document_discriminator.value = dob.value.slice(0, 4) + dob.value.slice(-2) + family_name.value.charAt(0).toUpperCase() + first_name.value.charAt(0).toUpperCase() + expiry_date.value.slice(-2) + expiry_date.value.slice(0, 2);
    };

    const WY_calculate_documentNumber = () => { a417_fields.customer_id.value = "11" + getRandomNumericString(7); };
    const WY_calculate_ICN_and_DD = () => {
        const value = "100003" + getRandomNumericString(3) + "7";
        a417_fields.inventory_control.value = value;
        a417_fields.document_discriminator.value = value;
    };

    const DC_calculate_documentNumber = () => { a417_fields.customer_id.value = getRandomNumericString(7); };
    const DC_calculate_audit_info = () => {
        const issueDateStr = a417_fields.issue_date.value;
        if (!issueDateStr || issueDateStr.length !== 8) { showInputDataAlert("DC Audit Info Error: Incorrect issue date!"); return; }
        const issueDateObj = new Date(parseInt(issueDateStr.slice(-4)), parseInt(issueDateStr.slice(0, 2)) - 1, parseInt(issueDateStr.slice(2, 4)));
        issueDateObj.setDate(issueDateObj.getDate() + 5);
        const auditValue = `${getFormattedDate_MMDDYYYY(issueDateObj)}_${getRandomNumericString(6)}_${getRandomDigit()}_${getRandomNumericString(3)}`;
        a417_fields.audit_info.value = auditValue;
    };
    const DC_calculate_DD = () => { a417_fields.document_discriminator.value = getRandomNumericString(8); };

    // --- Object chứa tất cả các hàm generator để dễ dàng truy cập ---
    const fieldGenerators = {
        generic: {
            customer_id: generic_calculate_documentNumber, document_discriminator: generic_calculate_DD, inventory_control: generic_calculate_ICN,
            family_name: randomize_family_name, first_name: randomize_first_name, dob: randomize_dob,
            issue_date: randomize_issue_date, expiry_date: randomize_expiry_date,
        },
        specific: {
            'DC': { customer_id: DC_calculate_documentNumber, audit_info: DC_calculate_audit_info, document_discriminator: DC_calculate_DD },
            'AK': { customer_id: AK_calculate_documentNumber, inventory_control: AK_calculate_ICN, document_discriminator: AK_calculate_DD },
            'AL': { customer_id: AL_calculate_documentNumber, inventory_control: AL_calculate_ICN, expiry_date: AL_calculate_expiry_date },
            'AR': { customer_id: AR_calculate_documentNumber, inventory_control: AR_calculate_ICN, document_discriminator: AR_calculate_DD },
            'AZ': { customer_id: AZ_calculate_documentNumber, inventory_control: AZ_calculate_ICN, document_discriminator: AZ_calculate_DD },
            'CA': { customer_id: CA_calculate_documentNumber, inventory_control: CA_calculate_ICN, document_discriminator: CA_calculate_DD },
            'CO': { customer_id: CO_calculate_documentNumber, audit_info: CO_calculate_audit_info, document_discriminator: CO_calculate_DD },
            'CT': { customer_id: CT_calculate_documentNumber, inventory_control: CT_calculate_ICN, document_discriminator: CT_calculate_DD },
            'DE': { customer_id: DE_calculate_documentNumber, inventory_control: DE_calculate_ICN, document_discriminator: DE_calculate_DD },
            'FL': { customer_id: FL_calculate_documentNumber, inventory_control: FL_calculate_ICN, document_discriminator: FL_calculate_DD },
            'GA': { customer_id: GA_calculate_documentNumber, inventory_control: GA_calculate_ICN, document_discriminator: GA_calculate_DD  },
            'HI': { customer_id: HI_calculate_documentNumber, audit_info: HI_calculate_audit_info, document_discriminator: HI_calculate_DD},
            'IA': {customer_id: IA_calculate_documentNumber, inventory_control: IA_calculate_ICN, document_discriminator: IA_calculate_DD},            
            'ID': { customer_id: ID_calculate_documentNumber, inventory_control: ID_calculate_ICN, document_discriminator: ID_calculate_DD },
            'IL': { customer_id: IL_calculate_documentNumber, inventory_control: IL_calculate_ICN, document_discriminator: IL_calculate_DD },
            'IN': { customer_id: IN_calculate_documentNumber, inventory_control: IN_calculate_ICN, document_discriminator: IN_calculate_DD, issuing_office: IN_calculate_issuing_office },            
            'KS': { customer_id: KS_calculate_documentNumber, inventory_control: KS_calculate_ICN, document_discriminator: KS_calculate_DD },            
            'KY': { customer_id: KY_calculate_documentNumber, inventory_control: KY_calculate_ICN, document_discriminator: KY_calculate_DD },
            'LA': { customer_id: LA_calculate_documentNumber, inventory_control: LA_calculate_ICN, audit_info: LA_calculate_audit_info, issuing_office: LA_calculate_issuing_office }, 
            'MD': { customer_id: MD_calculate_documentNumber, inventory_control: MD_calculate_ICN, document_discriminator: MD_calculate_DD },
            'ME': { customer_id: ME_calculate_documentNumber, inventory_control: ME_calculate_ICN, document_discriminator: ME_calculate_DD },
            'MI': { customer_id: MI_calculate_documentNumber, inventory_control: MI_calculate_ICN, document_discriminator: MI_calculate_DD },
            'MN': { customer_id: MN_calculate_documentNumber, inventory_control: MN_calculate_ICN, document_discriminator: MN_calculate_DD },
            'MO': { customer_id: MO_calculate_documentNumber, inventory_control: MO_calculate_ICN, document_discriminator: MO_calculate_DD },
            'MS': { customer_id: MS_calculate_documentNumber, inventory_control: MS_calculate_ICN, document_discriminator: MS_calculate_DD },
            'MT': { customer_id: MT_calculate_documentNumber, inventory_control: MT_calculate_ICN, document_discriminator: MT_calculate_DD },
            'NC': { customer_id: NC_calculate_documentNumber, inventory_control: NC_calculate_ICN, document_discriminator: NC_calculate_DD },
            'ND': { customer_id: ND_calculate_documentNumber, inventory_control: ND_calculate_ICN, document_discriminator: ND_calculate_DD },
            'NE': { customer_id: NE_calculate_documentNumber, inventory_control: NE_calculate_ICN, document_discriminator: NE_calculate_DD },
            'NH': { customer_id: NH_calculate_documentNumber, inventory_control: NH_calculate_ICN, document_discriminator: NH_calculate_DD },
            'NJ': { customer_id: NJ_calculate_documentNumber, inventory_control: NJ_calculate_ICN, document_discriminator: NJ_calculate_DD },
            'NM': { customer_id: NM_calculate_documentNumber, inventory_control: NM_calculate_ICN },
            'NV': { customer_id: NV_calculate_documentNumber, inventory_control: NV_calculate_ICN, document_discriminator: NV_calculate_DD },
            'NY': { customer_id: NY_calculate_documentNumber, document_discriminator: NY_calculate_DD },
            'OH': { customer_id: OH_calculate_documentNumber, inventory_control: OH_calculate_ICN, document_discriminator: OH_calculate_DD },
            'OK': { customer_id: OK_calculate_documentNumber, inventory_control: OK_calculate_ICN, document_discriminator: OK_calculate_DD },
            'OR': { customer_id: OR_calculate_documentNumber, inventory_control: OR_calculate_ICN, document_discriminator: OR_calculate_DD },            
            'PA': { customer_id: PA_calculate_documentNumber, inventory_control: PA_calculate_ICN, document_discriminator: PA_calculate_DD },
            'RI': { customer_id: RI_calculate_documentNumber, inventory_control: RI_calculate_ICN, document_discriminator: RI_calculate_DD },
            'SC': { customer_id: SC_calculate_documentNumber, document_discriminator: SC_calculate_DD },            
            'SD': { customer_id: SD_calculate_documentNumber, inventory_control: SD_calculate_ICN, document_discriminator: SD_calculate_DD }, 
            'TN': { customer_id: TN_calculate_documentNumber, inventory_control: TN_calculate_ICN, document_discriminator: TN_calculate_DD },
            'TX': { customer_id: TX_calculate_documentNumber, inventory_control: TX_calculate_ICN, document_discriminator: TX_calculate_DD },
            'UT': { customer_id: UT_calculate_documentNumber, inventory_control: UT_calculate_ICN, document_discriminator: UT_calculate_DD },
            'VA': { customer_id: VA_calculate_documentNumber, inventory_control: VA_calculate_ICN, document_discriminator: VA_calculate_DD },
            'VT': { customer_id: VT_calculate_documentNumber, document_discriminator: VT_calculate_DD },
            'WA': { customer_id: WA_calculate_documentNumber, audit_info: WA_calculate_audit_info, document_discriminator: WA_calculate_DD },
            'WI': { customer_id: WI_calculate_documentNumber, inventory_control: WI_calculate_ICN, document_discriminator: WI_calculate_DD },
            'WV': { customer_id: WV_calculate_documentNumber, inventory_control: WV_calculate_ICN, document_discriminator: WV_calculate_DD },
            'WY': { customer_id: WY_calculate_documentNumber, inventory_control: WY_calculate_ICN_and_DD, document_discriminator: WY_calculate_ICN_and_DD }
        }
    };

    // =======================================================================
    // === SECTION: CORE APPLICATION LOGIC                                 ===
    // =======================================================================

    /**
     * Tạo dữ liệu ngẫu nhiên cho tất cả các trường dựa trên bang đã chọn.
     */
    function generateAllRandomData() {
        const stateSelector = document.getElementById('a417-state-selector-for-random');
        const selectedState = stateSelector.value.toUpperCase().trim();
        if (!selectedState) {
            alert("Vui lòng chọn một tiểu bang.");
            stateSelector.focus();
            return;
        }
        a417_fields.state.value = selectedState;
        
        const iin = STATE_IIN_MAP[selectedState] || '636000';
        a417_fields.iin.value = iin;

        a417_fields.sex.value = Math.random() > 0.5 ? "1" : "2";
        fieldGenerators.generic.family_name();
        fieldGenerators.generic.first_name();
        fieldGenerators.generic.dob();
        fieldGenerators.generic.issue_date();

        const stateSpecificExpiryGenerator = fieldGenerators.specific[selectedState]?.expiry_date;
        if (stateSpecificExpiryGenerator) {
            stateSpecificExpiryGenerator();
        } else {
            fieldGenerators.generic.expiry_date();
        }
        
        const cityData = {
            AK: { cities: ["Anchorage", "Fairbanks", "Juneau"], zips: [99501, 99701, 99801]}, AL: { cities: ["Birmingham", "Montgomery", "Huntsville"], zips: [35203, 36104, 35801]},
            AR: { cities: ["Little Rock", "Fort Smith", "Fayetteville"], zips: [72201, 72901, 72701]}, AZ: { cities: ["Phoenix", "Tucson", "Mesa"], zips: [85001, 85701, 85201]},
            CA: { cities: ["Los Angeles", "San Diego", "San Jose"], zips: [90001, 92101, 95101]}, CO: { cities: ["Denver", "Colorado Springs", "Aurora"], zips: [80202, 80903, 80010]},
            CT: { cities: ["Bridgeport", "New Haven", "Hartford"], zips: [6604, 6510, 6103]}, DE: { cities: ["Wilmington", "Dover", "Newark"], zips: [19801, 19901, 19711]},
            FL: { cities: ["Jacksonville", "Miami", "Tampa"], zips: [32202, 33101, 33602]}, GA: { cities: ["Atlanta", "Augusta", "Columbus"], zips: [30303, 30901, 31901]}, 
            HI: { cities: ["Honolulu", "Pearl City", "Hilo"], zips: [96813, 96782, 96720]}, IA: { cities: ["Des Moines", "Cedar Rapids", "Davenport"], zips: [50309, 52401, 52801]},
            ID: { cities: ["Boise", "Meridian", "Nampa"], zips: [83702, 83642, 83651]},
            IL: { cities: ["Chicago", "Aurora", "Joliet"], zips: [60601, 60502, 60431]}, IN: { cities: ["Indianapolis", "Fort Wayne", "Evansville"], zips: [46204, 46802, 47708]},
            KS: { cities: ["Wichita", "Overland Park", "Kansas City"], zips: [67202, 66204, 66101]}, KY: { cities: ["Louisville", "Lexington", "Bowling Green"], zips: [40202, 40507, 42101]}, 
            LA: { cities: ["New Orleans", "Baton Rouge", "Shreveport"], zips: [70112, 70802, 71101]}, MA: { cities: ["Boston", "Worcester", "Springfield"], zips: [2108, 1602, 1103]},
            MD: { cities: ["Baltimore", "Columbia", "Germantown"], zips: [21201, 21044, 20874]}, ME: { cities: ["Portland", "Lewiston", "Bangor"], zips: [4101, 4240, 4401]}, 
            MI: { cities: ["Detroit", "Grand Rapids", "Warren"], zips: [48201, 49503, 48089]},
            MN: { cities: ["Minneapolis", "Saint Paul", "Rochester"], zips: [55401, 55101, 55901]}, MO: { cities: ["Kansas City", "Saint Louis", "Springfield"], zips: [64105, 63101, 65801]},
            MS: { cities: ["Jackson", "Gulfport", "Southaven"], zips: [39201, 39501, 38671]}, MT: { cities: ["Billings", "Missoula", "Great Falls"], zips: [59101, 59801, 59401]},
            NC: { cities: ["Charlotte", "Raleigh", "Greensboro"], zips: [28202, 27601, 27401]}, ND: { cities: ["Fargo", "Bismarck", "Grand Forks"], zips: [58102, 58501, 58201]},
            NE: { cities: ["Omaha", "Lincoln", "Bellevue"], zips: [68102, 68508, 68005]}, NH: { cities: ["Manchester", "Nashua", "Concord"], zips: [3101, 3060, 3301]},
            NJ: { cities: ["Newark", "Jersey City", "Paterson"], zips: [7102, 7302, 7501]}, NM: { cities: ["Albuquerque", "Las Cruces", "Rio Rancho"], zips: [87102, 88001, 87124]},
            NV: { cities: ["Las Vegas", "Henderson", "Reno"], zips: [89101, 89002, 89501]},
            NY: { cities: ["New York", "Buffalo", "Rochester"], zips: [10001, 14201, 14602]}, OH: { cities: ["Columbus", "Cleveland", "Cincinnati"], zips: [43215, 44101, 45202]},
            OK: { cities: ["Oklahoma City", "Tulsa", "Norman"], zips: [73102, 74103, 73019]}, OR: { cities: ["Portland", "Salem", "Eugene"], zips: [97201, 97301, 97401]}, 
            PA: { cities: ["Philadelphia", "Pittsburgh", "Allentown"], zips: [19102, 15219, 18101]}, RI: { cities: ["Providence", "Warwick", "Cranston"], zips: [2903, 2886, 2920]},
            SC: { cities: ["Charleston", "Columbia", "North Charleston"], zips: [29401, 29201, 29405]}, SD: { cities: ["Sioux Falls", "Rapid City", "Aberdeen"], zips: [57102, 57701, 57401]},
            TN: { cities: ["Nashville", "Memphis", "Knoxville"], zips: [37201, 38103, 37901]}, TX: { cities: ["Houston", "San Antonio", "Dallas"], zips: [77002, 78205, 75201]},
            UT: { cities: ["Salt Lake City", "West Valley City", "Provo"], zips: [84101, 84119, 84601]}, VA: { cities: ["Virginia Beach", "Norfolk", "Chesapeake"], zips: [23450, 23501, 23320]},
            VT: { cities: ["Burlington", "Essex", "South Burlington"], zips: [5401, 5452, 5403]}, WA: { cities: ["Seattle", "Spokane", "Tacoma"], zips: [98101, 99201, 98402]}, 
            WI: { cities: ["Milwaukee", "Madison", "Green Bay"], zips: [53202, 53703, 54301]},
            WV: { cities: ["Charleston", "Huntington", "Morgantown"], zips: [25301, 25701, 26501]}, WY: { cities: ["Cheyenne", "Casper", "Laramie"], zips: [82001, 82601, 82070]},
            DC: { cities: ["Washington"], zips: [20001, 20002, 20003] }
        };

        const currentCityData = cityData[selectedState] || { cities: ["Anytown"], zips: [12345]};
        const randomIndex = Math.floor(Math.random() * currentCityData.cities.length);
        
        a417_fields.street1.value = `${getRandomInt(100, 9999)} ${["Main St", "Oak Ave", "Pine Rd"][Math.floor(Math.random()*3)]}`;
        a417_fields.city.value = currentCityData.cities[randomIndex];
        a417_fields.postal_code.value = String(currentCityData.zips[randomIndex] + getRandomInt(0, 50)).padStart(5,'0');
        a417_fields.street2.value = ''; 
        
        a417_fields.height.value = `0${getRandomInt(60, 75)}`;
        a417_fields.weight_pounds.value = getRandomInt(120, 220).toString();
        
        const generationOrder = [
            'dob', 'family_name', 'first_name', 'customer_id', 'issue_date', 'expiry_date', 
            'inventory_control', 'document_discriminator', 'audit_info', 'issuing_office'
        ];

        generationOrder.forEach(fieldName => {
            if (a417_fields[fieldName]) {
                const generator = (fieldGenerators.specific[selectedState]?.[fieldName]) || fieldGenerators.generic[fieldName];
                if (generator) {
                    try {
                        generator();
                    } catch (e) {
                        console.warn(`Generator for ${fieldName} failed:`, e);
                    }
                }
            }
        });
        
        // Xóa và điền dữ liệu ZC
        Object.keys(a417_fields).filter(k => k.startsWith('zc')).forEach(k => a417_fields[k].value = '');
        if (['CA', 'FL'].includes(selectedState)) {
             a417_fields.zca_eye_color.value = a417_fields.eye_color.value;
             a417_fields.zcb_hair_color.value = a417_fields.hair_color.value;
             a417_fields.zcc_field.value = 'EXAMPLE-C';
             a417_fields.zcd_field.value = 'EXAMPLE-D';
        }
        
        alert(`Đã tạo dữ liệu ngẫu nhiên cho tiểu bang: ${selectedState}`);
    }

    /**
     * Lấy dữ liệu hiện tại từ các ô input trên form.
     */
    function getCurrentData() {
        const data = {};
        for(const name in a417_fields) { data[name] = a417_fields[name].value; }
        return data;
    }

    /**
     * Xử lý việc nhập dữ liệu từ file Excel.
     */
    function importFromExcel(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                if (jsonData.length === 0) { alert("No data found in Excel file."); return; }
                a417_all_records = [];
                a417_barcode_images = {};
                
                const excelMapping = {
                    'Family Name': 'family_name', 'First Name': 'first_name', 'Middle Name(s)': 'middle_name',
                    'Name Suffix': 'name_suffix', 'Date of Birth': 'dob', 'Expiration Date': 'expiry_date', 
                    'Issue Date': 'issue_date', 'ID Number': 'customer_id', 'Document Discriminator': 'document_discriminator',
                    'Country': 'country', 'Family Name Truncation': 'family_name_trunc', 'First Name Truncation': 'first_name_trunc',
                    'Middle Name Truncation': 'middle_name_trunc', 'Street 1': 'street1', 'Street 2': 'street2', 'City': 'city', 
                    'State': 'state', 'Postal Code': 'postal_code', 'Sex': 'sex', 'Eye Color': 'eye_color', 'Height': 'height', 
                    'Hair Color': 'hair_color', 'Race/Ethnicity': 'race', 'Weight (lbs)': 'weight_pounds', 'Weight (kg)': 'weight_kg', 
                    'Weight Range': 'weight_range', 'Vehicle Class': 'vehicle_class', 'Restrictions': 'restrictions', 'Endorsements': 'endorsements',
                    'Card Revision Date': 'card_revision_date', 'Organ Donor': 'organ_donor', 'Veteran': 'veteran', 'Compliance Type': 'compliance_type', 
                    'Limited Duration': 'limited_duration', 'HAZMAT Expiry': 'hazmat_expiry', 'Under 18 Until': 'under_18', 'Under 19 Until': 'under_19', 
                    'Under 21 Until': 'under_21', 'Standard Vehicle Classification': 'std_vehicle_class', 'Standard Restriction': 'std_restriction', 
                    'Standard Endorsement': 'std_endorsement', 'Inventory control': 'inventory_control', 'Audit Information': 'audit_info', 
                    'Place of Birth': 'place_of_birth', 'Issuing Office': 'issuing_office', 'Jurisdiction Eye Color (ZCA)': 'zca_eye_color',
                    'Jurisdiction Hair Color (ZCB)': 'zcb_hair_color', 'Jurisdiction Field C (ZCC)': 'zcc_field', 'Jurisdiction Field D (ZCD)': 'zcd_field',
                    'Jurisdiction Field E (ZCE)': 'zce_field', 'Jurisdiction Field F (ZCF)': 'zcf_field', 'Alias Family Name': 'alias_family', 
                    'Alias Given Name': 'alias_given', 'Alias Suffix Name': 'alias_suffix', 'IIN': 'iin', 'AAMVA Version': 'aamva_version', 
                    'Jurisdiction Version': 'jurisdiction_version', 'Filename': 'filename'
                };

                jsonData.forEach(row => {
                    let recordData = getCurrentData();
                     for (const excelHeader in excelMapping) {
                        const fieldName = excelMapping[excelHeader];
                        let value = row[excelHeader] !== undefined ? String(row[excelHeader]).trim() : undefined;
                        
                        if (value !== undefined) {
                            if (['Date of Birth', 'Expiration Date', 'Issue Date', 'Card Revision Date', 'HAZMAT Expiry', 'Under 18 Until', 'Under 19 Until', 'Under 21 Until'].includes(excelHeader)) {
                                if (value && !/^\d{8}$/.test(value)) { 
                                    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
                                    if (!isNaN(dt)) { value = getFormattedDate_MMDDYYYY(dt); }
                                }
                            } else if(fieldName === 'sex') {
                                const val_lower = value.toLowerCase();
                                if (['male', 'm', '1', 'nam'].includes(val_lower)) value = "1";
                                else if (['female', 'f', '2', 'nữ'].includes(val_lower)) value = "2";
                                else value = "9";
                            }
                            recordData[fieldName] = value;
                        }
                    }
                    a417_all_records.push(recordData);
                });
                generateAndDisplayAllBarcodes();
                alert(`Successfully imported and generated ${a417_all_records.length} barcodes!`);
            } catch (err) {
                console.error(err);
                alert("Error processing Excel file: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    /**
     * [PHIÊN BẢN CHUẨN] Hàm quan trọng nhất: Tạo chuỗi dữ liệu thô tuân thủ tiêu chuẩn AAMVA.
     * @param {object} record_data - Dữ liệu từ form hoặc file Excel.
     * @returns {object} - Chứa chuỗi dữ liệu cuối cùng và các thông tin header.
     */
    function generateAamvaDataString(record_data) {
        const LF = '\n'; 
        const CR = '\r'; 
        const RS = String.fromCharCode(30);
        
        const subfileDefinitions = {
            "DL": [
                ['DAQ', 'customer_id'], ['DCS', 'family_name'], ['DAC', 'first_name'], ['DAD', 'middle_name'],
                ['DBD', 'issue_date'], ['DBB', 'dob'], ['DBA', 'expiry_date'], ['DBC', 'sex'],
                ['DAY', 'eye_color'], ['DAU', 'height'], ['DAZ', 'hair_color'], ['DAG', 'street1'], 
                ['DAH', 'street2'], ['DAI', 'city'], ['DAJ', 'state'], ['DAK', 'postal_code'], 
                ['DCG', 'country'], ['DDE', 'family_name_trunc'], ['DDF', 'first_name_trunc'], 
                ['DDG', 'middle_name_trunc'], ['DCF', 'document_discriminator'], ['DCK', 'inventory_control'],
                ['DDA', 'compliance_type'], ['DDB', 'card_revision_date'], ['DCB', 'restrictions'], 
                ['DCD', 'endorsements'], ['DCA', 'vehicle_class'], ['DCM', 'std_vehicle_class'],
                ['DCO', 'std_restriction'], ['DCN', 'std_endorsement'], ['DDD', 'limited_duration'], 
                ['DDC', 'hazmat_expiry'], ['DAW', 'weight_pounds'], ['DAX', 'weight_kg'], 
                ['DCE', 'weight_range'], ['DCI', 'place_of_birth'], ['DCJ', 'audit_info'],
                ['DDH', 'under_18'], ['DDI', 'under_19'], ['DDJ', 'under_21'], ['DDK', 'organ_donor'], 
                ['DDL', 'veteran'], ['DBN', 'alias_family'], ['DBG', 'alias_given'], ['DBS', 'alias_suffix'],
                ['DCU', 'name_suffix'],
                ['IOE', 'issuing_office']
            ],
            "ZC": [
                ['ZCA', 'zca_eye_color'], ['ZCB', 'zcb_hair_color'], ['ZCC', 'zcc_field'],
                ['ZCD', 'zcd_field'], ['ZCE', 'zce_field'], ['ZCF', 'zcf_field']
            ]
        };

        const preamble = `@${LF}${RS}${CR}`;

        // Bước 1: Thu thập các subfile có dữ liệu
        let activeSubfiles = [];
        let dlLength = 0, zcLength = 0;
        
        for (const [type, elements] of Object.entries(subfileDefinitions)) {
            let parts = [];
            for (const [id, key] of elements) {
                let value = String(record_data[key] || '').trim();
                if (value) {
                    parts.push(id + value);
                }
            }
            
            if (parts.length > 0) {
                const subfileBody = parts.join(LF);
                const subfileDataBlock = type + subfileBody;
                
                activeSubfiles.push({
                    type: type,
                    dataBlock: subfileDataBlock,
                    length: subfileDataBlock.length
                });

                if(type === 'DL') dlLength = subfileDataBlock.length;
                if(type === 'ZC') zcLength = subfileDataBlock.length;
            }
        }
        
        const subfileCount = activeSubfiles.length;
        if (subfileCount === 0) {
            return { finalString: "@\n\u001e\rANSI \r", subfileCount: "00", dlLength: "0000", zcLength: "0000" };
        }

        // Bước 2: Tạo Header
        const fileHeader = `ANSI ${String(record_data.iin || '636000').padEnd(6, ' ')}` +
                         `${String(record_data.aamva_version || '10').padStart(2, '0')}` +
                         `${String(record_data.jurisdiction_version || '00').padStart(2, '0')}` +
                         `${String(subfileCount).padStart(2, '0')}`;
        
        // Bước 3: Tạo Thư mục (Directory) và Body tổng
        let directory = "";
        let fullBody = "";
        let currentOffset = preamble.length + fileHeader.length + (subfileCount * 10);

        activeSubfiles.forEach(sf => {
            directory += `${sf.type}${String(currentOffset).padStart(4, '0')}${String(sf.length).padStart(4, '0')}`;
            fullBody += sf.dataBlock;
            currentOffset += sf.length;
        });

        // Bước 4: Ghép tất cả lại và kết thúc bằng CR
        const finalString = preamble + fileHeader + directory + fullBody + CR;

        return {
            finalString: finalString,
            subfileCount: String(subfileCount).padStart(2, '0'),
            dlLength: String(dlLength).padStart(4, '0'),
            zcLength: String(zcLength).padStart(4, '0')
        };
    }
    
    /**
     * Tạo hình ảnh mã vạch từ chuỗi dữ liệu.
     */
    function generateBarcode(dataString, scale, padding) {
        const canvas = document.createElement('canvas');
        try {
            bwipjs.toCanvas(canvas, {
                bcid: 'pdf417', 
                text: dataString, 
                scale: scale,
                padding: padding, 
                columns: 13, 
                eclevel: 5
            });
            return canvas;
        } catch (e) {
            console.error("Barcode generation error:", e);
            const readableData = dataString.replace(/\u001e/g, ' <RS> ').replace(/\r/g, ' <CR>').replace(/\n/g, '<LF>\n');
            alert("Lỗi tạo mã vạch: " + e + "\n\nDữ liệu đã gửi:\n" + readableData);
            return null;
        }
    }

    /**
     * Tạo và hiển thị tất cả mã vạch cho các bản ghi đã được import/tạo.
     */
    function generateAndDisplayAllBarcodes() {
        const scale = parseInt(document.getElementById('a417-scale-input').value) || 4;
        const padding = parseInt(document.getElementById('a417-padding-input').value) || 10;
        
        a417_all_records.forEach((record, index) => {
            const generationResult = generateAamvaDataString(record);
            const canvas = generateBarcode(generationResult.finalString, scale, padding);
            a417_barcode_images[index] = canvas;
        });
        
        populateRecordsTable();
         if (a417_all_records.length > 0) {
            onRecordSelect(0); 
        }
    }
    
    /**
     * Điền dữ liệu vào bảng danh sách các bản ghi.
     */
    function populateRecordsTable() {
        recordsTableBody.innerHTML = '';
        a417_all_records.forEach((record, index) => {
            const fullName = `${record.first_name || ''} ${record.family_name || ''}`.trim();
            const filename = record.filename || record.customer_id || `record_${index}`;
            const tr = document.createElement('tr');
            tr.dataset.index = index;
            tr.innerHTML = `<td>${filename}.png</td><td>${fullName}</td>`;
            tr.addEventListener('click', () => onRecordSelect(index));
            recordsTableBody.appendChild(tr);
        });
    }
    
    /**
     * Xử lý sự kiện khi một bản ghi trong bảng được chọn.
     */
    function onRecordSelect(index) {
        // Chỉ cập nhật hiển thị, không thay đổi dữ liệu
        if (index < 0 || index >= a417_all_records.length) return;

        Array.from(recordsTableBody.children).forEach(row => row.classList.remove('selected'));
        const rowToSelect = recordsTableBody.querySelector(`[data-index='${index}']`);
        if (rowToSelect) {
            rowToSelect.classList.add('selected');
        }

        const recordData = a417_all_records[index];
        const canvas = a417_barcode_images[index];
        for(const name in a417_fields) {
            if(a417_fields[name] && recordData[name] !== undefined) {
                 a417_fields[name].value = recordData[name];
            }
        }
        
        if (canvas) {
            barcodePreview.innerHTML = '';
            const img = document.createElement('img');
            img.src = canvas.toDataURL();
            barcodePreview.appendChild(img);
        } else {
            barcodePreview.innerHTML = '<p>Error generating barcode for this record.</p>';
        }

        const generationResult = generateAamvaDataString(recordData);
        const dataString = generationResult.finalString;
        
        if (a417_fields.subfile_count) a417_fields.subfile_count.value = generationResult.subfileCount;
        if (a417_fields.dl_subfile_length) a417_fields.dl_subfile_length.value = generationResult.dlLength;
        if (a417_fields.jurisdiction_subfile_length) a417_fields.jurisdiction_subfile_length.value = generationResult.zcLength;

        displayFormattedData(recordData);
        
        const readableString = dataString
            .replace(/\u001e/g, ' <RS> ')
            .replace(/\r/g, ' <CR>')
            .replace(/\n/g, '<LF>\n');
        
        rawDataText.value = "RAW AAMVA DATA STRING:\n====================\n" + readableString;
    }

    /**
     * Hiển thị dữ liệu đã được định dạng một cách dễ đọc.
     */
   function displayFormattedData(data) {
        let text = `AAMVA 2020 DL/ID DATA\n====================\n`;
        text += `NAME: ${data.first_name || ''} ${data.middle_name || ''} ${data.family_name || ''}\n`;
        text += `ADDRESS: ${data.street1 || ''}, ${data.city || ''}, ${data.state || ''} ${data.postal_code || ''}\n`;
        text += `ID: ${data.customer_id || ''}\n`;
        text += `DOB: ${data.dob || ''}\n`;
        text += `SEX: ${data.sex === '1' ? 'Male' : (data.sex === '2' ? 'Female' : 'Unknown')}\n`;
        text += `HAIR: ${data.hair_color || ''}\n`;
        text += `EYES: ${data.eye_color || ''}\n`;
        text += `HEIGHT: ${data.height || ''}\n`;
        text += `ISS: ${data.issue_date || ''}\n`;
        text += `EXP: ${data.expiry_date || ''}\n`;
        text += `DD: ${data.document_discriminator || ''}\n`;
        text += `ICN: ${data.inventory_control || ''}\n`;
        
        let zc_text = '';
        if (data.zca_eye_color) zc_text += `ZCA: ${data.zca_eye_color}\n`;
        if (data.zcb_hair_color) zc_text += `ZCB: ${data.zcb_hair_color}\n`;
        if (data.zcc_field) zc_text += `ZCC: ${data.zcc_field}\n`;
        if (data.zcd_field) zc_text += `ZCD: ${data.zcd_field}\n`;
        if (data.zce_field) zc_text += `ZCE: ${data.zce_field}\n`;
        if (data.zcf_field) zc_text += `ZCF: ${data.zcf_field}\n`;

        if (zc_text) {
             text += "Jurisdiction Data:\n" + zc_text;
        }

        formattedDataText.value = text;
    }

    /**
     * Tạo mã vạch cho dữ liệu hiện tại trên form.
     */
      async function generateBarcodeForCurrentData() {
        try {
            const currentData = getCurrentData(); // Hàm này giữ nguyên
            const token = localStorage.getItem('authToken');

            const response = await fetch('/api/barcode/pdf417', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(currentData)
            });

            if (!response.ok) throw new Error((await response.json()).message);
            
            const generationResult = await response.json();
            const dataString = generationResult.finalString;
    
            const scale = parseInt(document.getElementById('a417-scale-input').value) || 4;
            const padding = parseInt(document.getElementById('a417-padding-input').value) || 10;
            const canvas = generateBarcode(dataString, scale, padding); // generateBarcode là hàm tạo canvas, giữ lại
    
            if(canvas) {
                // Thêm hoặc cập nhật bản ghi trong danh sách
                const selectedRow = recordsTableBody.querySelector('tr.selected');
                let newIndex = -1;
                if (selectedRow) {
                    const index = parseInt(selectedRow.dataset.index);
                    if (index >= 0 && index < a417_all_records.length) {
                        a417_all_records[index] = currentData;
                        a417_barcode_images[index] = canvas;
                        newIndex = index;
                    }
                } 
                
                if (newIndex === -1) {
                    a417_all_records.push(currentData);
                    newIndex = a417_all_records.length - 1;
                    a417_barcode_images[newIndex] = canvas;
                }
                
                populateRecordsTable();
                onRecordSelect(newIndex); // Chọn và hiển thị bản ghi vừa được tạo/cập nhật
    
            } else {
                alert("Failed to generate barcode.");
            }
        } catch (e) {
            alert("Error: " + e.message);
            console.error(e);
        }
    }
    
    /**
     * Xuất tất cả các mã vạch đã tạo ra thành file ảnh.
     */
   // js/pdf417-generator.js

// ... (giữ nguyên toàn bộ code của bạn cho đến hàm exportAllImages)

    /**
     * Xuất tất cả các mã vạch đã tạo ra thành file ảnh. (PHIÊN BẢN ĐÃ SỬA LỖI)
     */
    /**
 * Xuất tất cả các mã vạch đã tạo ra thành file ảnh. (PHIÊN BẢN CUỐI CÙNG)
 * - Ưu tiên chuẩn hóa chiều rộng để các mã vạch trông đồng đều và vừa khít.
 * - Vẫn giữ tùy chọn kích thước cố định cho các trường hợp đặc biệt.
 */
/**
 * Xuất tất cả các mã vạch đã tạo ra thành file ảnh. (PHIÊN BẢN ĐÃ SỬA LỖI VÀ GIA CỐ)
 * - Thêm kiểm tra sự tồn tại của các phần tử giao diện trước khi dùng.
 */
    /**
     * Xuất tất cả các mã vạch đã tạo ra thành file ảnh.
     * Triển khai ba chế độ:
     * 1. Normalize Width: Cùng chiều rộng, không méo. (An toàn)
     * 2. Fixed Canvas (Scale to Fit): Cùng kích thước, không méo, có nền trắng. (An toàn)
     * 3. Stretch to Fit (Force Size): Cùng kích thước, kéo dãn mã vạch để lấp đầy. (Rủi ro)
     */
    async function exportAllImages() {
        if (a417_all_records.length === 0) {
            alert("Không có dữ liệu để xuất. Vui lòng import hoặc tạo dữ liệu trước.");
            return;
        }

        let directoryHandle;
        try {
            directoryHandle = await window.showDirectoryPicker();
        } catch (err) {
            console.log("Người dùng đã hủy hộp thoại chọn thư mục.");
            return;
        }

        alert(`Bắt đầu xuất ${a417_all_records.length} ảnh. Vui lòng chờ...`);
        
        const exportMethod = document.querySelector('input[name="export-method"]:checked').value;
        
        // Lấy giá trị từ các input tương ứng
        const normalizeWidth = parseInt(document.getElementById('a417-normalize-width-input').value, 10);
        const fixedWidth = parseInt(document.getElementById('a417-fixed-width-input').value, 10);
        const fixedHeight = parseInt(document.getElementById('a417-fixed-height-input').value, 10);
        const stretchWidth = parseInt(document.getElementById('a417-stretch-width-input').value, 10);
        const stretchHeight = parseInt(document.getElementById('a417-stretch-height-input').value, 10);


        try {
            for (let i = 0; i < a417_all_records.length; i++) {
                const record = a417_all_records[i];
                const filename = `${record.filename || record.customer_id || `record_${i}`}.png`;
                  const token = localStorage.getItem('authToken'); // Lấy "vé vào cửa" để chứng minh đã đăng nhập
            const response = await fetch('/api/barcode/pdf417', {
                method: 'POST',           // Yêu cầu "tạo mới" một chuỗi dữ liệu
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Trình "vé vào cửa" cho server
                },
                body: JSON.stringify(record) // Gửi "nguyên liệu" (dữ liệu record) cho server
            });

            // Nếu server (nhà bếp) báo lỗi, bỏ qua món này và làm món tiếp theo
            if (!response.ok) {
                console.warn(`Lỗi từ server cho bản ghi ${i}, bỏ qua.`);
                continue;
            }

            // Nhận lại chuỗi dữ liệu đã được xử lý từ server
            const generationResult = await response.json(); 

                let canvasToSave;

                // Tạo một mã vạch gốc với chất lượng tốt để làm nguồn
                const sourceBarcodeCanvas = generateBarcode(generationResult.finalString, 10, 0); // Scale lớn để chất lượng cao
                if (!sourceBarcodeCanvas || sourceBarcodeCanvas.width === 0) {
                    console.warn(`Bỏ qua bản ghi ${i} (${filename}) do không thể tạo mã vạch nguồn.`);
                    continue;
                }

                if (exportMethod === 'stretch') {
                    // --- CHẾ ĐỘ 3: KÉO DÃN ĐỂ VỪA KHÍT (THEO YÊU CẦU) ---
                    if (!stretchWidth || stretchWidth <= 0 || !stretchHeight || stretchHeight <= 0) {
                        throw new Error("Force Width và Force Height phải là các số dương.");
                    }

                    // 1. Tạo canvas mới với kích thước bị ép buộc
                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = stretchWidth;
                    finalCanvas.height = stretchHeight;
                    const ctx = finalCanvas.getContext('2d');

                    // 2. Tắt làm mịn ảnh để các cạnh sắc nét hơn khi kéo dãn
                    ctx.imageSmoothingEnabled = false; 

                    // 3. Dùng drawImage để vẽ và KÉO DÃN mã vạch nguồn vào canvas mới
                    ctx.drawImage(sourceBarcodeCanvas, 0, 0, stretchWidth, stretchHeight);
                    
                    canvasToSave = finalCanvas;

                } else if (exportMethod === 'fixed') {
                    // --- CHẾ ĐỘ 2: CÙNG KÍCH THƯỚC CỐ ĐỊNH (KHÔNG MÉO) ---
                    if (!fixedWidth || fixedWidth <= 0 || !fixedHeight || fixedHeight <= 0) {
                        throw new Error("Fixed Width và Height phải là các số dương.");
                    }
                    const scaleX = fixedWidth / sourceBarcodeCanvas.width;
                    const scaleY = fixedHeight / sourceBarcodeCanvas.height;
                    const finalScale = Math.min(scaleX, scaleY);
                    
                    const scaledBarcodeWidth = sourceBarcodeCanvas.width * finalScale;
                    const scaledBarcodeHeight = sourceBarcodeCanvas.height * finalScale;

                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = fixedWidth;
                    finalCanvas.height = fixedHeight;
                    const ctx = finalCanvas.getContext('2d');
                    
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

                    const x = (finalCanvas.width - scaledBarcodeWidth) / 2;
                    const y = (finalCanvas.height - scaledBarcodeHeight) / 2;
                    
                    ctx.drawImage(sourceBarcodeCanvas, x, y, scaledBarcodeWidth, scaledBarcodeHeight);
                    
                    canvasToSave = finalCanvas;
                } else { // exportMethod === 'normalize'
                    // --- CHẾ ĐỘ 1: CÙNG CHIỀU RỘNG (KHÔNG MÉO) ---
                    if (!normalizeWidth || normalizeWidth <= 0) {
                        throw new Error("Target Width cho chế độ Normalize phải là một số dương.");
                    }
                    const requiredScale = normalizeWidth / sourceBarcodeCanvas.width;
                    const finalHeight = sourceBarcodeCanvas.height * requiredScale;

                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = normalizeWidth;
                    finalCanvas.height = finalHeight;
                    const ctx = finalCanvas.getContext('2d');
                    ctx.drawImage(sourceBarcodeCanvas, 0, 0, normalizeWidth, finalHeight);

                    canvasToSave = finalCanvas;
                }

                if (!canvasToSave) {
                    console.warn(`Không thể tạo canvas để lưu cho bản ghi ${i} (${filename}).`);
                    continue;
                }
                
                // Lưu file
                const blob = await new Promise(resolve => canvasToSave.toBlob(resolve, 'image/png'));
                const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            }

            alert(`Xuất thành công ${a417_all_records.length} ảnh vào thư mục đã chọn!`);

        } catch (e) {
            alert("Đã xảy ra lỗi trong quá trình xuất: " + e.message);
            console.error("Lỗi quá trình xuất:", e);
        }
    }

// ... (giữ nguyên phần code còn lại của bạn)
    
    // --- Khởi chạy ---
    buildFormAndControls();
}exportAllImages