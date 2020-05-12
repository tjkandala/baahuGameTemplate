/**
 * cute fetch wrapper for readability
 *
 * you don't need to type http or parse json
 */
export function http<T>(url: string): Promise<T> {
  return fetch(`http://${url}`)
    .then((response) => response.json())
    .then((result: T) => result);
}
