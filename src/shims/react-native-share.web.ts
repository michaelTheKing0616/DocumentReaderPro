/** Web shim — uses Web Share API when available. */
const Share = {
  async open(options: { url?: string; title?: string; message?: string }): Promise<{ success?: boolean }> {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: options.title,
        text: options.message,
        url: options.url,
      });
      return { success: true };
    }
    throw new Error('Web Share API is not available in this browser');
  },
};

export default Share;
