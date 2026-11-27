/** Saves a Blob as a file via a temporary object URL and an `<a download>` click. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started in every browser.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
