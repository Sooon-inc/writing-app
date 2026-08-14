import { Readable } from "stream";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import * as ExcelJS from "exceljs";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const GOOGLE_API_TIMEOUT_MS = 60000;

export type DriveOutputType =
  | "meo"
  | "hp-strong"
  | "hp-classic"
  | "hp-beauty"
  | "hp-recruit"
  | "lp"
  | "portal";

export const DRIVE_ROOT_FOLDER_ID = "1mvLCkl37oJQBoQ0UqdvQ7h1YO4SOol2n";

const DRIVE_FOLDER_CONFIG: Record<DriveOutputType, { name: string; id: string }> = {
  meo: { name: "MEO", id: "18U890sUrU9-IdSvsNgJdtTKYtwEIAOoq" },
  "hp-strong": { name: "ストロング", id: "1b9zGU9n6wnVhLnoIlrerkBaiwT25uUzm" },
  "hp-classic": { name: "クラシック", id: "1Jyl5MtFadHhrticB4WCT5xW-KFGrxw3a" },
  "hp-beauty": { name: "ビューティー", id: "1eIiSWZQtjIygDNTiZt6ENMO180_4r85V" },
  "hp-recruit": { name: "リクルート", id: "1a8go47U00mHGtQlHTZSjNO_ZuRtAAMfg" },
  lp: { name: "LP", id: "1wUAFyvkTRWN22aL4tRwF1KM4U0zezIH6" },
  portal: { name: "ポータルサイト", id: "1lCOwGLBE1mamOFxM9GprMCp9sTgGwxQT" },
} as const;

export const DRIVE_FOLDER_IDS = Object.fromEntries(
  Object.entries(DRIVE_FOLDER_CONFIG).map(([type, config]) => [type, config.id])
) as Record<DriveOutputType, string>;

const folderResolutionPromises = new Map<DriveOutputType, Promise<string>>();

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateOutputFolder(
  auth: OAuth2Client,
  outputType: DriveOutputType
): Promise<string> {
  const drive = google.drive({ version: "v3", auth });
  const config = DRIVE_FOLDER_CONFIG[outputType];

  try {
    const metadata = await withTimeout(
      drive.files.get({
        fileId: config.id,
        fields: "id,mimeType,trashed,parents",
        supportsAllDrives: true,
      }),
      `Drive ${config.name} folder verification`
    );
    if (
      metadata.data.id
      && metadata.data.mimeType === "application/vnd.google-apps.folder"
      && !metadata.data.trashed
      && (metadata.data.parents ?? []).includes(DRIVE_ROOT_FOLDER_ID)
    ) {
      return metadata.data.id;
    }
  } catch (error) {
    console.warn(`[drive] configured ${config.name} folder is unavailable; searching under root:`, extractErrorMessage(error));
  }

  const escapedName = escapeDriveQueryValue(config.name);
  const escapedParent = escapeDriveQueryValue(DRIVE_ROOT_FOLDER_ID);
  const existing = await withTimeout(
    drive.files.list({
      q: `'${escapedParent}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name,createdTime)",
      orderBy: "createdTime",
      pageSize: 10,
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
    `Drive ${config.name} folder search`
  );
  const existingId = existing.data.files?.find((file) => file.id)?.id;
  if (existingId) return existingId;

  const created = await withTimeout(
    drive.files.create({
      requestBody: {
        name: config.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [DRIVE_ROOT_FOLDER_ID],
      },
      fields: "id",
      supportsAllDrives: true,
    }),
    `Drive ${config.name} folder creation`
  );
  if (!created.data.id) throw new Error(`${config.name}フォルダの作成結果からIDを取得できませんでした`);
  return created.data.id;
}

export function resolveDriveOutputFolder(
  auth: OAuth2Client,
  outputType: DriveOutputType
): Promise<string> {
  const cached = folderResolutionPromises.get(outputType);
  if (cached) return cached;

  const resolving = findOrCreateOutputFolder(auth, outputType).catch((error) => {
    folderResolutionPromises.delete(outputType);
    throw error;
  });
  folderResolutionPromises.set(outputType, resolving);
  return resolving;
}

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
  outputType: DriveOutputType
): Promise<{ id: string; webViewLink: string; warning?: string }> {
  const drive = google.drive({ version: "v3", auth });
  const buf = toBuffer(buffer);
  const folderId = await resolveDriveOutputFolder(auth, outputType);
  const folderName = DRIVE_FOLDER_CONFIG[outputType].name;

  let lastError: unknown;
  let uploadedFile: { id: string; webViewLink: string } | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Drive files.create attempt ${attempt} started:`, name, `folder=${folderName}`);
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
    let warning: string | undefined;
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
        warning = "Google Sheets APIが無効なため、チェックボックスを復元できませんでした。Google Cloudプロジェクト 913052066974 でGoogle Sheets APIを有効にしてから、再度出力してください。";
        console.warn(
          "Sheets API is disabled. The spreadsheet was created, but checkbox restore was skipped."
        );
      } else {
        warning = `チェックボックスの復元に失敗しました: ${msg}`;
        console.warn(
          "The spreadsheet was created, but checkbox restore was skipped due to an error."
        );
      }
    }
    return { ...uploadedFile, warning };
  }

  const message = extractErrorMessage(lastError);
  if (message.includes("File not found") || message.includes("insufficient")) {
    throw new Error("指定したGoogleドライブのフォルダへ保存できません。Google連携をやり直し、フォルダへのアクセス権を確認してください。");
  }
  throw new Error(message);
}
