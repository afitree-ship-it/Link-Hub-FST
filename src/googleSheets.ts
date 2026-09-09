import { Link, AuthCredentials } from './types';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const fetchToken = async (): Promise<string | null> => {
  return null;
};

export const createGoogleSheet = async (title: string): Promise<string> => {
  const token = await fetchToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'Links',
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create spreadsheet');
  }

  const data = await response.json();
  
  // Set up header row
  await updateSheetData(data.spreadsheetId, [
    ['ID', 'Title', 'URL', 'Description', 'Is Staff Only', 'Click Count', 'Created At', 'Thumbnail URL', 'Is Pinned']
  ]);

  return data.spreadsheetId;
};

export const updateSheetData = async (spreadsheetId: string, values: any[][]) => {
  const token = await fetchToken();
  if (!token) throw new Error('Not authenticated');

  // Fetch spreadsheet metadata to get the first sheet's title
  const metaResponse = await fetch(`${SHEETS_API}/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!metaResponse.ok) {
    const errData = await metaResponse.json().catch(() => ({}));
    throw new Error(`Failed to access spreadsheet: ${errData.error?.message || metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const firstSheetTitle = metaData.sheets[0]?.properties?.title || 'Sheet1';

  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A1:I?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('Google Sheets API Error:', errData);
    throw new Error(`Failed to update spreadsheet data: ${errData.error?.message || response.statusText}`);
  }
};

export const syncLinksToGoogleSheet = async (spreadsheetId: string, links: Link[]) => {
  const headers = ['ID', 'Title', 'URL', 'Description', 'Is Staff Only', 'Click Count', 'Created At', 'Thumbnail URL', 'Is Pinned'];
  const rows = links.map(link => [
    link.id,
    link.title,
    link.url,
    link.description || '',
    link.isStaffOnly ? 'Yes' : 'No',
    link.clickCount.toString(),
    link.createdAt,
    link.thumbnailUrl || '',
    link.isPinned ? 'Yes' : 'No'
  ]);

  await updateSheetData(spreadsheetId, [headers, ...rows]);
};

export const sendActionToWebApp = async (url: string, action: string, data: any = {}, auth?: AuthCredentials) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain', // Using text/plain avoids CORS preflight issues
      },
      body: JSON.stringify({
        action: action,
        auth: auth,
        ...data,
      }),
    });
    // no-cors means response is opaque, we can't reliably read response.ok
  } catch (error) {
    console.warn(`Failed to execute ${action} via Web App:`, error);
  }
};

export const syncViaWebApp = async (url: string, links: any[], auth?: AuthCredentials) => {
  return sendActionToWebApp(url, 'sync', { links }, auth);
};

export const saveSettingsViaWebApp = async (url: string, settings: any, auth?: AuthCredentials) => {
  return sendActionToWebApp(url, 'saveSettings', { settings }, auth);
};

export const incrementClickViaWebApp = async (url: string, id: string) => {
  return sendActionToWebApp(url, 'incrementClick', { id });
};

export const addAdminViaWebApp = async (url: string, admin: any, auth: AuthCredentials) => {
  return sendActionToWebApp(url, 'saveAdmin', { admin }, auth);
};

export const deleteAdminViaWebApp = async (url: string, username: string, auth: AuthCredentials) => {
  return sendActionToWebApp(url, 'deleteAdmin', { username }, auth);
};

export const updatePersonalPinsViaWebApp = async (url: string, pinnedLinks: string[], auth: AuthCredentials) => {
  return sendActionToWebApp(url, 'updatePins', { pinnedLinks }, auth);
};

export const loadLinksFromGoogleSheet = async (spreadsheetId: string): Promise<Link[]> => {
  const token = await fetchToken();

  // Fetch spreadsheet metadata to get the first sheet's title
  const metaResponse = await fetch(`${SHEETS_API}/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!metaResponse.ok) {
    const errData = await metaResponse.json().catch(() => ({}));
    throw new Error(`Failed to access spreadsheet: ${errData.error?.message || metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const firstSheetTitle = metaData.sheets[0]?.properties?.title || 'Sheet1';

  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A2:I`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('Google Sheets API Error:', errData);
    throw new Error(`Failed to fetch spreadsheet data: ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows.map((row: any[]) => ({
    id: row[0] || crypto.randomUUID(),
    title: row[1] || '',
    url: row[2] || '',
    description: row[3] || '',
    isStaffOnly: row[4] === 'Yes',
    clickCount: parseInt(row[5] || '0', 10) || 0,
    createdAt: row[6] || new Date().toISOString(),
    thumbnailUrl: row[7] || '',
    isPinned: row[8] === 'Yes',
  }));
};
