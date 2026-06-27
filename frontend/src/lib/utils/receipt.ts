import { financeApi } from "@/lib/api/services";

/** Fetch a receipt PDF (with auth) and save it to the user's device. Uses a
 * download anchor rather than window.open so it isn't swallowed by popup
 * blockers after the awaited fetch. */
export async function downloadReceipt(receiptId: number, receiptNumber?: string | null) {
  const blob = await financeApi.receipts.download(receiptId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${receiptNumber || `receipt-${receiptId}`}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
