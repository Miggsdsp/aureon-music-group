import { adminFirestore } from '@/lib/firebase-admin';

export const DAILY_REPORT_RECIPIENT = 'info@aureonmusicgroup.com';
const REPORT_LEASE_MS = 10 * 60 * 1000;

function millis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}

export function isWithinPrevious24Hours(value: any, now: number) {
  const timestamp = millis(value);
  return timestamp >= now - 86_400_000 && timestamp <= now;
}

export function dublinReportDate(now: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now));
}

export function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function makeCsv(rows: unknown[][]) {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export async function claimDailyReport(input: {
  reportType: string;
  date: string;
  fileName: string;
  csv: string;
  metadata?: Record<string, unknown>;
}) {
  const reportId = `daily-${input.reportType}-${input.date}`;
  const ref = adminFirestore.collection('fulfilmentDigests').doc(reportId);
  const now = Date.now();
  const claimed = await adminFirestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    if (data.emailStatus === 'sent') return false;
    const sendingAt = millis(data.emailSendingAt);
    if (data.emailStatus === 'sending' && sendingAt && now - sendingAt < REPORT_LEASE_MS) return false;
    transaction.set(ref, {
      createdAt: data.createdAt || new Date(now),
      updatedAt: new Date(now),
      csv: input.csv,
      permanent: true,
      fileName: input.fileName,
      reportType: input.reportType,
      reportDate: input.date,
      recipient: DAILY_REPORT_RECIPIENT,
      emailStatus: 'sending',
      emailSendingAt: new Date(now),
      ...input.metadata,
    }, { merge: true });
    return true;
  });
  return { claimed, reportId, ref };
}

export async function sendDailyReportEmail(input: {
  reportType: string;
  date: string;
  subject: string;
  text: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured.');
  const from = process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <info@aureonmusicgroup.com>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `aureon-daily-${input.reportType}-${input.date}`,
    },
    body: JSON.stringify({
      from,
      to: [DAILY_REPORT_RECIPIENT],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });
  const payload = await response.text();
  if (!response.ok) throw new Error(`Resend daily report failed: ${response.status} ${payload}`);
  let emailId = '';
  try { emailId = String(JSON.parse(payload)?.id || ''); } catch {}
  return { emailId };
}

export async function markDailyReportSent(ref: FirebaseFirestore.DocumentReference, emailId = '') {
  await ref.set({
    emailStatus: 'sent',
    emailSentAt: new Date(),
    resendEmailId: emailId,
    updatedAt: new Date(),
  }, { merge: true });
}

export async function markDailyReportFailed(ref: FirebaseFirestore.DocumentReference, error: unknown) {
  await ref.set({
    emailStatus: 'failed',
    emailSendingAt: null,
    emailError: error instanceof Error ? error.message : String(error),
    updatedAt: new Date(),
  }, { merge: true });
}
