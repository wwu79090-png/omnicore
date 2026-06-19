/**
 * CSV data parser for small gameplay tables.
 *
 * @example
 * const table = DataTable.fromCSV('id,hp\nhero,10');
 * table.find('id', 'hero').hp; // "10"
 */
export class DataTable {
  constructor(rows = []) {
    this.rows = rows;
  }

  static fromCSV(csv, options = {}) {
    return new DataTable(DataTable.parseCSV(csv, options));
  }

  static parseCSV(csv, { headers = true, delimiter = ',' } = {}) {
    const lines = String(csv)
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    if (!lines.length) return [];
    const parsed = lines.map((line) => DataTable._split(line, delimiter));
    if (!headers) return parsed;
    const [head, ...body] = parsed;
    return body.map((row) => Object.fromEntries(head.map((key, index) => [key, row[index] ?? ''])));
  }

  static _split(line, delimiter) {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) {
        cells.push(cell);
        cell = '';
      } else cell += char;
    }
    cells.push(cell);
    return cells;
  }

  find(key, value) {
    return this.rows.find((row) => row[key] === value);
  }
}

export default DataTable;
