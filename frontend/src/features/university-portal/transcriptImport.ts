import type { Grade } from '../../types';

const EXPECTED_HEADERS = ['Course Name', 'Credits', 'Score', 'Semester'] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_COURSES = 500;

type RawCell = string | number | boolean | null | undefined;

const parseCsvRows = (text: string): RawCell[][] => {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  const normalized = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '"') {
      if (quoted && normalized[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && normalized[index + 1] === '\n') index += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('The CSV contains an unterminated quoted value.');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const readExcelRows = async (file: File): Promise<RawCell[][]> => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('The workbook does not contain a worksheet.');
  const rows: RawCell[][] = [];
  worksheet.eachRow({ includeEmpty: false }, currentRow => {
    const values: RawCell[] = [];
    for (let column = 1; column <= EXPECTED_HEADERS.length; column += 1) {
      const source = currentRow.getCell(column).value;
      if (source && typeof source === 'object' && 'formula' in source) throw new Error(`Row ${currentRow.number} contains a formula. Replace formulas with plain values.`);
      if (source && typeof source === 'object' && 'richText' in source) values.push(source.richText.map(item => item.text).join(''));
      else if (source instanceof Date || (source && typeof source === 'object')) values.push(String(source));
      else values.push(source);
    }
    rows.push(values);
  });
  return rows;
};

const validateRows = (rows: RawCell[][]): Grade[] => {
  if (!rows.length) throw new Error('The uploaded file is empty.');
  const headers = rows[0].map(value => String(value ?? '').trim().toLowerCase());
  const expected = EXPECTED_HEADERS.map(value => value.toLowerCase());
  if (expected.some((header, index) => headers[index] !== header))
    throw new Error(`The first row must use this exact sequence: ${EXPECTED_HEADERS.join(', ')}.`);

  const dataRows = rows.slice(1).filter(row => row.some(value => String(value ?? '').trim()));
  if (!dataRows.length) throw new Error('The file contains headers but no transcript courses.');
  if (dataRows.length > MAX_COURSES) throw new Error(`A transcript import cannot exceed ${MAX_COURSES} courses.`);

  const errors: string[] = [];
  const grades = dataRows.map((row, index) => {
    const rowNumber = index + 2;
    const subjectName = String(row[0] ?? '').trim();
    const creditHours = String(row[1] ?? '').trim();
    const score = Number(String(row[2] ?? '').trim());
    const semesterNumber = Number(String(row[3] ?? '').trim());
    if (!subjectName) errors.push(`row ${rowNumber}: Course Name is required`);
    else if (subjectName.length > 200) errors.push(`row ${rowNumber}: Course Name exceeds 200 characters`);
    if (!creditHours) errors.push(`row ${rowNumber}: Credits is required`);
    else if (creditHours.length > 8) errors.push(`row ${rowNumber}: Credits exceeds 8 characters`);
    if (!Number.isInteger(score) || score < 0 || score > 100) errors.push(`row ${rowNumber}: Score must be a whole number from 0 to 100`);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 16) errors.push(`row ${rowNumber}: Semester must be a whole number from 1 to 16`);
    return { subjectName, creditHours, score, semesterNumber };
  });
  if (errors.length) {
    const visible = errors.slice(0, 8).join('; ');
    throw new Error(`${visible}${errors.length > 8 ? `; and ${errors.length - 8} more error(s)` : ''}.`);
  }
  return grades;
};

export async function importTranscript(file: File): Promise<Grade[]> {
  if (file.size > MAX_FILE_BYTES) throw new Error('The transcript file must be 5 MB or smaller.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'csv' && extension !== 'xlsx') throw new Error('Choose an .xlsx or .csv transcript file.');
  const rows = extension === 'csv' ? parseCsvRows(await file.text()) : await readExcelRows(file);
  return validateRows(rows);
}

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
};

export async function downloadTranscriptTemplate(format: 'xlsx' | 'csv') {
  const sample = [EXPECTED_HEADERS, ['Introduction to Computing', 3, 87, 1], ['Academic English', 2, 91, 1]];
  if (format === 'csv') {
    saveBlob(new Blob([sample.map(row => row.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'AfghanVerify-Transcript-Template.csv');
    return;
  }
  const { Workbook } = await import('exceljs'); const workbook = new Workbook(); const worksheet = workbook.addWorksheet('Transcript');
  worksheet.addRows(sample); worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  worksheet.columns = [{ width: 38 }, { width: 12 }, { width: 12 }, { width: 12 }]; worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'AfghanVerify-Transcript-Template.xlsx');
}
