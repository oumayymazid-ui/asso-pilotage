import { google } from "googleapis"

export const SPREADSHEET_ID = "1bOISBPwoU1xa5R4Um0fRASXKFeclJ8jB3A3CUHBMlI8"

export function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  return google.sheets({ version: "v4", auth })
}

// Dossier Drive "fiches-inscription" (partagé avec le compte de service)
export const FICHES_FOLDER_ID = "1E5KdJqdbkrnjJEMtk2NpW-1RJdB28SOX"

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  return google.drive({ version: "v3", auth })
}

/** Supprime un fichier Drive (best-effort : peut échouer si le compte de service n'en est pas propriétaire). */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.files.delete({ fileId, supportsAllDrives: true })
}

/** Upload un fichier (base64) dans un dossier Drive donné. Renvoie le lien Drive. */
export async function uploadToDrive(
  nom: string,
  mimeType: string,
  base64: string,
  folderId: string = FICHES_FOLDER_ID
): Promise<{ fileId: string; url: string }> {
  const drive = getDriveClient()
  const { Readable } = await import("stream")
  const buffer = Buffer.from(base64, "base64")
  const res = await drive.files.create({
    requestBody: { name: nom, parents: [folderId] },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  })
  return { fileId: res.data.id ?? "", url: res.data.webViewLink ?? "" }
}

// ── Helpers génériques ────────────────────────────────────

type Sheets = ReturnType<typeof google.sheets>

export async function sheetToObjects(
  sheets: Sheets,
  sheetName: string
): Promise<Record<string, unknown>[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  })
  const rows = res.data.values ?? []
  if (rows.length < 2) return []
  const headers = rows[0] as string[]
  return rows
    .slice(1)
    .map((row) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((h, i) => { obj[h] = row[i] ?? "" })
      return obj
    })
    .filter((obj) => obj[headers[0]] !== "" && obj[headers[0]] !== null && obj[headers[0]] !== undefined)
}

export async function getHeaders(sheets: Sheets, sheetName: string): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  })
  return (res.data.values?.[0] as string[]) ?? []
}

/** Ajoute une colonne (en-tête) à la feuille si elle n'existe pas encore. */
export async function ensureColumn(
  sheets: Sheets,
  sheetName: string,
  columnName: string
): Promise<void> {
  const headers = await getHeaders(sheets, sheetName)
  if (headers.includes(columnName)) return
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${colLetter(headers.length + 1)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [[columnName]] },
  })
}

export async function appendRow(
  sheets: Sheets,
  sheetName: string,
  obj: Record<string, unknown>
): Promise<void> {
  const headers = await getHeaders(sheets, sheetName)
  const row = headers.map((h) => (obj[h] !== undefined ? String(obj[h]) : ""))
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  })
}

export async function updateRowById(
  sheets: Sheets,
  sheetName: string,
  idValue: string | number,
  mapping: Record<string, unknown>
): Promise<boolean> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  })
  const rows = res.data.values ?? []
  if (rows.length < 2) return false
  const headers = rows[0] as string[]
  const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(idValue))
  if (rowIndex < 0) return false

  const requests = Object.entries(mapping)
    .map(([h, val]) => {
      const colIndex = headers.indexOf(h)
      if (colIndex < 0) return null
      const rangeA1 = `${sheetName}!${colLetter(colIndex + 1)}${rowIndex + 1}`
      return sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeA1,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[val ?? ""]] },
      })
    })
    .filter(Boolean)

  await Promise.all(requests)
  return true
}

export async function deleteRowById(
  sheets: Sheets,
  sheetName: string,
  idValue: string | number
): Promise<boolean> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  })
  const rows = res.data.values ?? []
  const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(idValue))
  if (rowIndex < 0) return false

  // Récupère l'ID de la feuille pour batchUpdate
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName)
  if (!sheet?.properties?.sheetId) return false

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  })
  return true
}

export async function nextId(sheets: Sheets, sheetName: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  })
  const col = res.data.values ?? []
  let max = 0
  col.slice(1).forEach((r) => {
    const v = Number(r[0])
    if (!isNaN(v) && v > max) max = v
  })
  return max + 1
}

export async function deleteRowsWhere(
  sheets: Sheets,
  sheetName: string,
  headerName: string,
  values: string[]
): Promise<number> {
  if (!values.length) return 0
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  })
  const rows = res.data.values ?? []
  if (rows.length < 2) return 0
  const headers = rows[0] as string[]
  const col = headers.indexOf(headerName)
  if (col < 0) return 0

  const toDelete: number[] = []
  rows.forEach((row, i) => {
    if (i === 0) return
    if (values.includes(String(row[col]))) toDelete.push(i)
  })
  if (!toDelete.length) return 0

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName)
  if (!sheet?.properties?.sheetId) return 0

  const sortedDesc = [...toDelete].sort((a, b) => b - a)
  const requests = sortedDesc.map((rowIndex) => ({
    deleteDimension: {
      range: {
        sheetId: sheet.properties!.sheetId,
        dimension: "ROWS",
        startIndex: rowIndex,
        endIndex: rowIndex + 1,
      },
    },
  }))

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  })
  return toDelete.length
}

export function parseDateFr(s: string): string {
  if (!s) return ""
  const parts = String(s).split("/")
  if (parts.length !== 3) return s
  const [d, m, y] = parts.map(Number)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return s
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export function fmtDate(v: unknown): string {
  if (!v) return ""
  return String(v)
}

function colLetter(n: number): string {
  let s = ""
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
