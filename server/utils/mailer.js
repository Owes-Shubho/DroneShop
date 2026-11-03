import nodemailer from 'nodemailer';

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (n) => `$${Number(n).toFixed(2)}`;

let transport;
function getTransport() {
  if (transport !== undefined) return transport;
  transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transport;
}

/** Sends an email. Without SMTP settings the message is printed to the server console instead (development). */
export async function sendMail({ to, subject, text, html }) {
  if (process.env.NODE_ENV === 'test') return;
  const t = getTransport();
  if (!t) {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM || 'SkyCart <no-reply@skycart.local>', to, subject, text, html });
}

// Never let a mail failure break an API request.
const safe = (p) => p.catch((err) => console.error('Mail failed:', err.message));

export const mail = {
  orderPlaced(user, order) {
    const lines = order.items.map((i) => `${i.qty} x ${i.name} - ${usd(i.price * i.qty)}`);
    const url = `${clientUrl()}/orders/${order._id}`;
    return safe(sendMail({
      to: user.email,
      subject: `Order ${String(order._id).slice(-8)} confirmed`,
      text: `Hi ${user.name},\n\nThanks for your order.\n\n${lines.join('\n')}\n\nTotal: ${usd(order.totalPrice)}\nView it: ${url}\n`,
      html: `<p>Hi ${esc(user.name)},</p><p>Thanks for your order.</p><ul>${order.items.map((i) => `<li>${i.qty} × ${esc(i.name)} — ${usd(i.price * i.qty)}</li>`).join('')}</ul><p><strong>Total: ${usd(order.totalPrice)}</strong></p><p><a href="${url}">View your order</a></p>`,
    }));
  },
  orderShipped(user, order) {
    const t = order.tracking || {};
    const info = t.number ? `Carrier: ${t.carrier || 'n/a'}\nTracking number: ${t.number}${t.url ? `\nTrack: ${t.url}` : ''}\n` : '';
    return safe(sendMail({
      to: user.email,
      subject: `Order ${String(order._id).slice(-8)} has shipped`,
      text: `Hi ${user.name},\n\nYour order is on its way.\n${info}\nView it: ${clientUrl()}/orders/${order._id}\n`,
    }));
  },
  orderCancelled(user, order) {
    return safe(sendMail({
      to: user.email,
      subject: `Order ${String(order._id).slice(-8)} cancelled`,
      text: `Hi ${user.name},\n\nYour order ${String(order._id).slice(-8)} was cancelled.\n`,
    }));
  },
  passwordReset(user, token) {
    const url = `${clientUrl()}/reset-password/${token}`;
    return safe(sendMail({
      to: user.email,
      subject: 'Reset your SkyCart password',
      text: `Hi ${user.name},\n\nUse this link within one hour to choose a new password:\n${url}\n\nIf you did not ask for this, ignore this email.\n`,
    }));
  },
};
