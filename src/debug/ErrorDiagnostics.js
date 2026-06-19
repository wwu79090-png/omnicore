import KnowledgeBaseDiagnostics from './KnowledgeBaseDiagnostics.js';

/**
 * Friendly diagnostics for common developer errors.
 */
export class ErrorDiagnostics {
  static analyze(error) {
    const message = error?.message || String(error || '');
    const knowledgeMatch = KnowledgeBaseDiagnostics.analyze(message);
    if (knowledgeMatch) return knowledgeMatch;

    if (/Store\b.*type mismatch|type mismatch\b.*Store/i.test(message)) {
      const reference = message.match(/\b(?:[A-Za-z]:)?[^:\s]+\.js:\d+(?::\d+)?/u)?.[0] || '';
      return {
        title: 'Store 状态类型不匹配',
        message: 'Store 中同一个 key 在运行期间写入了不同类型的值。',
        solution: '保持状态类型稳定，或为不同结构拆分独立 Store key 后再写入。',
        reference,
        intent: '状态写入前检查 schema，避免热更新或事件流把对象、数组、数字等类型混用。',
        docs: 'docs/DX.md#store-状态类型不匹配'
      };
    }
    if (/Cannot read properties of undefined|undefined \(reading/i.test(message)) {
      return {
        title: '对象未初始化',
        message: '请确认 Scene 或 Entity 已创建，并在调用 add、set、render 等方法前完成初始化。',
        docs: 'docs/DX.md#对象未初始化'
      };
    }
    if (/failed to fetch|404|failed to load resource/i.test(message)) {
      return {
        title: '资源路径不可用',
        message: '请检查资源路径、asset-manifest.json 和本地开发服务器是否可访问。',
        docs: 'docs/DX.md#资源路径不可用'
      };
    }
    return {
      title: '运行时错误',
      message: message || '发生未知错误，请查看控制台堆栈和 OmniCore 调试面板。',
      docs: 'docs/DX.md#运行时错误'
    };
  }
}

export default ErrorDiagnostics;
