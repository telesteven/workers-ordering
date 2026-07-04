export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function kvTokenKey(token: string): string {
  return `qr_token:${token}`;
}

export interface TokenPointer {
  tableId: number;
  sessionId: number;
}
