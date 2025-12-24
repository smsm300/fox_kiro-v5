/**
 * Sanitize a string to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeHTML(str: string | undefined | null): string {
    if (!str) return '';

    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return String(str).replace(/[&<>"'`=/]/g, (char) => map[char] || char);
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const result = { ...obj };

    for (const key in result) {
        if (typeof result[key] === 'string') {
            result[key] = sanitizeHTML(result[key]) as any;
        } else if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = sanitizeObject(result[key]);
        }
    }

    return result;
}

/**
 * Create a safe URL string (prevent javascript: urls)
 */
export function sanitizeURL(url: string | undefined | null): string {
    if (!url) return '';

    const trimmed = url.trim().toLowerCase();

    // Block dangerous protocols
    if (trimmed.startsWith('javascript:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('vbscript:')) {
        return '';
    }

    return url;
}

export default { sanitizeHTML, sanitizeObject, sanitizeURL };
