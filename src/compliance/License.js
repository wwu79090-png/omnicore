/**
 * Commercial license hook placeholder.
 *
 * The default validator is permissive so open-source runtime behavior remains
 * unchanged. Commercial builds can inject a strict validator later.
 */
export const License = {
  validator: null,

  /**
   * @param {Function|null} validator License validator.
   * @returns {typeof License} License facade.
   */
  configure(validator) {
    this.validator = typeof validator === 'function' ? validator : null;
    return this;
  },

  /**
   * @param {object} context Validation context.
   * @returns {{ok: boolean, reason: string|null}} Validation result.
   */
  verify(context = {}) {
    if (!this.validator) return { ok: true, reason: null };
    const result = this.validator(context);
    if (result === true) return { ok: true, reason: null };
    if (result && typeof result === 'object') return { ok: Boolean(result.ok), reason: result.reason || null };
    return { ok: false, reason: 'license-denied' };
  }
};

export default License;
