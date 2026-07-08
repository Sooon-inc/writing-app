import { Readable } from "stream";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import * as ExcelJS from "exceljs";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const GOOGLE_API_TIMEOUT_MS = 60000;

export const DRIVE_FOLDER_IDS = {
  hp: process.env.GOOGLE_DRIVE_FOLDER_HP ?? "1k3YnO6CO1NUPkgBcbN5Z3aSjZ0-q0pkb",
  meo: process.env.GOOGLE_DRIVE_FOLDER_MEO ?? "1B-veMXX_kjUPrPcK1wyFplj7Bv1fDeZT",
  lp: process.env.GOOGLE_DRIVE_FOLDER_LP ?? "1gMItUDqvRScTRMGVeu-WVSvO6Hf1uxwu",
  portal: process.env.GOOGLE_DRIVE_FOLDER_PORTAL ?? "1HkEJyt5RQdFqeKxjQOFzccx8ZpsJme89",
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    // HTML レスポンスが含まれている場合は省略
    const msg = e.message;
    if (msg.startsWith("<!") || msg.startsWith("<html")) {
      return "Google側の一時的なエラーです（502）。再度お試しください。";
    }
    return msg;
  }
  return String(e);
}

function isSheetsApiDisabledError(message: string): boolean {
  return (
    message.includes("Google Sheets API has not been used") ||
    message.includes("sheets.googleapis.com") ||
    message.includes("SERVICE_DISABLED") ||
    message.includes("accessNotConfigured")
  );
}

async function makeFileShareableReadOnly(auth: OAuth2Client, fileId: string) {
  const drive = google.drive({ version: "v3", auth });
  await withTimeout(
    drive.permissions.create({
      fileId,
      requestBody: {
        type: "anyone",
        role: "reader",
      },
      fields: "id",
      supportsAllDrives: true,
    }),
    "Drive share permission"
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = GOOGLE_API_TIMEOUT_MS
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

type CheckboxRange = {
  sheetName: string;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
};

function toBuffer(buffer: Buffer | ArrayBuffer): Buffer {
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

async function extractBooleanCellRanges(buffer: Buffer): Promise<CheckboxRange[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const ranges: CheckboxRange[] = [];
  for (const sheet of workbook.worksheets) {
    const rowSegments: CheckboxRange[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const booleanColumns: number[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (typeof cell.value === "boolean") {
          booleanColumns.push(colNumber);
        }
      });

      if (booleanColumns.length === 0) return;
      booleanColumns.sort((a, b) => a - b);

      let startColumn = booleanColumns[0];
      let previousColumn = booleanColumns[0];
      for (let index = 1; index < booleanColumns.length; index += 1) {
        const currentColumn = booleanColumns[index];
        if (currentColumn === previousColumn + 1) {
          previousColumn = currentColumn;
          continue;
        }

        rowSegments.push({
          sheetName: sheet.name,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: startColumn - 1,
          endColumnIndex: previousColumn,
        });

        startColumn = currentColumn;
        previousColumn = currentColumn;
      }

      rowSegments.push({
        sheetName: sheet.name,
        startRowIndex: rowNumber - 1,
        endRowIndex: rowNumber,
        startColumnIndex: startColumn - 1,
        endColumnIndex: previousColumn,
      });
    });

    // 同じ列範囲が縦に連続している場合は1つのGridRangeにまとめる。
    for (const segment of rowSegments) {
      const previous = ranges[ranges.length - 1];
      if (
        previous &&
        previous.sheetName === segment.sheetName &&
        previous.endRowIndex === segment.startRowIndex &&
        previous.startColumnIndex === segment.startColumnIndex &&
        previous.endColumnIndex === segment.endColumnIndex
      ) {
        previous.endRowIndex = segment.endRowIndex;
      } else {
        ranges.push({ ...segment });
      }
    }
  }

  return ranges;
}

async function applyCheckboxesToSpreadsheet(
  auth: OAuth2Client,
  spreadsheetId: string,
  buffer: Buffer
): Promise<void> {
  const checkboxRanges = await extractBooleanCellRanges(buffer);
  if (checkboxRanges.length === 0) return;

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await withTimeout(
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    }),
    "Sheets metadata fetch"
  );

  const sheetIdByName = new Map<string, number>();
  for (const sheet of spreadsheet.data.sheets ?? []) {
    const title = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    if (title && sheetId != null) sheetIdByName.set(title, sheetId);
  }

  const requests = checkboxRanges.flatMap((range) => {
    const sheetId = sheetIdByName.get(range.sheetName);
    if (sheetId == null) return [];
    return [{
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: range.startRowIndex,
          endRowIndex: range.endRowIndex,
          startColumnIndex: range.startColumnIndex,
          endColumnIndex: range.endColumnIndex,
        },
        cell: {
          dataValidation: {
            condition: { type: "BOOLEAN" },
            strict: true,
            showCustomUi: true,
          },
        },
        fields: "dataValidation",
      },
    }];
  });

  if (requests.length === 0) return;

  for (let index = 0; index < requests.length; index += 500) {
    await withTimeout(
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: requests.slice(index, index + 500),
        },
      }),
      "Sheets checkbox restore"
    );
  }
}

export async function uploadToGoogleSheets(
  auth: OAuth2Client,
  name: string,
  buffer: Buffer | ArrayBuffer,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = google.drive({ version: "v3", auth });
  const buf = toBuffer(buffer);

  let lastError: unknown;
  let uploadedFile: { id: string; webViewLink: string } | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Drive files.create attempt ${attempt} started:`, name);
      const file = await withTimeout(
        drive.files.create({
          requestBody: {
            name,
            mimeType: "application/vnd.google-apps.spreadsheet",
            parents: [folderId],
          },
          media: {
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            body: Readable.from(buf),
          },
          fields: "id,webViewLink",
          supportsAllDrives: true,
        }),
        "Drive file creation"
      );

      const id = file.data.id;
      const webViewLink = file.data.webViewLink;
      if (!id || !webViewLink) throw new Error("Drive APIからIDが返されませんでした");

      console.log("Drive files.create succeeded:", id);
      uploadedFile = { id, webViewLink };
      break;
    } catch (e) {
      lastError = e;
      const msg = extractErrorMessage(e);
      console.error(`Drive files.create attempt ${attempt} failed:`, msg);

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  if (uploadedFile) {
    try {
      console.log("Drive share permission started:", uploadedFile.id);
      await makeFileShareableReadOnly(auth, uploadedFile.id);
      console.log("Drive share permission completed:", uploadedFile.id);
    } catch (e) {
      const msg = extractErrorMessage(e);
      console.warn(
        "The spreadsheet was created, but link sharing could not be enabled:",
        msg
      );
    }

    try {
      console.log("Sheets checkbox restore started:", uploadedFile.id);
      await applyCheckboxesToSpreadsheet(auth, uploadedFile.id, buf);
      console.log("Sheets checkbox restore completed:", uploadedFile.id);
    } catch (e) {
      const msg = extractErrorMessage(e);
      console.error("Sheets checkbox restore failed:", msg);
      if (isSheetsApiDisabledError(msg)) {
        console.warn(
          "Sheets API is disabled. The spreadsheet was created, but checkbox restore was skipped."
        );
      } else {
        console.warn(
          "The spreadsheet was created, but checkbox restore was skipped due to an error."
        );
      }
    }
    return uploadedFile;
  }

  const message = extractErrorMessage(lastError);
  if (message.includes("File not found") || message.includes("insufficient")) {
    throw new Error("指定したGoogleドライブのフォルダへ保存できません。Google連携をやり直し、フォルダへのアクセス権を確認してください。");
  }
  throw new Error(message);
}
