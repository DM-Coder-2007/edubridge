/**
 * EduBridge Adaptive - XML / Speech Markup Sanitizer Utility
 * Escapes XML entities so special textbook characters (e.g. &, <, >) do not break speech synthesis markup.
 */

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function stripXml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
}

module.exports = {
  escapeXml,
  stripXml
};
