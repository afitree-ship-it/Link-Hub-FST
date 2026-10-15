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

  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A1:J?valueInputOption=USER_ENTERED`, {
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

export const normalizeLink = (raw: any, existingLink?: Link): Link => {
  const rawAud = String(raw.targetAudience || (raw.isStaffOnly ? 'staff' : (raw[4] !== undefined ? raw[4] : 'both'))).trim().toLowerCase();
  let targetAudience: 'both' | 'student' | 'staff' = 'both';
  if (rawAud === 'staff' || rawAud === 'yes' || rawAud === 'true' || rawAud === 'บุคลากร') {
    targetAudience = 'staff';
  } else if (rawAud === 'student' || rawAud === 'นักศึกษา') {
    targetAudience = 'student';
  } else {
    targetAudience = 'both';
  }

  // Normalize Category (university | faculty)
  const rawCat = String(raw.category !== undefined ? raw.category : (raw[9] !== undefined ? raw[9] : '')).trim().toLowerCase();
  let category: 'university' | 'faculty' = 'faculty';
  if (rawCat === 'university' || rawCat === 'uni' || rawCat === 'มหาวิทยาลัย') {
    category = 'university';
  } else if (rawCat === 'faculty' || rawCat === 'fac' || rawCat === 'คณะวิทยาศาสตร์' || rawCat === 'คณะ') {
    category = 'faculty';
  } else if (existingLink && existingLink.category) {
    // If incoming data from Google Sheet did not specify a category, PRESERVE the existing local category!
    category = existingLink.category;
  } else {
    // Intelligent fallback based on URL or title
    const textToCheck = `${raw.url || raw[2] || ''} ${raw.title || raw[1] || ''}`.toLowerCase();
    if (
      textToCheck.includes('scitech') ||
      textToCheck.includes('คณะวิทยาศาสตร์') ||
      textToCheck.includes('คณะฯ') ||
      textToCheck.includes('petition.') ||
      textToCheck.includes('fst') ||
      textToCheck.includes('wise')
    ) {
      category = 'faculty';
    } else {
      category = 'university';
    }
  }

  return {
    id: String(
      raw.id ||
      raw[0] ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `link-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
    ),
    title: String(raw.title !== undefined ? raw.title : (raw[1] || '')),
    url: String(raw.url !== undefined ? raw.url : (raw[2] || '')),
    description: String(raw.description !== undefined ? raw.description : (raw[3] || '')),
    targetAudience,
    category,
    order: raw.order !== undefined ? Number(raw.order) : (existingLink?.order !== undefined ? existingLink.order : undefined),
    isStaffOnly: targetAudience === 'staff',
    clickCount: parseInt(raw.clickCount !== undefined ? raw.clickCount : (raw[5] || '0'), 10) || 0,
    createdAt: String(raw.createdAt || raw[6] || new Date().toISOString()),
    thumbnailUrl: String(raw.thumbnailUrl !== undefined ? raw.thumbnailUrl : (raw[7] || '')),
    isPinned: raw.isPinned === true || raw.isPinned === 'Yes' || raw[8] === 'Yes' || raw[8] === true,
    isMaintenance: raw.isMaintenance === true || raw.isMaintenance === 'Yes' || raw.isMaintenance === 'true' || raw[10] === 'Yes' || raw[10] === true || raw[10] === 'true' || (existingLink?.isMaintenance ?? false),
    maintenanceNote: String(raw.maintenanceNote !== undefined ? raw.maintenanceNote : (raw[11] !== undefined ? raw[11] : (existingLink?.maintenanceNote || ''))),
  };
};

export const syncLinksToGoogleSheet = async (spreadsheetId: string, links: Link[]) => {
  const headers = ['ID', 'Title', 'URL', 'Description', 'Target Audience', 'Click Count', 'Created At', 'Thumbnail URL', 'Is Pinned', 'Category', 'Is Maintenance', 'Maintenance Note'];
  const rows = links.map(link => {
    const audienceValue = link.targetAudience === 'staff' ? 'Staff' : (link.targetAudience === 'student' ? 'Student' : (link.isStaffOnly ? 'Staff' : 'Both'));
    const categoryValue = link.category === 'university' ? 'University' : 'Faculty';
    return [
      link.id,
      link.title,
      link.url,
      link.description || '',
      audienceValue,
      link.clickCount.toString(),
      link.createdAt,
      link.thumbnailUrl || '',
      link.isPinned ? 'Yes' : 'No',
      categoryValue,
      link.isMaintenance ? 'Yes' : 'No',
      link.maintenanceNote || ''
    ];
  });

  await updateSheetData(spreadsheetId, [headers, ...rows]);
};

// Apps Script Web App used by every visitor unless an admin overrides it
export const DEFAULT_GAS_URL =
  ((import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL as string) ||
  'https://script.google.com/macros/s/AKfycbxY-fNkxvzWl-v_OxRW2mLJNiityRyqmz9La03u3p65yUyP0AueIl9b33iJvVPibJ5ouQ/exec';

// How long after a local write the poller ignores sheet data that may predate it
export const WRITE_SETTLE_MS = 15000;

let lastWriteAt = 0;
export const getLastWriteAt = () => lastWriteAt;

export const sendActionToWebApp = async (url: string, action: string, data: any = {}, auth?: AuthCredentials) => {
  if (action !== 'incrementClick') lastWriteAt = Date.now();
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
  } finally {
    if (action !== 'incrementClick') lastWriteAt = Date.now();
  }
};

export const syncViaWebApp = async (url: string, links: any[], auth?: AuthCredentials) => {
  return sendActionToWebApp(url, 'sync', { links }, auth);
};

export const syncAllViaWebApp = async (url: string, links: any[], settings?: any, admins?: any[]) => {
  return sendActionToWebApp(url, 'sync', { links, settings, admins });
};

export const fetchFromWebApp = async (url: string): Promise<{ success: boolean; data?: any[]; settings?: any; error?: string }> => {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    if (Array.isArray(json)) {
      return { success: true, data: json };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to connect to Web App' };
  }
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

  const response = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A2:J`, {
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

  return rows.map((row: any[]) => normalizeLink(row));
};
