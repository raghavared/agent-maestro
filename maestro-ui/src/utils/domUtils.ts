export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

export async function copyToClipboard(text: string): Promise<boolean> {
    const value = text ?? "";
    if (!value) return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
