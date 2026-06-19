const ASSERT_PREFIX = '[OmniCore] Assertion Failed:';
let enabled = false;

const ASSERT = {
  configure({ enabled: isEnabled = false } = {}) {
    enabled = Boolean(isEnabled);
    return this;
  },

  isEnabled() {
    return Boolean(enabled);
  },

  isDefined(value, variableName, options = {}) {
    if (!this.isEnabled()) return;
    if (value === undefined || value === null) {
      this._throw(variableName, options);
    }
  },

  isNumber(value, variableName, options = {}) {
    if (!this.isEnabled()) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this._throw(variableName, options);
    }
  },

  _throw(variableName = '变量', options = {}) {
    const reason = options.message || '值未通过断言';
    const message = `${ASSERT_PREFIX} ${variableName} at unknown:0 (${reason})`;
    const error = createAssertError(message, options);
    throw error;
  }
};

function createAssertError(message) {
  const error = Object.create(Error.prototype);
  error.name = 'OmniCoreAssertError';
  error.message = message;
  error.code = 'OMNICORE_ASSERTION';
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error);
  }
  return error;
}

export { ASSERT as Assert };
export default ASSERT;
