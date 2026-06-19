export class MarketplaceServer {
  constructor({ encryptionKey = 'omnicore' } = {}) {
    this.encryptionKey = encryptionKey;
    this.plugins = new Map();
    this.comments = new Map();
    this.sponsorships = new Map();
  }

  uploadPlugin(plugin) {
    const approved = normalizeMarketplacePlugin({ ...plugin, status: plugin.status || 'approved' });
    this.plugins.set(plugin.name, approved);
    if (!this.comments.has(plugin.name)) this.comments.set(plugin.name, []);
    return approved;
  }

  submitPlugin(plugin) {
    const securityReview = this.validatePluginManifest(plugin);
    if (!securityReview.ok) {
      const blocked = normalizeMarketplacePlugin({
        ...plugin,
        status: 'blocked',
        submittedAt: plugin.submittedAt || new Date().toISOString(),
        reviews: [],
        securityReview
      });
      this.plugins.set(plugin.name, blocked);
      if (!this.comments.has(plugin.name)) this.comments.set(plugin.name, []);
      return blocked;
    }
    const submitted = normalizeMarketplacePlugin({
      ...plugin,
      status: 'pending_review',
      submittedAt: plugin.submittedAt || new Date().toISOString(),
      reviews: [],
      securityReview
    });
    this.plugins.set(plugin.name, submitted);
    if (!this.comments.has(plugin.name)) this.comments.set(plugin.name, []);
    return submitted;
  }

  reviewPlugin(name, { reviewerId, approved = false, notes = '' } = {}) {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;
    const review = {
      reviewerId,
      approved: Boolean(approved),
      notes,
      reviewedAt: new Date().toISOString()
    };
    plugin.status = approved ? 'approved' : 'rejected';
    plugin.reviews = [...(plugin.reviews || []), review];
    this.plugins.set(name, plugin);
    return plugin;
  }

  publishPluginUpdate(name, update = {}) {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.status !== 'approved') return null;
    const previousVersion = plugin.version;
    const entry = {
      version: update.version || plugin.version,
      changelog: update.changelog || '',
      publishedAt: update.publishedAt || new Date().toISOString()
    };
    const updated = normalizeMarketplacePlugin({
      ...plugin,
      ...update,
      name: plugin.name,
      version: entry.version,
      status: 'approved',
      updateHistory: [...(plugin.updateHistory || []), { ...entry, previousVersion }],
      updatedAt: entry.publishedAt
    });
    this.plugins.set(name, updated);
    return updated;
  }

  searchPlugins(query = '', filters = {}) {
    const needle = String(query || '').trim().toLowerCase();
    return this.listPlugins()
      .filter((plugin) => filters.isPaid == null || Boolean(plugin.isPaid) === Boolean(filters.isPaid))
      .filter((plugin) => {
        if (!needle) return true;
        const haystack = [
          plugin.name,
          plugin.displayName,
          plugin.publisher,
          plugin.summary,
          ...(plugin.categories || [])
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      })
      .map((plugin) => this.toStoreCard(plugin));
  }

  getPluginDetail(nameOrSlug) {
    const plugin = this.findPlugin(nameOrSlug);
    if (!plugin || plugin.status !== 'approved') return null;
    return {
      ...this.toStoreCard(plugin),
      detailPage: `website/marketplace/${slugForPlugin(plugin.name)}/index.html`,
      comments: this.getComments(plugin.name),
      updateHistory: [...(plugin.updateHistory || [])],
      packageName: plugin.packageName,
      main: plugin.main,
      license: plugin.license
    };
  }

  createInstallJob(nameOrSlug, options = {}) {
    const plugin = this.findPlugin(nameOrSlug);
    if (!plugin || plugin.status !== 'approved') return null;
    const slug = slugForPlugin(plugin.name);
    const version = options.version || plugin.version;
    return {
      id: `install-${slug}-${Date.now().toString(36)}`,
      plugin: plugin.name,
      version,
      command: `omni install ${slug}`,
      addonDir: `addons/${slug}`,
      source: plugin.source || (plugin.packageName ? `npm:${plugin.packageName}` : null),
      isPaid: Boolean(plugin.isPaid),
      status: 'queued',
      updateChannel: options.updateChannel || 'stable',
      createdAt: new Date().toISOString()
    };
  }

  getAvailableUpdates(installed = []) {
    return (Array.isArray(installed) ? installed : [])
      .map((entry) => {
        const plugin = this.findPlugin(entry.name);
        if (!plugin || plugin.status !== 'approved') return null;
        if (compareVersions(plugin.version, entry.version) <= 0) return null;
        return {
          name: plugin.name,
          currentVersion: entry.version,
          latestVersion: plugin.version,
          command: `omni install ${slugForPlugin(plugin.name)} --version ${plugin.version}`,
          changelog: plugin.updateHistory?.at(-1)?.changelog || ''
        };
      })
      .filter(Boolean);
  }

  generateListing(name) {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.status !== 'approved') return null;
    const slug = slugForPlugin(plugin.name);
    const isPaid = Boolean(plugin.isPaid || Number(plugin.priceCents || 0) > 0);
    return {
      slug,
      name: plugin.name,
      displayName: plugin.displayName || plugin.name,
      version: plugin.version,
      developerId: plugin.developerId,
      packageName: plugin.packageName,
      detailPage: `website/marketplace/${slug}/index.html`,
      installCommand: `omni install ${slug}`,
      isPaid,
      priceCents: Number(plugin.priceCents || 0),
      downloadCount: Number(plugin.downloadCount || 0),
      publisher: plugin.publisher,
      engineVersion: plugin.engineVersion,
      media: plugin.media,
      comments: this.getComments(plugin.name)
    };
  }

  validatePluginManifest(plugin = {}) {
    const errors = [];
    const warnings = [];
    if (!plugin.name) errors.push({ code: 'missing-name', message: 'Plugin name is required.' });
    if (!plugin.version) errors.push({ code: 'missing-version', message: 'Plugin version is required.' });
    if (!plugin.developerId) errors.push({ code: 'missing-developer', message: 'Developer id is required.' });
    if (!plugin.license) warnings.push({ code: 'missing-license', message: 'Plugin should declare a license.' });
    if (plugin.packageName && !String(plugin.packageName).startsWith('@omnicore/')) {
      warnings.push({ code: 'non-omnicore-scope', message: 'Official plugins should use the @omnicore npm scope.' });
    }
    for (const [name, command] of Object.entries(plugin.scripts || {})) {
      if (/install|prepare|prepublish/iu.test(name) && isDangerousLifecycleScript(command)) {
        errors.push({
          code: 'dangerous-lifecycle-script',
          script: name,
          message: `${name} uses network shell execution.`
        });
      }
    }
    return {
      ok: errors.length === 0,
      errors,
      warnings
    };
  }

  listPlugins({ includePending = false } = {}) {
    return [...this.plugins.values()].filter((plugin) => includePending || plugin.status === 'approved');
  }

  findPlugin(nameOrSlug) {
    if (this.plugins.has(nameOrSlug)) return this.plugins.get(nameOrSlug);
    const slug = slugForPlugin(nameOrSlug);
    return [...this.plugins.values()].find((plugin) => slugForPlugin(plugin.name) === slug) || null;
  }

  toStoreCard(plugin) {
    const slug = slugForPlugin(plugin.name);
    return {
      name: plugin.name,
      slug,
      displayName: plugin.displayName || plugin.name,
      publisher: plugin.publisher || plugin.author || plugin.developerId,
      version: plugin.version,
      engineVersion: plugin.engineVersion || '>=0.1.0',
      summary: plugin.summary || '',
      media: normalizePluginMedia(plugin.media),
      installCommand: `omni install ${slug}`,
      isPaid: Boolean(plugin.isPaid),
      priceCents: Number(plugin.priceCents || 0),
      downloadCount: Number(plugin.downloadCount || 0),
      status: plugin.status
    };
  }

  addComment(name, { userId, body } = {}) {
    if (!this.comments.has(name)) this.comments.set(name, []);
    const comment = {
      userId,
      body,
      status: 'pending_review',
      createdAt: new Date().toISOString()
    };
    this.comments.get(name).push(comment);
    return comment;
  }

  moderateComment(name, index, { moderatorId, approved = false } = {}) {
    const comment = this.comments.get(name)?.[index];
    if (!comment) return null;
    comment.status = approved ? 'approved' : 'rejected';
    comment.moderatorId = moderatorId;
    comment.moderatedAt = new Date().toISOString();
    return comment;
  }

  getComments(name, { includePending = false } = {}) {
    return (this.comments.get(name) || []).filter((comment) => includePending || comment.status === 'approved');
  }

  sponsor(developerId, { sponsorId, amountCents = 0, tier = 'supporter' } = {}) {
    if (!this.sponsorships.has(developerId)) this.sponsorships.set(developerId, []);
    const sponsorship = {
      developerId,
      sponsorId,
      amountCents: Math.max(0, Math.round(Number(amountCents || 0))),
      tier,
      createdAt: new Date().toISOString()
    };
    this.sponsorships.get(developerId).push(sponsorship);
    return sponsorship;
  }

  getSponsorSummary(developerId) {
    const entries = this.sponsorships.get(developerId) || [];
    return {
      developerId,
      sponsors: new Set(entries.map((entry) => entry.sponsorId)).size,
      totalCents: entries.reduce((total, entry) => total + entry.amountCents, 0),
      tiers: entries.reduce((counts, entry) => {
        counts[entry.tier] = (counts[entry.tier] || 0) + 1;
        return counts;
      }, {})
    };
  }

  downloadPaid(name, { buyerId, paid = false } = {}) {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.status !== 'approved' || !paid) return null;
    return {
      encrypted: true,
      buyerId,
      payload: encodePayload(`${this.encryptionKey}:${plugin.packageData}:${buyerId}`),
      split: {
        developerId: plugin.developerId,
        developerCents: Math.round(plugin.priceCents * 0.7),
        platformCents: plugin.priceCents - Math.round(plugin.priceCents * 0.7)
      }
    };
  }
}

function isDangerousLifecycleScript(command = '') {
  return /\b(curl|wget|iwr|Invoke-WebRequest)\b/iu.test(command)
    && /(\|\s*(bash|sh|powershell|pwsh|node)|\b(bash|sh|powershell|pwsh)\b\s+-c)/iu.test(command);
}

function normalizeMarketplacePlugin(plugin = {}) {
  return {
    ...plugin,
    displayName: plugin.displayName || plugin.name,
    publisher: plugin.publisher || plugin.author || plugin.developerId || 'Unknown publisher',
    engineVersion: plugin.engineVersion || plugin.supportedEngineVersion || '>=0.1.0',
    media: normalizePluginMedia(plugin.media),
    updateHistory: Array.isArray(plugin.updateHistory) ? plugin.updateHistory : [],
    downloadCount: Number(plugin.downloadCount || 0),
    isPaid: Boolean(plugin.isPaid)
  };
}

function normalizePluginMedia(media = {}) {
  return {
    screenshots: Array.isArray(media.screenshots) ? media.screenshots : [],
    videos: Array.isArray(media.videos) ? media.videos : []
  };
}

function compareVersions(left = '0.0.0', right = '0.0.0') {
  const leftParts = String(left).split(/[.-]/u).map((part) => Number(part) || 0);
  const rightParts = String(right).split(/[.-]/u).map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function slugForPlugin(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/^@omnicore\//u, '')
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function encodePayload(value) {
  if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('base64');
  return btoa(value);
}

export default MarketplaceServer;
