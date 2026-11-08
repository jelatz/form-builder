/**
 * Converts any string into a clean, valid snake_case identifier suitable for
 * webhook keys, database column names, and CRM payload attributes.
 *
 * Examples:
 * - "First Name" -> "first_name"
 * - "Phone # (Mobile)" -> "phone_mobile"
 * - "What is your budget ($)?" -> "what_is_your_budget"
 * - "dealValue" -> "deal_value"
 */
export function toSnakeCase(str: string): string {
  return str
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
