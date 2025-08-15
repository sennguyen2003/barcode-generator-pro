// backend/services/pdf417-service.js
// PHIÊN BẢN CHUẨN DÀNH CHO BACKEND - CHỈ CHỨA LOGIC XỬ LÝ

// --- Dữ liệu hằng số ---
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


// =======================================================================
// === SECTION: HÀM LOGIC CỐT LÕI                                      ===
// =======================================================================

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

    const fileHeader = `ANSI ${String(record_data.iin || '636000').padEnd(6, ' ')}` +
                     `${String(record_data.aamva_version || '10').padStart(2, '0')}` +
                     `${String(record_data.jurisdiction_version || '00').padStart(2, '0')}` +
                     `${String(subfileCount).padStart(2, '0')}`;
    
    let directory = "";
    let fullBody = "";
    let currentOffset = preamble.length + fileHeader.length + (subfileCount * 10);

    activeSubfiles.forEach(sf => {
        directory += `${sf.type}${String(currentOffset).padStart(4, '0')}${String(sf.length).padStart(4, '0')}`;
        fullBody += sf.dataBlock;
        currentOffset += sf.length;
    });

    const finalString = preamble + fileHeader + directory + fullBody + CR;

    return {
        finalString: finalString,
        subfileCount: String(subfileCount).padStart(2, '0'),
        dlLength: String(dlLength).padStart(4, '0'),
        zcLength: String(zcLength).padStart(4, '0')
    };
}


// =======================================================================
// === SECTION: EXPORT MODULE                                          ===
// =======================================================================

// Export duy nhất hàm cần thiết để API có thể sử dụng
module.exports = {
    generateAamvaDataString
};