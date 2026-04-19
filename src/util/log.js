/**
 * @module 工具/日志
 */

/**
 * 统一格式化日志与输出消息作用域。
 * @param {string} scope
 * @param {string} message
 * @returns {string}
 */
export function formatScopedMessage(scope, message) {
    const normalizedScope = String(scope ?? "").trim();
    const normalizedMessage = String(message ?? "");
    if (!normalizedScope) return normalizedMessage;

    const prefix = `[${normalizedScope}]:`;
    return normalizedMessage.startsWith(prefix)
        ? normalizedMessage
        : `${prefix}${normalizedMessage}`;
}