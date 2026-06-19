const IMAGE_EXT_PATTERN = /\.(png|jpg|jpeg|webp|gif|svg)$/i;
const PREFAB_PATTERN = /^assets\/prefabs\/.+\.json$/i;

export class AssetBrowser {
  constructor({
    entries = [],
    documentRef = globalThis.document,
    store = null,
    onSelect = null
  } = {}) {
    this.document = documentRef;
    this.store = store;
    this.onSelect = onSelect;
    this.entries = entries.map((entry) => normalizeEntry(entry));
    this.query = '';
    this.selected = null;
    this.root = null;
    this.list = null;
  }

  attach(container, options = {}) {
    if (!this.document || !container || this.root) return this;
    this.onSelect = options.onSelect || this.onSelect;
    this.root = this.document.createElement('section');
    this.root.dataset.editorAssetBrowser = 'true';
    this.root.innerHTML = `
      <div data-editor-asset-toolbar></div>
      <div data-editor-asset-list></div>
    `;
    container.appendChild(this.root);
    this._renderToolbar();
    this.list = this.root.querySelector('[data-editor-asset-list]');
    this.render();
    return this;
  }

  detach() {
    this.root?.remove?.();
    this.root = null;
    this.list = null;
    return this;
  }

  createFolder(parentPath = '', name = 'New Folder') {
    const cleanName = sanitizeSegment(name) || 'New Folder';
    const parent = normalizeFolderPath(parentPath);
    const folderPath = `${parent}${cleanName}/`;
    if (!this.entries.some((entry) => entry.path === folderPath)) {
      this.entries.push(normalizeEntry({ path: folderPath, type: 'folder' }));
    }
    this._sync();
    this.render();
    return this.get(folderPath);
  }

  renamePath(oldPath, newName) {
    const entry = this.get(oldPath);
    if (!entry) return null;
    const cleanName = sanitizeSegment(newName);
    if (!cleanName) return entry;

    const oldNormalized = entry.path;
    const directory = parentDirectory(oldNormalized);
    const nextPath = `${directory}${cleanName}${entry.type === 'folder' ? '/' : extensionSuffix(oldNormalized, cleanName)}`;
    const descendants = entry.type === 'folder'
      ? this.entries.filter((item) => item.path.startsWith(oldNormalized) && item.path !== oldNormalized)
      : [];
    entry.path = nextPath;
    entry.name = baseName(nextPath);

    for (const child of descendants) {
      child.path = child.path.replace(oldNormalized, nextPath);
    }
    this._sync();
    this.render();
    return entry;
  }

  search(query = '') {
    const needle = String(query).trim().toLowerCase();
    if (!needle) return [...this.entries];
    return this.entries.filter((entry) => (
      entry.path.toLowerCase().includes(needle)
      || entry.name.toLowerCase().includes(needle)
      || entry.type.toLowerCase().includes(needle)
    ));
  }

  get(path) {
    return this.entries.find((entry) => entry.path === normalizeEntry({ path }).path) || null;
  }

  select(pathOrEntry) {
    const entry = typeof pathOrEntry === 'string' ? this.get(pathOrEntry) : pathOrEntry;
    if (!entry) return null;
    this.selected = entry;
    this.store?.set?.('editor:selectedAsset', { ...entry });
    this.onSelect?.(entry);
    this.render();
    return entry;
  }

  toTree(entries = this.entries) {
    const root = { name: '', path: '', type: 'folder', children: {} };
    for (const entry of entries) {
      const clean = entry.path.replace(/\/$/u, '');
      const parts = clean.split('/').filter(Boolean);
      let node = root;
      let currentPath = '';
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLeaf = index === parts.length - 1;
        node.children[part] ||= {
          name: part,
          path: `${currentPath}${!isLeaf || entry.type === 'folder' ? '/' : ''}`,
          type: isLeaf && entry.type !== 'folder' ? 'file' : 'folder',
          assetType: isLeaf ? entry.type : 'folder',
          children: {}
        };
        if (isLeaf) {
          node.children[part] = {
            ...node.children[part],
            ...entry,
            type: entry.type === 'folder' ? 'folder' : 'file',
            assetType: entry.type,
            children: node.children[part].children || {}
          };
        }
        node = node.children[part];
      });
    }
    return root;
  }

  render() {
    if (!this.list || !this.document) return this;
    this.list.textContent = '';
    const matches = this.search(this.query);
    for (const entry of matches) {
      const row = this.document.createElement('button');
      row.type = 'button';
      row.draggable = true;
      row.dataset.editorAssetPath = entry.path;
      row.textContent = `${entry.type === 'folder' ? '▸' : assetIcon(entry)} ${entry.path}`;
      Object.assign(row.style, {
        display: 'block',
        width: '100%',
        marginBottom: '5px',
        padding: '6px',
        textAlign: 'left',
        color: '#e2e8f0',
        background: entry === this.selected ? 'rgba(34,211,238,0.22)' : 'rgba(15,23,42,0.58)',
        border: '1px solid rgba(148,163,184,0.32)',
        cursor: 'pointer'
      });
      row.addEventListener('click', () => this.select(entry));
      row.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/omnicore-asset-path', entry.path);
        event.dataTransfer?.setData('text/plain', entry.path);
      });
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const source = event.dataTransfer?.getData('application/omnicore-asset-path');
        const nextName = event.dataTransfer?.getData('application/omnicore-asset-new-name') || baseName(entry.path);
        if (source && source !== entry.path) this.renamePath(source, nextName);
      });
      this.list.appendChild(row);
    }
    this._sync();
    return this;
  }

  _renderToolbar() {
    const toolbar = this.root?.querySelector('[data-editor-asset-toolbar]');
    if (!toolbar || !this.document) return;
    toolbar.textContent = '';
    Object.assign(toolbar.style, { display: 'grid', gap: '6px', marginBottom: '8px' });

    const search = this.document.createElement('input');
    search.type = 'search';
    search.placeholder = '搜索资产';
    search.dataset.editorAssetSearch = 'true';
    Object.assign(search.style, inputStyle());
    search.addEventListener('input', () => {
      this.query = search.value;
      this.render();
    });

    const folder = this.document.createElement('button');
    folder.type = 'button';
    folder.textContent = '新建文件夹';
    folder.dataset.editorAssetNewFolder = 'true';
    Object.assign(folder.style, buttonStyle());
    folder.addEventListener('click', () => this.createFolder('assets', `folder-${Date.now().toString(36)}`));
    toolbar.append(search, folder);
  }

  _sync() {
    this.store?.set?.('editor:assets', this.entries.map((entry) => ({ ...entry })));
  }
}

function normalizeEntry(entry) {
  const source = typeof entry === 'string' ? { path: entry } : { ...entry };
  const path = slash(source.path || source.url || source.name || '').replace(/^\/+/u, '');
  const type = source.type || inferType(path);
  return {
    ...source,
    path: type === 'folder' ? normalizeFolderPath(path) : path,
    name: source.name || baseName(path),
    type
  };
}

function inferType(path) {
  if (path.endsWith('/')) return 'folder';
  if (PREFAB_PATTERN.test(path)) return 'prefab';
  if (IMAGE_EXT_PATTERN.test(path)) return 'image';
  return 'file';
}

function normalizeFolderPath(value = '') {
  const clean = slash(value).replace(/^\/+|\/+$/gu, '');
  return clean ? `${clean}/` : '';
}

function parentDirectory(path) {
  const clean = slash(path).replace(/\/$/u, '');
  const index = clean.lastIndexOf('/');
  return index >= 0 ? `${clean.slice(0, index + 1)}` : '';
}

function extensionSuffix(oldPath, newName) {
  if (/\.[^.]+$/u.test(newName)) return '';
  const match = oldPath.match(/(\.[^./]+)$/u);
  return match?.[1] || '';
}

function baseName(path) {
  const clean = slash(path).replace(/\/$/u, '');
  return clean.split('/').pop() || clean;
}

function sanitizeSegment(value) {
  return String(value || '').trim().replace(/[\\/]/gu, '-');
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

function assetIcon(entry) {
  if (entry.type === 'prefab') return '◇';
  if (entry.type === 'image') return '▣';
  return '•';
}

function inputStyle() {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px',
    color: '#e2e8f0',
    background: '#020617',
    border: '1px solid rgba(148,163,184,0.5)'
  };
}

function buttonStyle() {
  return {
    padding: '6px 8px',
    color: '#e2e8f0',
    background: '#0f172a',
    border: '1px solid rgba(56,189,248,0.8)',
    cursor: 'pointer'
  };
}

export default AssetBrowser;
