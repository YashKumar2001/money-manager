const fs = require('fs').promises;
const fsSync = require('fs')
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { Buffer } = require('buffer');
const { extractData } = require('./email_data_extractor')

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

function decodeBase64(base64String) {
    // Step 1: Create a Buffer from the Base64 string
    const buffer = Buffer.from(base64String, 'base64');

    // Step 2: Convert the Buffer to a UTF-8 string
    const utf8String = buffer.toString('utf8');

    return utf8String;
}

async function parseAllMessages(message_id, data) {
    const partId = data.partId
    if (data.body.data) {
        const message = data.body.data;
        const decoded_message = decodeBase64(message.replace(/-/g, '+').replace(/_/g, '/'));
        const file_path = path.join(process.cwd(), 'output', `${message_id}_${partId}.text`);
        const file_path_html = path.join(process.cwd(), 'output', `${message_id}_${partId}.html`);
        fs.writeFile(file_path, decoded_message)
        fs.writeFile(file_path_html, decoded_message)
    }
    if (data.parts) {
        data.parts.forEach((message_part) => {
            parseAllMessages(message_id, message_part)
        })
    }
}

async function listMails(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 500,
        q: 'from:alerts@hdfcbank.net '
    });
    const message_ids = res.data.messages
    for (const id_obj of message_ids) {
        const message_id = id_obj.id
        console.log("id", message_id);
        const message_data = await gmail.users.messages.get({
            userId: 'me',
            id: message_id
        });
        parseAllMessages(message_id, message_data.data.payload)
    };
    await extractData()
}

function main() {
    fsSync.rmSync('output', { recursive: true, force: true });
    fsSync.mkdirSync('output');
    authorize().then(listMails).catch(console.error);
}

main();