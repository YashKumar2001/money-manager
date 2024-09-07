const fs = require('fs').promises;
const path = require('path');
const process = require('process');

const INPUT_DIR = path.join(process.cwd(), 'output');
const OUTPUT_DIR = path.join(process.cwd(), 'results')
const { v4: uuidv4 } = require('uuid');

function extract_credit_card_txn(text) {
    // Regular expression to capture the desired parts
    const regex = /Rs\s([\d,.]+)\s+at\s+(.+?)\s+on\s+([\d-]+\s[\d:]+)/;

    // Apply the regex to the text
    const match = text.match(regex);

    if (match) {
        // Extract the values
        const amount = match[1];
        const merchant = match[2];
        const datetime = match[3];
        return {
            "amount": amount,
            "merchant": merchant,
            "datetime": datetime,
        }

    } else {
        return null;
    }
}

function extract_upi_txn(text) {
    const regex = /Rs\.(\d+\.\d+) has been debited from account \*\*(\d+) to (.*?) on (\d{2}-\d{2}-\d{2})/;
    const match = text.match(regex);
    if (match) {
        const amount = match[1];
        const merchant = match[3];
        const datetime = match[4];
        return {
            "amount": amount,
            "merchant": merchant,
            "datetime": datetime,
        }

    } else {
        return null;
    }
}

async function extractData() {
    try {
        let results = []
        // Read all files in the directory
        const files = await fs.readdir(INPUT_DIR);

        // Filter out text files
        const textFiles = files.filter(file => path.extname(file) === '.text');

        // Read each text file
        for (const file of textFiles) {
            const filePath = path.join(INPUT_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            const cur_data = extract_credit_card_txn(data);
            if (cur_data) results.push(cur_data);
            else {
                const cur_data = extract_upi_txn(data);
                if (cur_data) results.push(cur_data)
            }
        }
        console.log("results parsed: ", results.length)
        const filePath = path.join(OUTPUT_DIR, 'results.json');
        fs.writeFile(filePath, JSON.stringify(results))
    } catch (err) {
        console.error('Error:', err);
    }
}

module.exports = { extractData }