/**
 * EduBridge Adaptive - Error Handler
 * Re-exports from centralized errorParser for seamless backward compatibility.
 */
import { parseApiError, getFriendlyErrorMessage } from './errorParser';

export { parseApiError, getFriendlyErrorMessage };

export function getReadableErrorMessage(error) {
  return getFriendlyErrorMessage(error);
}

export default getReadableErrorMessage;
