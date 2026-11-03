// CSV output helpers shared by the admin exports and the reports.
// Text cells starting with = + - @ are prefixed so spreadsheets do not run them as formulas; real numbers are left alone.
export const cell = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  let t = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export const csv = (header, rows) => [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
export const sendCsv = (res, name, body) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + body); // BOM so Excel reads UTF-8
};
