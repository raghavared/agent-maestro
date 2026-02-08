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
      // fall through
    }
  
    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "true");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }