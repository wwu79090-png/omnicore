import DataTable from './DataTable.js';

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

export class DataTableEditor {
  constructor({ store = null } = {}) {
    this.store = store;
    this.rows = [];
    this.versions = [];
    this.nextVersion = 1;
  }

  importCSV(csv, options = {}) {
    this.rows = DataTable.parseCSV(csv, options);
    this._sync();
    return this.rows;
  }

  importRows(rows = []) {
    this.rows = cloneRows(rows);
    this._sync();
    return this.rows;
  }

  commitVersion(message = 'snapshot') {
    const version = {
      id: `v${this.nextVersion}`,
      message,
      rows: cloneRows(this.rows),
      createdAt: new Date().toISOString()
    };
    this.nextVersion += 1;
    this.versions.push(version);
    return version;
  }

  rollback(versionId) {
    const version = this.versions.find((item) => item.id === versionId);
    if (!version) return null;
    this.rows = cloneRows(version.rows);
    this._sync();
    return this.rows;
  }

  exportJSON() {
    return cloneRows(this.rows);
  }

  _sync() {
    this.store?.set?.('editor:dataTable', this.exportJSON());
  }
}

export default DataTableEditor;
