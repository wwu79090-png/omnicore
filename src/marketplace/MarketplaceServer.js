export class MarketplaceServer {
  constructor({ encryptionKey = 'omnicore' } = {}) {
    this.encryptionKey = encryptionKey;
    this.plugins = new Map();
    this.comments = new Map();
    this.sponsorships = new Map();
  }

  uploadPlugin(plugin) {
    const approved = { ...plugin, status: plugin.status || 'approved' };
    this.plugins.set(plugin.name, approved);
    if (!this.comments.has(plugin.name)) this.comments.set(plugin.name, []);
    return approved;
  }

  submitPlugin(plugin) {
    const securityReview = this.validatePluginManifest(plugin);
    if (!securityReview.ok) {
      const blocked = {
        ...plugin,
        status: 'blocked',
        submittedAt: plugin.submittedAt || new Date().toISOString(),
        reviews: [],
        securityReview
      };
      this.plugins.set(plugin.name, blocked);
      if (!this.comments.has(plugin.name)) this.comments.set(plugin.name, []);
      return blocked;
    }
    const submitted = {
      ...plugin,
      status: 'pending_review',
      submittedAt: plugin.submittedAt || new Date().toISOString(),
      reviews: [],
      securityReview
    };
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

function encodePayload(value) {
  if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('base64');
  return btoa(value);
}

export default MarketplaceServer;
