import disposableDomains from "disposable-email-domains";

const DISPOSABLE_DOMAINS = new Set(disposableDomains.map((d) => d.toLowerCase()));

/** True for known temporary/throwaway email providers (Mailinator, Guerrilla Mail, 10minutemail, etc.). */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * One plain address: no comma or semicolon lists, spaces, angle brackets or quotes.
 * Nodemailer would send to every address in "a@x.de, b@y.de", so free-text input must never reach `to:` unchecked.
 */
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && /^[^\s@,;<>"()]+@[^\s@,;<>"()]+\.[a-z]{2,}$/i.test(email.trim());
}
