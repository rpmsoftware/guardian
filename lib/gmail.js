var fs = require('fs');
var readline = require('readline');
var { google } = require('googleapis');
var Promised        = require('promised-io/promise');
var Deferred        = Promised.Deferred;

// If modifying these scopes, delete token.json.
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = './config/gmail-token.json';

// Load client secrets from a local file.
async function getAuthInfo() {
    try {
        let credentials = process.env['GMAIL_CREDENTIALS'];
        if (credentials === undefined) {
            credentials = fs.readFileSync('./config/gmail-credentials.json');
        }
        return await authorize(JSON.parse(credentials));
    } catch(err) {
        console.log('Error loading client secret file:', err);
    };
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    try {
        let token = process.env['GMAIL_TOKEN'];
        if (token === undefined) {
            token = fs.readFileSync(TOKEN_PATH, {encoding: 'utf-8'});
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    } catch (err) {
        return await getNewToken(oAuth2Client);
    };
   
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const questionWait = new Deferred();
    let code ;
    rl.question('Enter the code from that page here: ', (answer => {
        code = answer;
        questionWait.resolve();
    }));
    await questionWait.promise;
    rl.close();

    try {
        const token = await oAuth2Client.getToken(code);
        // console.log('THE TOKEN', token);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token.tokens));
        console.log('Token stored to', TOKEN_PATH);
        return oAuth2Client;
    }catch (err) {
        return console.error('Error retrieving access token', err);
    };
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function getInboxEmails() {
    const auth = await getAuthInfo();
    const gmail = google.gmail({ version: 'v1', auth });
    let messagesList;
    try {
        messagesList = await gmail.users.messages.list(
        {
            userId: 'me',
            q: 'is:inbox'
        });
        messagesList = messagesList.data.messages || [];
    } catch(e) {
        console.log('The API returned an error: ', e);
        return null;
    };

    let emails = [];
    for (let messageIndex = 0; messageIndex < messagesList.length; messageIndex++) {
        const m = messagesList[messageIndex];
        try {
            const message = await gmail.users.messages.get({
                id: m.id,
                userId: 'me'
            });
            emails.push(message.data);
        } catch(e) {
            console.log('Failed to retrieve message', m, e);
        }
    }
    return emails;
}

async function archiveAndMarkEmailRead(messageID) {
    const auth = await getAuthInfo();
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.modify({
        id: messageID,
        userId: 'me',
        resource: {
            removeLabelIds: ['INBOX', 'UNREAD']
        }
    })
}

module.exports = {
    getInboxEmails: getInboxEmails,
    archiveAndMarkEmailRead: archiveAndMarkEmailRead
};