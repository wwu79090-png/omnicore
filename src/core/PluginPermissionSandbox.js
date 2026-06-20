import { createOmniError } from './OmniError.js';

export const PLUGIN_PERMISSION_SCOPES = Object.freeze([
  'events:emit',
  'events:on',
  'store:read',
  'store:write',
  'assets:read',
  'assets:write',
  'net:request',
  'payment:request',
  'ad:show',
  'editor:command',
  'file:read',
  'file:write',
  'storage:read',
  'storage:write'
]);

export class PluginPermissionSandbox {
  constructor({
    name = 'plugin',
    permissions = [],
    context = {}
  } = {}) {
    this.name = name;
    this.permissions = new Set(permissions);
    this.context = context;
    this.auditLog = [];
  }

  assert(scope, detail = {}) {
    if (!PLUGIN_PERMISSION_SCOPES.includes(scope)) {
      throw createOmniError('PluginSandbox', `Unsupported plugin permission scope: ${scope}`, {
        code: 'OMNICORE_PLUGIN_UNKNOWN_PERMISSION',
        category: 'plugin',
        details: { scope }
      });
    }
    const allowed = this.permissions.has(scope) || this.permissions.has(scope.split(':')[0]) || this.permissions.has('*');
    this.auditLog.push({
      scope,
      allowed,
      detail,
      at: Date.now()
    });
    if (!allowed) {
      throw createOmniError('PluginSandbox', `Plugin "${this.name}" missing permission: ${scope}`, {
        code: 'OMNICORE_PLUGIN_PERMISSION_DENIED',
        category: 'plugin',
        recoverable: true,
        details: { plugin: this.name, scope }
      });
    }
    return true;
  }

  createApi() {
    return Object.freeze({
      name: this.name,
      permissions: [...this.permissions],
      events: {
        emit: (event, payload) => {
          this.assert('events:emit', { event });
          return this.context.events?.emit?.(event, payload);
        },
        on: (event, handler) => {
          this.assert('events:on', { event });
          return this.context.events?.on?.(event, handler);
        }
      },
      store: {
        get: (key) => {
          this.assert('store:read', { key });
          return this.context.store?.get?.(key);
        },
        set: (key, value) => {
          this.assert('store:write', { key });
          return this.context.store?.set?.(key, value);
        }
      },
      net: {
        request: (...args) => {
          this.assert('net:request', { url: args[0] });
          return this.context.net?.request?.(...args);
        }
      },
      assets: {
        load: (...args) => {
          this.assert('assets:read', { key: args[0] });
          return this.context.assets?.load?.(...args);
        }
      },
      audit: () => this.snapshot()
    });
  }

  snapshot() {
    return {
      name: this.name,
      permissions: [...this.permissions].sort(),
      auditLog: this.auditLog.map((item) => ({ ...item }))
    };
  }
}

export default PluginPermissionSandbox;
