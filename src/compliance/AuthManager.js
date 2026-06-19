/**
 * Real-name authentication hook facade.
 *
 * OmniCore does not implement a jurisdiction-specific identity provider. Games
 * install a hook and the engine calls it consistently across platforms.
 *
 * @example
 * OmniCore.System.Auth.setHook(async (profile) => provider.verify(profile));
 * const result = await OmniCore.System.Auth.verify({ playerId: 'u1' });
 */
export class AuthManager {
  constructor() {
    this.hook = async () => ({ ok: true, provider: 'none' });
  }

  setHook(hook) {
    this.hook = hook;
  }

  async verify(payload) {
    return this.hook(payload);
  }
}

export default AuthManager;
