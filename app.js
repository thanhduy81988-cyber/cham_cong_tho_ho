// Chấm công thợ hồ – dữ liệu lưu trong máy (localStorage), không cần mạng.
(function () {
  'use strict';

  // ================= Dữ liệu =================
  const KEY = 'chamcong_thoho_v2';
  const OLD_KEY = 'chamcong_thoho_v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const emptyDb = () => ({ version: 2, owner: '', jobs: [], workers: [], att: {}, money: [], income: [], expense: [], ui: {} });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(emptyDb(), JSON.parse(raw));
      const old = localStorage.getItem(OLD_KEY);
      if (old) return migrateV1(JSON.parse(old));
    } catch (e) {
      console.error(e);
    }
    return emptyDb();
  }

  // Chuyển dữ liệu bản đầu (theo công trình, thợ dùng chung) sang bản mới (theo công việc).
  function migrateV1(o) {
    const db = emptyDb();
    db.workers = (o.workers || []).map((w) => ({ id: w.id, name: w.name, position: '', phone: w.phone || '', createdAt: today() }));
    db.jobs = (o.sites || []).map((s) => ({ id: s.id, name: s.name, status: s.active === false ? 'done' : 'active', createdAt: today(), members: [] }));
    const wById = new Map((o.workers || []).map((w) => [w.id, w]));
    const member = (jobId, wid) => {
      const job = db.jobs.find((j) => j.id === jobId);
      const w = wById.get(wid);
      if (!job || !w) return null;
      let m = job.members.find((x) => x.workerId === wid);
      if (!m) job.members.push((m = { workerId: wid, rate: w.rate || 0, otRate: w.otRate || 0, joinedAt: today(), active: w.active !== false }));
      return m;
    };
    const lastJob = {};
    for (const k in o.att || {}) {
      const a = o.att[k];
      const m = member(a.siteId, a.workerId);
      if (!m) continue;
      if (a.day > 0) db.att[`${a.siteId}|${a.workerId}|${a.date}`] = a.day;
      if (a.ot) db.money.push({ id: uid(), jobId: a.siteId, workerId: a.workerId, type: 'ot', hours: a.ot, amount: Math.round(a.ot * otRateOf(m)), date: a.date, note: '' });
      if (!lastJob[a.workerId] || lastJob[a.workerId].date < a.date) lastJob[a.workerId] = { date: a.date, job: a.siteId };
    }
    for (const a of o.adv || []) {
      const jobId = (lastJob[a.workerId] || {}).job || (db.jobs[0] || {}).id;
      if (!jobId || !member(jobId, a.workerId)) continue;
      db.money.push({ id: a.id, jobId, workerId: a.workerId, type: 'adv', amount: a.amount, date: a.date, note: a.note || '' });
    }
    return db;
  }

  let db; // nạp ở phần Khởi động, sau khi các hàm ngày tháng đã có
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      toast('Không lưu được! Bộ nhớ máy đầy?');
    }
  }

  // ================= Ngày tháng =================
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const today = () => ymd(new Date());
  const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const THU_DAI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dmy = (s) => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const dm = (s) => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  const monthOf = (s) => s.slice(0, 7);
  const monthRange = (m) => { const [y, mo] = m.split('-').map(Number); return [`${m}-01`, ymd(new Date(y, mo, 0))]; };
  const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return ymd(d).slice(0, 7); };
  const monthLabel = (m) => `${m.slice(5)}/${m.slice(0, 4)}`;
  const daysBetween = (from, to) => { const out = []; for (let s = from; s <= to; s = addDays(s, 1)) out.push(s); return out; };
  const minS = (a, b) => (a < b ? a : b);
  const maxS = (a, b) => (a > b ? a : b);
  function lunarText(s) {
    const d = parse(s);
    const l = Lunar.toLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    return `${pad(l.day)}/${pad(l.month)}${l.leap ? ' (nhuận)' : ''}/${l.year}`;
  }

  // ================= Tiền =================
  const money = (n) => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
  const num = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const digits = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0;
  const hidden = '•••.••• đ';
  const showMoney = () => !!db.ui.showMoney;
  const mm = (n) => (showMoney() ? money(n) : hidden);

  // ================= Tra cứu =================
  const jobById = (id) => db.jobs.find((j) => j.id === id);
  const workerById = (id) => db.workers.find((w) => w.id === id);
  const memberOf = (job, wid) => job.members.find((m) => m.workerId === wid);
  const activeMembers = (job) => job.members.filter((m) => m.active !== false && workerById(m.workerId));
  const otRateOf = (m) => (m.otRate ? m.otRate : Math.round((m.rate || 0) / 8));
  const attKey = (jobId, wid, date) => `${jobId}|${wid}|${date}`;
  const getAtt = (jobId, wid, date) => db.att[attKey(jobId, wid, date)];
  function setAtt(jobId, wid, date, v) {
    const k = attKey(jobId, wid, date);
    if (v === null || v === undefined) delete db.att[k];
    else db.att[k] = v; // 1 | 0.5 | 'P' (nghỉ có lương)
  }
  const initials = (name) => {
    const p = String(name).trim().split(/\s+/);
    return ((p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)) || '?').toUpperCase();
  };
  const daysLeftInMonth = () => { const t = today(); const end = monthRange(monthOf(t))[1]; return Math.round((parse(end) - parse(t)) / 864e5); };

  const TYPES = {
    adv: { name: 'Ứng lương', list: 'Quản lý ứng lương', total: 'Tổng đã ứng' },
    ot: { name: 'Tăng ca', list: 'Quản lý tăng ca', total: 'Tổng tiền tăng ca' },
    bonus: { name: 'Phụ cấp', list: 'Quản lý phụ cấp, thưởng', total: 'Tổng phụ cấp' },
    deduct: { name: 'Trừ tiền', list: 'Quản lý trừ tiền', total: 'Tổng tiền trừ' },
    pay: { name: 'Thanh toán', list: 'Lịch sử thanh toán lương', total: 'Tổng đã thanh toán' },
  };

  // ================= Tính lương =================
  // Thống kê một thợ trong một công việc, từ ngày đến ngày.
  function statOf(job, m, from, to) {
    const s = { m, w: workerById(m.workerId), days: 0, leave: 0, wage: 0, ot: 0, otHours: 0, bonus: 0, adv: 0, deduct: 0, pay: 0 };
    const prefix = `${job.id}|${m.workerId}|`;
    for (const k in db.att) {
      if (!k.startsWith(prefix)) continue;
      const date = k.slice(prefix.length);
      if (date < from || date > to) continue;
      const v = db.att[k];
      if (v === 'P') s.leave += 1;
      else s.days += v;
    }
    s.wage = (s.days + s.leave) * (m.rate || 0);
    for (const e of db.money) {
      if (e.jobId !== job.id || e.workerId !== m.workerId || e.date < from || e.date > to) continue;
      s[e.type] += e.amount;
      if (e.type === 'ot') s.otHours += e.hours || 0;
    }
    s.total = s.wage + s.ot + s.bonus;
    s.received = s.adv + s.pay;
    s.unpaid = s.total - s.adv - s.deduct - s.pay;
    return s;
  }

  function jobStats(job, from, to) {
    const list = job.members
      .filter((m) => workerById(m.workerId))
      .map((m) => statOf(job, m, from, to))
      .filter((s) => s.m.active !== false || s.total || s.received || s.deduct);
    const sum = { days: 0, leave: 0, wage: 0, ot: 0, otHours: 0, bonus: 0, adv: 0, deduct: 0, pay: 0, total: 0, received: 0, unpaid: 0 };
    for (const s of list) for (const k in sum) sum[k] += s[k];
    list.sort((a, b) => a.w.name.localeCompare(b.w.name, 'vi'));
    return { list, sum };
  }
  const ALL_FROM = '2000-01-01';
  const ALL_TO = '2999-12-31';
  const jobUnpaid = (job) => jobStats(job, ALL_FROM, ALL_TO).sum.unpaid;

  function dayWage(job, date) {
    let t = 0;
    for (const m of job.members) {
      const v = getAtt(job.id, m.workerId, date);
      if (v) t += (v === 'P' ? 1 : v) * (m.rate || 0);
    }
    return t;
  }

  // ================= Biểu tượng =================
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 20z"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left2: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
    right2: '<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
    bag: '<path d="M9 3h6l-1.5 3h-3z"/><path d="M10.5 6C6 8 4 12 4 15.5 4 19 6.7 21 12 21s8-2 8-5.5C20 12 18 8 13.5 6"/><path d="M14 11.5c-.5-.6-1.2-.9-2-.9-1.1 0-2 .6-2 1.5s.9 1.3 2 1.5 2 .6 2 1.5-.9 1.5-2 1.5c-.8 0-1.6-.3-2-.9M12 9.5v1.1M12 16.6v1.1"/>',
    excel: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8.5 12.5l5 6M13.5 12.5l-5 6"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    tap: '<path d="M12 11v4M8.5 7.5a5 5 0 0 1 8.5 3.5v2M7 11v1a5 5 0 0 0 1 3M17 16.5a5 5 0 0 1-1.5 2.5M12 3a8 8 0 0 0-8 8v1M20 11a8 8 0 0 0-2.3-5.7M10 21a9 9 0 0 1-1.4-1.3M14.5 21c.7-.6 1.3-1.4 1.8-2.2"/>',
    cashMinus: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><circle cx="9" cy="12" r="2"/><path d="M15 12h4"/>',
    cashPlus: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><circle cx="9" cy="12" r="2"/><path d="M17 10v4M15 12h4"/>',
    cashX: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><circle cx="9" cy="12" r="2"/><path d="m15.5 10.5 3 3M18.5 10.5l-3 3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    wallet: '<path d="M20 7V5.5A1.5 1.5 0 0 0 18.5 4H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6"/><path d="M16 14h.01"/>',
    zap: '<rect x="3" y="3" width="13" height="13" rx="3"/><path d="M8 21h10a3 3 0 0 0 3-3V8"/><path d="m6.5 9.5 2 2 4-4"/>',
    pause: '<path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l4 4-4 4M14 12H4"/>',
    play: '<path d="m6 4 14 8-14 8z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    chart: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7"/>',
    checkCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m8 12 3 3 5-6"/>',
    flag: '<path d="M4 22V4M4 4h12l-2 4 2 4H4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    calCheck: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18M9 15.5l2 2 4-4"/>',
    calX: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18M10 14l4 4M14 14l-4 4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    box: '<path d="M21 8 12 3 3 8l9 5zM3 8v8l9 5 9-5V8M12 13v8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    house: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><circle cx="12" cy="14" r="2"/>',
    slip: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    in: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    out: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  };
  const I = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

  // ================= Tiện ích giao diện =================
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const app = $('#app');
  const sheet = $('#sheet');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2000);
  }

  function openSheet(title, body, bind) {
    sheet.innerHTML = `<div class="sh"><div class="grab"></div>
      <div class="sh-title"><h2>${esc(title)}</h2><button class="x" data-close aria-label="Đóng">${I('x', 'sm')}</button></div>${body}</div>`;
    $$('[data-close]', sheet).forEach((b) => (b.onclick = (e) => { e.preventDefault(); closeSheet(); }));
    if (!sheet.open) sheet.showModal();
    if (bind) bind(sheet);
  }
  const closeSheet = () => sheet.open && sheet.close();
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

  function confirmSheet(title, text, okText, onOk, danger = true) {
    openSheet(title, `<p class="muted" style="margin-top:0">${esc(text)}</p>
      <div class="actions"><button class="btn" data-close>Thôi</button><button class="btn ${danger ? 'danger' : 'primary'}" id="ok">${esc(okText)}</button></div>`,
      (s) => ($('#ok', s).onclick = () => { closeSheet(); onOk(); }));
  }

  function bindMoney(root) {
    $$('input[data-money]', root).forEach((inp) => {
      inp.addEventListener('input', () => { const n = digits(inp.value); inp.value = n ? n.toLocaleString('vi-VN') : ''; });
    });
  }
  const fmtInput = (n) => (n ? Number(n).toLocaleString('vi-VN') : '');

  const head = (title, { back = true, right = '', sub = '' } = {}) => `<div class="head">
    ${back ? `<button class="iconbtn flat" data-back aria-label="Quay lại">${I('back', 'lg')}</button>` : ''}
    <h1>${esc(title)}${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</h1>${right}</div>`;
  const emptyBox = (text) => `<div class="empty">${I('box')}${esc(text)}</div>`;

  // ================= Điều hướng =================
  // #/ · #/me · #/job/ID · #/job/ID/w/WID · #/job/ID/money/TYPE · #/job/ID/staff · #/job/ID/pick
  // #/job/ID/overview · #/job/ID/payroll · #/job/ID/slip/WID · #/job/ID/export · #/job/ID/profit
  const ui = { date: today(), month: monthOf(today()), jobTab: 'cham', staffTab: 'on', profitTab: 'in', range: 'month', from: null, to: null, search: '', pickQ: '', expand: false, exportCustom: false };

  function go(path) { location.hash = '#' + path; }
  function back() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'job' && parts.length > 2) go('/job/' + parts[1]);
    else go('/');
  }
  window.addEventListener('hashchange', () => { closeSheet(); window.scrollTo(0, 0); render(); });

  function render() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('?')[0].split('/').filter(Boolean);
    let res;
    try {
      if (!parts.length) res = screenHome();
      else if (parts[0] === 'me') res = screenMe();
      else if (parts[0] === 'job' && jobById(parts[1])) {
        const job = jobById(parts[1]);
        if (raw.endsWith('?cham')) { ui.jobTab = 'cham'; ui.date = today(); history.replaceState(null, '', '#/job/' + job.id); }
        const screens = { w: screenWorker, money: screenMoney, staff: screenStaff, pick: screenPick, overview: screenOverview, payroll: screenPayroll, slip: screenSlip, export: screenExport, profit: screenProfit };
        res = parts[2] ? (screens[parts[2]] ? screens[parts[2]](job, parts[3]) : null) : screenJob(job);
      }
      if (!res) { go('/'); return; }
    } catch (e) {
      console.error(e);
      res = [head('Có lỗi') + `<div class="card">${esc(e.message)}</div>`];
    }
    const [html, after] = res;
    app.innerHTML = html;
    $$('[data-back]').forEach((b) => (b.onclick = back));
    $$('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
    $$('[data-eye]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); db.ui.showMoney = !showMoney(); rerender(); }));
    if (after) after();
  }
  const rerender = () => { save(); render(); };

  const eyeBtn = () => `<button data-eye aria-label="${showMoney() ? 'Ẩn' : 'Hiện'} số tiền">${I(showMoney() ? 'eye' : 'eyeOff')}</button>`;
  const tabbar = (on) => `<nav class="tabbar">
    <a href="#/" class="${on === 'home' ? 'on' : ''}">${I('home')}Trang chủ</a>
    <a href="#/me" class="${on === 'me' ? 'on' : ''}">${I('user')}Cá nhân</a></nav>`;
  const monthNav = () => `<div class="monthnav"><button class="iconbtn" id="mp" aria-label="Tháng trước">${I('back')}</button><b>Tháng ${monthLabel(ui.month)}</b><button class="iconbtn" id="mn" aria-label="Tháng sau">${I('right')}</button></div>`;
  const bindMonthNav = () => {
    if (!$('#mp')) return;
    $('#mp').onclick = () => { ui.month = addMonths(ui.month, -1); render(); };
    $('#mn').onclick = () => { ui.month = addMonths(ui.month, 1); render(); };
  };
  const keepFocus = (id, key) => {
    const el = $(id);
    el.oninput = () => { ui[key] = el.value; const pos = el.selectionStart; render(); const n = $(id); n.focus(); n.setSelectionRange(pos, pos); };
  };

  // ================= Trang chủ =================
  function screenHome() {
    const t = today();
    const d = parse(t);
    const q = ui.search.trim().toLowerCase();
    const jobs = db.jobs
      .filter((j) => !q || j.name.toLowerCase().includes(q))
      .sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const [mFrom, mTo] = monthRange(monthOf(t));
    const cards = jobs.map((j) => {
      const adv = jobStats(j, mFrom, mTo).sum.adv;
      const done = j.status === 'done';
      return `<div class="card job">
        <div class="name"><span>${esc(j.name)}</span><span class="muted">${I('users')}</span></div>
        <div class="meta"><span>Ngày chốt lương: <b>${dmy(mTo)} (${daysLeftInMonth()} ngày)</b></span></div>
        <div class="meta"><span>${I('house', 'sm')} Nhân viên: <b>${activeMembers(j).length}</b></span>
          <span class="status ${done ? 'done' : ''}">${I('shield', 'sm')} ${done ? 'Đã hoàn thành' : 'Đang diễn ra'}</span></div>
        <div class="meta"><span>Đã ứng tháng này: <b class="c-red" data-eye>${mm(adv)}</b></span><span data-go="/job/${j.id}">${I('right2')}</span></div>
        <div class="btns">
          <button class="btn outline" data-go="/job/${j.id}?cham">Chấm công ${I('tap', 'sm')}</button>
          <button class="btn dark" data-go="/job/${j.id}">Xem chi tiết ${I('right2', 'sm')}</button>
        </div></div>`;
    });
    const html = `${head(`Xin chào ${db.owner || 'anh'}`, {
      back: false,
      sub: `${THU_DAI[d.getDay()]}, ${dmy(t)} · Âm lịch: ${lunarText(t)}`,
      right: `<button class="iconbtn primary" id="addJob" aria-label="Thêm công việc">${I('plus', 'lg')}</button>`,
    })}
      ${installHint()}
      <label class="search">${I('search')}<input id="q" placeholder="Tìm công việc" value="${esc(ui.search)}" autocomplete="off"></label>
      ${cards.join('') || `<div class="card">${emptyBox(db.jobs.length ? 'Không tìm thấy công việc.' : 'Chưa có công việc nào.')}
        ${db.jobs.length ? '' : `<button class="btn primary block" id="addJob2">${I('plus')} Tạo công việc đầu tiên</button>`}</div>`}
      ${tabbar('home')}`;
    return [html, () => {
      $('#addJob').onclick = () => editJob();
      if ($('#addJob2')) $('#addJob2').onclick = () => editJob();
      keepFocus('#q', 'search');
      bindInstall();
    }];
  }

  function editJob(job) {
    const isNew = !job;
    openSheet(isNew ? 'Tạo công việc' : 'Chỉnh sửa công việc', `
      <label class="f">Tên công việc / công trình <em>*</em></label>
      <input id="jn" value="${esc(job ? job.name : '')}" placeholder="Ví dụ: Nhà anh Tư - Q.7" autocomplete="off">
      ${isNew ? '' : '<p class="hint">Lương của từng thợ sửa trong mục Quản lý nhân viên.</p>'}
      <label class="f">Ngày chốt lương</label>
      <input value="Ngày cuối cùng của mỗi tháng" readonly>
      <p class="hint">Bảng lương tính theo từng tháng, chốt vào ngày cuối tháng.</p>
      <div class="actions"><button class="btn primary" id="ok">${isNew ? 'Tạo mới' : 'Lưu'}</button></div>`,
    (s) => {
      $('#ok', s).onclick = () => {
        const name = $('#jn', s).value.trim();
        if (!name) return toast('Nhập tên công việc');
        if (isNew) {
          const j = { id: uid(), name, status: 'active', createdAt: today(), members: [] };
          db.jobs.push(j);
          save();
          closeSheet();
          go('/job/' + j.id + '/pick');
        } else {
          job.name = name;
          closeSheet();
          rerender();
        }
      };
    });
  }

  // ================= Chi tiết công việc =================
  function screenJob(job) {
    const [from, to] = monthRange(ui.month);
    const { sum } = jobStats(job, from, to);
    const unpaid = jobUnpaid(job);
    const members = activeMembers(job).slice().sort((a, b) => workerById(a.workerId).name.localeCompare(workerById(b.workerId).name, 'vi'));
    const marked = members.filter((m) => getAtt(job.id, m.workerId, ui.date)).length;

    const top = `<div class="card tight">
      <div style="padding:16px 16px 12px">
        <div class="muted">Tổng chưa thanh toán</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="money-big">${mm(unpaid)} ${eyeBtn()}</div>
          <button class="link" style="text-decoration:none;color:var(--muted)" data-go="/job/${job.id}/overview">Tổng quan ${I('right', 'sm')}</button>
        </div>
      </div>
      <div class="shortcuts">
        <button class="shortcut" data-go="/job/${job.id}/profit"><span class="tile">${I('bag', 'lg')}</span>Lợi nhuận</button>
        <button class="shortcut" data-go="/job/${job.id}/staff"><span class="tile">${I('users', 'lg')}</span>Nhân viên</button>
        <button class="shortcut" data-go="/job/${job.id}/export"><span class="tile">${I('excel', 'lg')}</span>Xuất Excel</button>
        <button class="shortcut" id="more"><span class="tile">${I('grid', 'lg')}</span>Xem thêm</button>
      </div></div>`;

    const monthCard = `<div class="card">
      <div class="card-title"><h2 class="blue">Tiền công tháng ${Number(ui.month.slice(5))}</h2><button class="link" id="otherMonth">Tháng khác ${I('right', 'sm')}</button></div>
      <div class="rows">
        <div class="r"><span>Tổng tiền công</span><span class="c-blue">${money(sum.total)}</span></div>
        <div class="r"><span>Tổng đã ứng</span><span class="c-red">${money(sum.adv)}</span></div>
        ${ui.expand ? `
        <div class="r"><span>Tổng ngày công</span><span>${num(sum.days)}</span></div>
        <div class="r"><span>Tăng ca</span><span>${money(sum.ot)}</span></div>
        <div class="r"><span>Phụ cấp, thưởng</span><span>${money(sum.bonus)}</span></div>
        <div class="r"><span>Tiền trừ</span><span class="c-red">${money(sum.deduct)}</span></div>
        <div class="r"><span>Đã thanh toán</span><span class="c-red">${money(sum.pay)}</span></div>
        <div class="r big"><span>Chưa thanh toán</span><span>${money(sum.unpaid)}</span></div>` : ''}
      </div>
      <div class="more"><button id="expand">${ui.expand ? 'Thu gọn' : 'Xem chi tiết'} ${I(ui.expand ? 'up' : 'down', 'sm')}</button></div>
    </div>`;

    const seg = `<div class="seg"><button data-tab="cham" class="${ui.jobTab === 'cham' ? 'on' : ''}">Chấm công</button><button data-tab="tq" class="${ui.jobTab === 'tq' ? 'on' : ''}">Tổng quan</button></div>`;

    let body;
    if (ui.jobTab === 'cham') {
      const d = parse(ui.date);
      const [mf, mt] = monthRange(monthOf(ui.date));
      const cards = members.map((m) => {
        const w = workerById(m.workerId);
        const s = statOf(job, m, mf, mt);
        const start = maxS(mf, m.joinedAt || mf);
        const end = minS(mt, today());
        const span = end >= start ? daysBetween(start, end) : [];
        const off = span.filter((x) => !getAtt(job.id, m.workerId, x)).length;
        const v = getAtt(job.id, m.workerId, ui.date);
        const state = v === 1 ? ['', 'Đã chấm 1 công'] : v === 0.5 ? ['half', 'Đã chấm 1/2 công'] : v === 'P' ? ['leave', 'Nghỉ có lương'] : null;
        return `<div class="card" data-m="${m.workerId}">
          <div class="person" data-go="/job/${job.id}/w/${m.workerId}"><div class="avatar">${esc(initials(w.name))}</div>
            <div class="who"><b>${esc(w.name)}</b><small>${esc(w.position || 'Nhân viên')}</small></div><span class="muted">${I('right2')}</span></div>
          <div class="stats">
            <div class="ok">${I('calCheck')} Đi làm ${num(s.days)} ngày</div>
            <div>${I('calX')} Nghỉ ${off} ngày</div>
            <div class="full">${I('cashMinus')} Đã ứng ${money(s.adv)}</div>
            <div class="full"><span class="muted">Tổng tiền công:</span> <b>${money(s.total)}</b></div>
          </div>
          ${state
            ? `<div class="marked ${state[0]}"><span>${I('checkCircle', 'sm')} ${state[1]}</span><button data-undo>Bỏ chấm</button></div>`
            : `<div class="markbtns"><button class="btn orange" data-v="0.5">Chấm 1/2 công ${I('tap', 'sm')}</button><button class="btn primary" data-v="1">Chấm công ${I('tap', 'sm')}</button></div>`}
          <div class="extra"><button data-extra>Nghỉ có lương, tăng ca, ứng ${I('down', 'sm')}</button></div>
        </div>`;
      });
      body = `<div class="card" style="padding:10px 12px">
          <div class="datebar" style="margin:0">
            <button class="iconbtn" id="prev" aria-label="Hôm trước">${I('back')}</button>
            <div class="mid"><b>${THU_DAI[d.getDay()]}, ${dmy(ui.date)}</b><small>${ui.date === today() ? 'Hôm nay · ' : ''}bấm để đổi ngày</small><input type="date" id="pick" value="${ui.date}" aria-label="Chọn ngày"></div>
            <button class="iconbtn" id="next" aria-label="Hôm sau">${I('right')}</button>
          </div></div>
        <div class="section-label"><span>Đã chấm công ${marked}/${members.length}</span><button class="link" data-go="/job/${job.id}/staff" style="text-decoration:none" aria-label="Quản lý nhân viên">${I('gear')}</button></div>
        ${cards.join('') || `<div class="card">${emptyBox('Công việc chưa có thợ.')}<button class="btn primary block" data-go="/job/${job.id}/pick">${I('plus')} Thêm nhân viên</button></div>`}
        ${members.length ? `<button class="fab" id="fab" aria-label="Chấm công cả đội">${I('tap', 'lg')}</button>` : ''}`;
    } else {
      body = calendarJob(job);
    }

    const html = `${head(job.name, { right: `<button class="iconbtn" id="gear" aria-label="Cài đặt">${I('gear')}</button>` })}
      ${job.status === 'done' ? `<div class="card install" style="background:var(--green-soft);border-color:#a7e3b9">${I('checkCircle', 'sm')} Công việc đã hoàn thành. Vẫn xem và sửa được.</div>` : ''}
      ${top}${monthCard}${seg}${body}`;

    return [html, () => {
      $('#gear').onclick = () => jobMenu(job);
      $('#more').onclick = () => moreMenu(job);
      $('#expand').onclick = () => { ui.expand = !ui.expand; render(); };
      $('#otherMonth').onclick = () => pickMonth((m) => { ui.month = m; render(); });
      $$('.seg [data-tab]').forEach((b) => (b.onclick = () => { ui.jobTab = b.dataset.tab; render(); }));
      if (ui.jobTab === 'cham') {
        $('#prev').onclick = () => { ui.date = addDays(ui.date, -1); render(); };
        $('#next').onclick = () => { ui.date = addDays(ui.date, 1); render(); };
        $('#pick').onchange = (e) => { if (e.target.value) { ui.date = e.target.value; render(); } };
        $$('[data-m]').forEach((el) => {
          const wid = el.dataset.m;
          $$('[data-v]', el).forEach((b) => (b.onclick = () => { setAtt(job.id, wid, ui.date, Number(b.dataset.v)); rerender(); }));
          const u = $('[data-undo]', el);
          if (u) u.onclick = () => { setAtt(job.id, wid, ui.date, null); rerender(); };
          $('[data-extra]', el).onclick = () => attMenu(job, wid, ui.date);
        });
        if ($('#fab')) $('#fab').onclick = () => {
          const left = members.filter((m) => !getAtt(job.id, m.workerId, ui.date));
          if (!left.length) return toast('Đã chấm hết cho cả đội');
          confirmSheet('Chấm công cả đội', `Chấm 1 công ngày ${dmy(ui.date)} cho ${left.length} thợ chưa chấm?`, 'Chấm công', () => {
            for (const m of left) setAtt(job.id, m.workerId, ui.date, 1);
            rerender();
            toast(`Đã chấm cho ${left.length} thợ`);
          }, false);
        };
      } else bindCalendarJob(job);
    }];
  }

  function attMenu(job, wid, date) {
    const w = workerById(wid);
    openSheet(`${w.name} · ${dmy(date)}`, `<ul class="menu">
      <li><button data-a="1">${I('checkCircle')} Chấm 1 công</button></li>
      <li><button data-a="0.5">${I('checkCircle')} Chấm 1/2 công</button></li>
      <li><button data-a="P">${I('calendar')} Nghỉ có lương</button></li>
      <li><button data-a="none">${I('calX')} Bỏ chấm ngày này</button></li>
      <li><button data-t="ot">${I('cashPlus')} Thêm tăng ca</button></li>
      <li><button data-t="adv">${I('cashMinus')} Ghi ứng lương</button></li>
    </ul>`, (s) => {
      $$('[data-a]', s).forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        setAtt(job.id, wid, date, a === 'none' ? null : a === 'P' ? 'P' : Number(a));
        closeSheet();
        rerender();
      }));
      $$('[data-t]', s).forEach((b) => (b.onclick = () => moneyForm(job, b.dataset.t, { workerId: wid, date })));
    });
  }

  function jobMenu(job) {
    openSheet('Cài đặt công việc', `<ul class="menu">
      <li><button id="m1">${I('edit')} Chỉnh sửa công việc ${I('right', 'chev')}</button></li>
      <li><button id="m2">${I('users')} Quản lý nhân viên ${I('right', 'chev')}</button></li>
      <li><button id="m3" class="danger">${I('trash')} Xóa công việc</button></li></ul>`, (s) => {
      $('#m1', s).onclick = () => editJob(job);
      $('#m2', s).onclick = () => { closeSheet(); go(`/job/${job.id}/staff`); };
      $('#m3', s).onclick = () => deleteJob(job);
    });
  }

  function moreMenu(job) {
    const done = job.status === 'done';
    openSheet('Xem thêm', `<ul class="menu">
      <li><button id="m1">${I('slip')} Bảng lương theo tháng ${I('right', 'chev')}</button></li>
      <li><button id="m5">${I('cashMinus')} Quản lý ứng lương ${I('right', 'chev')}</button></li>
      <li><button id="m6">${I('cashPlus')} Quản lý tăng ca ${I('right', 'chev')}</button></li>
      <li><button id="m2">${I('chart')} Biểu đồ thống kê ${I('right', 'chev')}</button></li>
      <li><button id="m3">${I(done ? 'play' : 'flag')} ${done ? 'Mở lại công việc' : 'Hoàn thành công việc'}</button></li>
      <li><button id="m4" class="danger">${I('trash')} Xóa công việc</button></li></ul>`, (s) => {
      $('#m1', s).onclick = () => { closeSheet(); go(`/job/${job.id}/payroll`); };
      $('#m5', s).onclick = () => { closeSheet(); go(`/job/${job.id}/money/adv`); };
      $('#m6', s).onclick = () => { closeSheet(); go(`/job/${job.id}/money/ot`); };
      $('#m2', s).onclick = () => chartSheet(job);
      $('#m3', s).onclick = () => { job.status = done ? 'active' : 'done'; closeSheet(); rerender(); toast(done ? 'Đã mở lại' : 'Đã đánh dấu hoàn thành'); };
      $('#m4', s).onclick = () => deleteJob(job);
    });
  }

  function deleteJob(job) {
    confirmSheet('Xóa công việc?', `Xóa "${job.name}" cùng toàn bộ chấm công, tiền ứng, thanh toán của công việc này. Không lấy lại được (trừ khi có file sao lưu).`, 'Xóa vĩnh viễn', () => {
      for (const k of Object.keys(db.att)) if (k.startsWith(job.id + '|')) delete db.att[k];
      db.money = db.money.filter((e) => e.jobId !== job.id);
      db.income = db.income.filter((e) => e.jobId !== job.id);
      db.expense = db.expense.filter((e) => e.jobId !== job.id);
      db.jobs = db.jobs.filter((j) => j !== job);
      save();
      go('/');
      toast('Đã xóa công việc');
    });
  }

  // Biểu đồ tiền công 6 tháng gần nhất
  function chartSheet(job) {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(addMonths(monthOf(today()), -i));
    const vals = months.map((m) => { const [f, t] = monthRange(m); return jobStats(job, f, t).sum.total; });
    const max = Math.max(1, ...vals);
    const bars = months.map((m, i) => {
      const h = Math.round((vals[i] / max) * 130);
      const x = 14 + i * 52;
      return `<rect x="${x}" y="${160 - h}" width="34" height="${Math.max(h, 2)}" rx="6" fill="#2563eb"/>
        <text x="${x + 17}" y="180" text-anchor="middle" font-size="12" fill="#6b7a90">T${Number(m.slice(5))}</text>
        ${vals[i] ? `<text x="${x + 17}" y="${152 - h}" text-anchor="middle" font-size="11" fill="#0f1b3d">${(Math.round(vals[i] / 1e5) / 10).toLocaleString('vi-VN')}tr</text>` : ''}`;
    }).join('');
    openSheet('Tiền công 6 tháng gần đây', `<svg viewBox="0 0 330 190" style="width:100%;height:auto">${bars}<line x1="0" y1="160" x2="330" y2="160" stroke="#e3e9f1"/></svg>
      <p class="hint">Đơn vị: triệu đồng (tr). Gồm tiền công, tăng ca, phụ cấp.</p>`);
  }

  function pickMonth(cb, current = ui.month) {
    let y = Number(current.slice(0, 4));
    const draw = (s) => {
      $('#yy', s).textContent = 'Năm ' + y;
      $('#mgrid', s).innerHTML = Array.from({ length: 12 }, (_, i) => {
        const m = `${y}-${pad(i + 1)}`;
        return `<button class="btn ${m === current ? 'primary' : ''}" data-mo="${m}">Tháng ${i + 1}</button>`;
      }).join('');
      $$('[data-mo]', s).forEach((b) => (b.onclick = () => { closeSheet(); cb(b.dataset.mo); }));
    };
    openSheet('Chọn tháng', `<div class="monthnav"><button class="iconbtn" id="py">${I('back')}</button><b id="yy"></b><button class="iconbtn" id="ny">${I('right')}</button></div>
      <div id="mgrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>`, (s) => {
      $('#py', s).onclick = () => { y--; draw(s); };
      $('#ny', s).onclick = () => { y++; draw(s); };
      draw(s);
    });
  }

  const calHead = () => `<div class="cal-head"><button class="nav" id="cprev" aria-label="Tháng trước">${I('left2', 'sm')}</button><h3>Tháng ${monthLabel(ui.month)}</h3><button class="nav" id="cnext" aria-label="Tháng sau">${I('right2', 'sm')}</button></div>`;
  const dows = () => ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((x) => `<div class="dow">${x}</div>`).join('');
  const leadCells = (from) => '<div class="d empty"></div>'.repeat((parse(from).getDay() + 6) % 7);
  const shortMoney = (v) => (v >= 1e6 ? (Math.round(v / 1e5) / 10).toLocaleString('vi-VN') + 'tr' : Math.round(v / 1e3) + 'k');

  // Lịch tháng của công việc: tiền công mỗi ngày
  function calendarJob(job) {
    const [from, to] = monthRange(ui.month);
    const t = today();
    const cells = daysBetween(from, to).map((s) => {
      const v = dayWage(job, s);
      const cnt = job.members.filter((m) => getAtt(job.id, m.workerId, s)).length;
      return `<button class="d ${s < t ? 'past' : ''} ${s === t ? 'today' : ''}" data-day="${s}">
        <span class="n">${parse(s).getDate()}</span><span class="v amt">${v ? shortMoney(v) : ''}</span>
        <span class="muted" style="font-size:.62rem">${cnt ? cnt + ' thợ' : ''}</span></button>`;
    });
    return `${calHead()}<div class="cal">${dows()}${leadCells(from)}${cells.join('')}</div>
      <p class="hint">Mỗi ô là tiền công cả đội trong ngày (k = nghìn, tr = triệu). Bấm vào một ngày để chấm công ngày đó.</p>`;
  }
  function bindCalendarJob() {
    $('#cprev').onclick = () => { ui.month = addMonths(ui.month, -1); render(); };
    $('#cnext').onclick = () => { ui.month = addMonths(ui.month, 1); render(); };
    $$('[data-day]').forEach((b) => (b.onclick = () => { ui.date = b.dataset.day; ui.jobTab = 'cham'; render(); }));
  }

  // ================= Một thợ trong công việc =================
  function screenWorker(job, wid) {
    const m = memberOf(job, wid);
    const w = workerById(wid);
    if (!m || !w) return null;
    const [from, to] = monthRange(ui.month);
    const s = statOf(job, m, from, to);
    const all = statOf(job, m, ALL_FROM, ALL_TO);
    const t = today();
    const tv = getAtt(job.id, wid, t);

    const cells = daysBetween(from, to).map((d) => {
      const v = getAtt(job.id, wid, d);
      const tag = v === 1 ? '<span class="v full">1</span>' : v === 0.5 ? '<span class="v half">½</span>' : v === 'P' ? '<span class="v leave">P</span>' : '<span class="v"></span>';
      const hasMoney = db.money.some((e) => e.jobId === job.id && e.workerId === wid && e.date === d);
      return `<button class="d ${d < t ? 'past' : ''} ${d === t ? 'today' : ''}" data-day="${d}"><span class="n">${parse(d).getDate()}</span>${tag}<span style="font-size:.6rem;color:var(--orange);min-height:10px">${hasMoney ? '●' : ''}</span></button>`;
    });
    const entries = db.money.filter((e) => e.jobId === job.id && e.workerId === wid && e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));

    const html = `${head(`${w.name} - ${job.name}`, { right: `<button class="iconbtn" id="prof" aria-label="Thông tin thợ">${I('user')}</button>` })}
      ${m.active === false ? `<div class="card install">${I('pause', 'sm')} Thợ đang tạm ngừng chấm công. <button class="link" id="resume">Tiếp tục</button></div>` : ''}
      <div class="card tight">
        <div style="padding:16px 16px 12px"><div class="muted">Tổng chưa thanh toán</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="money-big">${mm(all.unpaid)} ${eyeBtn()}</div>
          <button class="link" style="text-decoration:none;color:var(--muted)" data-go="/job/${job.id}/slip/${wid}">Phiếu lương ${I('right', 'sm')}</button></div></div>
        <div class="shortcuts">
          <button class="shortcut" data-t="adv"><span class="tile">${I('cashMinus', 'lg')}</span>Ứng lương</button>
          <button class="shortcut" data-t="ot"><span class="tile">${I('cashPlus', 'lg')}</span>Tăng ca</button>
          <button class="shortcut" data-t="bonus"><span class="tile">${I('gift', 'lg')}</span>Phụ cấp</button>
          <button class="shortcut" data-t="deduct"><span class="tile">${I('cashX', 'lg')}</span>Trừ tiền</button>
          <button class="shortcut" data-t="pay"><span class="tile">${I('wallet', 'lg')}</span>Thanh toán</button>
          <button class="shortcut" id="xls"><span class="tile">${I('excel', 'lg')}</span>Xuất Excel</button>
          <button class="shortcut" id="quick"><span class="tile">${I('zap', 'lg')}</span>Chấm nhanh</button>
          <button class="shortcut" id="pause"><span class="tile">${I(m.active === false ? 'play' : 'pause', 'lg')}</span>${m.active === false ? 'Tiếp tục' : 'Tạm ngừng'}</button>
        </div></div>
      <div class="card">
        <div class="card-title"><h2 class="blue">Tiền công tháng ${Number(ui.month.slice(5))}</h2><button class="link" id="otherMonth">Tháng khác ${I('right', 'sm')}</button></div>
        <div class="rows">
          <div class="r"><span>Số công</span><span>${num(s.days)}${s.leave ? ` + ${num(s.leave)} nghỉ có lương` : ''}</span></div>
          <div class="r"><span>Tổng lương</span><span class="c-blue">${money(s.total)}</span></div>
          <div class="r"><span>Tổng đã ứng</span><span class="c-red">${money(s.adv)}</span></div>
          <div class="r"><span>Tổng tiền trừ</span><span class="c-red">${money(s.deduct)}</span></div>
          <div class="r"><span>Tổng đã thanh toán</span><span class="c-red">${money(s.pay)}</span></div>
          <div class="r big"><span>Tổng chưa nhận</span><span>${money(s.unpaid)}</span></div>
        </div></div>
      ${calHead()}
      <div class="cal">${dows()}${leadCells(from)}${cells.join('')}</div>
      <div class="legend"><span><i style="background:var(--green)"></i>1 công</span><span><i style="background:var(--orange)"></i>½ công</span><span><i style="background:var(--primary)"></i>Nghỉ có lương</span><span><span style="color:var(--orange)">●</span> có ứng, tăng ca…</span></div>
      <div class="section-label"><span>Ứng, tăng ca, thanh toán trong tháng</span></div>
      <div class="card">${entries.length ? `<ul class="list">${entries.map((e) => entryLi(e, false)).join('')}</ul>` : emptyBox('Chưa có khoản nào trong tháng.')}</div>
      <div class="bottombar"><div class="in"><span>${tv ? `Hôm nay: <span class="c-green">${tv === 'P' ? 'nghỉ có lương' : num(tv) + ' công'}</span>` : 'Hôm nay chưa chấm công'}</span>
        <button class="btn ${tv ? '' : 'purple'}" id="today">${tv ? 'Bỏ chấm' : 'Chấm công'} ${I('tap', 'sm')}</button></div></div>`;

    return [html, () => {
      $$('[data-t]').forEach((b) => (b.onclick = () => moneyForm(job, b.dataset.t, { workerId: wid })));
      $('#otherMonth').onclick = () => pickMonth((mo) => { ui.month = mo; render(); });
      $('#cprev').onclick = () => { ui.month = addMonths(ui.month, -1); render(); };
      $('#cnext').onclick = () => { ui.month = addMonths(ui.month, 1); render(); };
      $$('[data-day]').forEach((b) => (b.onclick = () => attMenu(job, wid, b.dataset.day)));
      $('#today').onclick = () => { setAtt(job.id, wid, t, tv ? null : 1); rerender(); };
      $('#prof').onclick = () => editWorker(w, m, job);
      $('#xls').onclick = () => exportWorker(job, m, from, to);
      $('#quick').onclick = () => quickMark(job, m);
      const toggle = () => {
        if (m.active === false) { m.active = true; rerender(); toast('Đã cho chấm công lại'); return; }
        confirmSheet('Tạm ngừng chấm công?', `${w.name} sẽ chuyển sang danh sách "Đã nghỉ làm". Dữ liệu cũ vẫn giữ.`, 'Tạm ngừng', () => { m.active = false; rerender(); }, false);
      };
      $('#pause').onclick = toggle;
      if ($('#resume')) $('#resume').onclick = toggle;
      $$('[data-e]').forEach((li) => (li.onclick = () => editEntry(job, li.dataset.e)));
    }];
  }

  function quickMark(job, m) {
    const [mf] = monthRange(monthOf(today()));
    openSheet('Chấm nhanh', `<p class="muted" style="margin-top:0">Chấm 1 công cho mọi ngày <b>chưa chấm</b> trong khoảng này.</p>
      <label class="f">Từ ngày</label><input type="date" id="qf" value="${minS(today(), maxS(mf, m.joinedAt || mf))}">
      <label class="f">Đến ngày</label><input type="date" id="qt" value="${today()}">
      <label class="switch"><input type="checkbox" id="qs" checked> Bỏ qua Chủ nhật</label>
      <div class="actions"><button class="btn primary" id="ok">Chấm công</button></div>`, (s) => {
      $('#ok', s).onclick = () => {
        const f = $('#qf', s).value, t = $('#qt', s).value, skip = $('#qs', s).checked;
        if (!f || !t || f > t) return toast('Khoảng ngày không đúng');
        let n = 0;
        for (const d of daysBetween(f, t)) {
          if (skip && parse(d).getDay() === 0) continue;
          if (!getAtt(job.id, m.workerId, d)) { setAtt(job.id, m.workerId, d, 1); n++; }
        }
        closeSheet();
        rerender();
        toast(`Đã chấm ${n} ngày`);
      };
    });
  }

  // ================= Các khoản tiền =================
  function entryLi(e, showName) {
    const t = TYPES[e.type];
    const w = workerById(e.workerId);
    const minus = e.type === 'adv' || e.type === 'deduct' || e.type === 'pay';
    return `<li class="tap" data-e="${e.id}"><div class="main"><b>${showName ? esc(w ? w.name : '?') + ' · ' : ''}${t.name}${e.type === 'ot' && e.hours ? ` ${num(e.hours)} giờ` : ''}</b>
      <small>${THU[parse(e.date).getDay()]} ${dmy(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</small></div>
      <span class="amt ${minus ? 'c-red' : 'c-green'}">${minus ? '−' : '+'}${money(e.amount)}</span></li>`;
  }

  function moneyForm(job, type, { workerId, date, entry } = {}) {
    const t = TYPES[type];
    const e = entry || { type, workerId, date: date || today(), amount: 0, note: '', hours: 0 };
    const members = job.members.filter((m) => workerById(m.workerId) && (m.active !== false || m.workerId === e.workerId));
    const quick = type === 'ot' ? [] : [200000, 500000, 1000000];
    const mem0 = e.workerId && memberOf(job, e.workerId);
    const s0 = mem0 ? statOf(job, mem0, ALL_FROM, ALL_TO) : null;
    openSheet(`${entry ? 'Sửa' : 'Thêm'} ${t.name.toLowerCase()}`, `
      <label class="f">Thợ <em>*</em></label>
      <select id="fw" ${workerId && !entry ? 'disabled' : ''}><option value="">— Chọn thợ —</option>
        ${members.map((m) => `<option value="${m.workerId}" ${m.workerId === e.workerId ? 'selected' : ''}>${esc(workerById(m.workerId).name)}</option>`).join('')}</select>
      ${type === 'ot' ? `<label class="f">Số giờ tăng ca</label><input id="fh" inputmode="decimal" value="${e.hours ? String(e.hours).replace('.', ',') : ''}" placeholder="Ví dụ 2">
        <p class="hint" id="fhint"></p>` : ''}
      <label class="f">Số tiền <em>*</em></label>
      <input id="fa" inputmode="numeric" data-money value="${fmtInput(e.amount)}" placeholder="Ví dụ 500.000" autocomplete="off">
      ${quick.length ? `<div class="quick">${quick.map((q) => `<button data-q="${q}">${q >= 1e6 ? q / 1e6 + ' triệu' : q / 1e3 + ' nghìn'}</button>`).join('')}</div>` : ''}
      ${type === 'pay' && s0 && !entry && s0.unpaid > 0 ? `<div class="quick" style="grid-template-columns:1fr"><button data-q="${s0.unpaid}">Trả hết: ${money(s0.unpaid)}</button></div>` : ''}
      <label class="f">Ngày</label><input type="date" id="fd" value="${e.date}">
      <label class="f">Ghi chú</label><input id="fn" value="${esc(e.note)}" placeholder="(không bắt buộc)">
      <div class="actions">${entry ? '<button class="btn danger" id="del">Xóa</button>' : ''}<button class="btn primary" id="ok">Lưu</button></div>`,
    (s) => {
      bindMoney(s);
      $$('[data-q]', s).forEach((b) => (b.onclick = () => ($('#fa', s).value = fmtInput(Number(b.dataset.q)))));
      const hours = () => Number(String($('#fh', s).value).replace(',', '.')) || 0;
      if (type === 'ot') {
        const hint = () => { const m = memberOf(job, $('#fw', s).value); $('#fhint', s).textContent = m ? `Tiền tăng ca: ${money(otRateOf(m))}/giờ` : ''; return m; };
        const upd = () => { const m = hint(); if (m && hours()) $('#fa', s).value = fmtInput(Math.round(hours() * otRateOf(m))); };
        $('#fh', s).oninput = upd;
        $('#fw', s).onchange = upd;
        hint();
      }
      $('#ok', s).onclick = () => {
        const wid = $('#fw', s).value;
        const amount = digits($('#fa', s).value);
        if (!wid) return toast('Chọn thợ');
        if (!amount) return toast('Nhập số tiền');
        Object.assign(e, { jobId: job.id, workerId: wid, amount, date: $('#fd', s).value || today(), note: $('#fn', s).value.trim() });
        if (type === 'ot') e.hours = hours();
        if (!entry) db.money.push(Object.assign(e, { id: uid() }));
        closeSheet();
        rerender();
        toast(`Đã lưu ${t.name.toLowerCase()} ${money(amount)}`);
      };
      if ($('#del', s)) $('#del', s).onclick = () => confirmSheet('Xóa khoản này?', `${t.name} ${money(e.amount)} ngày ${dmy(e.date)}`, 'Xóa', () => {
        db.money = db.money.filter((x) => x !== entry);
        rerender();
      });
    });
  }
  function editEntry(job, id) {
    const e = db.money.find((x) => x.id === id);
    if (e) moneyForm(job, e.type, { entry: e, workerId: e.workerId });
  }

  function screenMoney(job, type) {
    const t = TYPES[type];
    if (!t) return null;
    const [from, to] = monthRange(ui.month);
    const list = db.money.filter((e) => e.jobId === job.id && e.type === type && e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));
    const total = list.reduce((a, e) => a + e.amount, 0);
    const html = `${head(t.list, { sub: job.name })}
      ${monthNav()}
      <div class="card"><div class="muted">${t.total}</div><div class="money-big ${type === 'ot' || type === 'bonus' ? '' : 'red'}">${money(total)}</div></div>
      <div class="card">${list.length ? `<ul class="list">${list.map((e) => entryLi(e, true)).join('')}</ul>` : emptyBox('Chưa có dữ liệu trong tháng.')}</div>
      <button class="btn primary block" id="add">${I('plus')} Thêm mới</button>`;
    return [html, () => {
      bindMonthNav();
      $('#add').onclick = () => moneyForm(job, type);
      $$('[data-e]').forEach((li) => (li.onclick = () => editEntry(job, li.dataset.e)));
    }];
  }

  // ================= Nhân viên =================
  function screenStaff(job) {
    const on = ui.staffTab === 'on';
    const list = job.members.filter((m) => workerById(m.workerId) && (m.active !== false) === on)
      .sort((a, b) => workerById(a.workerId).name.localeCompare(workerById(b.workerId).name, 'vi'));
    const cards = list.map((m) => {
      const w = workerById(m.workerId);
      return `<div class="card">
        <div class="person"><div class="avatar">${esc(initials(w.name))}</div>
          <div class="who"><b>${esc(w.name)}</b><small>${esc(w.position || 'Nhân viên')}</small></div>
          ${on ? `<button class="iconbtn" data-edit="${m.workerId}" aria-label="Sửa">${I('edit')}</button>` : ''}</div>
        <div class="rows" style="margin-top:10px">
          <div class="r"><span class="muted">${I('phone', 'sm')} Số điện thoại</span><span>${w.phone ? `<a href="tel:${esc(w.phone)}" class="c-blue">${esc(w.phone)}</a>` : '—'}</span></div>
          <div class="r"><span class="muted">${I('calendar', 'sm')} Ngày bắt đầu</span><span>${m.joinedAt ? dmy(m.joinedAt) : '—'}</span></div>
          <div class="r"><span class="muted">${I('cashPlus', 'sm')} Lương ngày</span><span>${money(m.rate)}</span></div>
          ${on ? '' : '<div class="r"><span class="muted">Trạng thái</span><span class="c-red">Đã ngừng chấm công</span></div>'}
        </div>
        ${on ? '' : `<div class="markbtns"><button class="btn danger" data-del="${m.workerId}">${I('trash', 'sm')} Xóa vĩnh viễn</button><button class="btn primary" data-res="${m.workerId}">${I('play', 'sm')} Tiếp tục</button></div>`}
      </div>`;
    });
    const nOn = job.members.filter((m) => m.active !== false && workerById(m.workerId)).length;
    const nOff = job.members.filter((m) => m.active === false && workerById(m.workerId)).length;
    const html = `${head('Quản lý nhân viên', { sub: job.name })}
      <div class="tabs2"><button data-st="on" class="${on ? 'on' : ''}">Đang làm việc (${nOn})</button><button data-st="off" class="${on ? '' : 'on'}">Đã nghỉ làm (${nOff})</button></div>
      ${cards.join('') || `<div class="card">${emptyBox(on ? 'Chưa có nhân viên.' : 'Không có ai nghỉ làm.')}</div>`}
      ${on ? `<button class="btn primary block" data-go="/job/${job.id}/pick">${I('plus')} Thêm nhân viên</button>` : ''}`;
    return [html, () => {
      $$('[data-st]').forEach((b) => (b.onclick = () => { ui.staffTab = b.dataset.st; render(); }));
      $$('[data-edit]').forEach((b) => (b.onclick = () => editWorker(workerById(b.dataset.edit), memberOf(job, b.dataset.edit), job)));
      $$('[data-res]').forEach((b) => (b.onclick = () => { memberOf(job, b.dataset.res).active = true; rerender(); toast('Đã cho chấm công lại'); }));
      $$('[data-del]').forEach((b) => (b.onclick = () => {
        const wid = b.dataset.del;
        confirmSheet('Xóa vĩnh viễn?', `Xóa ${workerById(wid).name} khỏi công việc này, kèm toàn bộ chấm công, tiền ứng, thanh toán ở đây.`, 'Xóa vĩnh viễn', () => {
          for (const k of Object.keys(db.att)) if (k.startsWith(`${job.id}|${wid}|`)) delete db.att[k];
          db.money = db.money.filter((e) => !(e.jobId === job.id && e.workerId === wid));
          job.members = job.members.filter((m) => m.workerId !== wid);
          rerender();
        });
      }));
    }];
  }

  // Chọn thợ có sẵn để thêm vào công việc
  function screenPick(job) {
    const q = ui.pickQ.toLowerCase();
    const avail = db.workers.filter((w) => !memberOf(job, w.id) && (!q || w.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const lastRate = (wid) => { for (const j of db.jobs) { const m = memberOf(j, wid); if (m) return m.rate; } return 0; };
    const html = `${head('Chọn nhân viên', { sub: job.name, right: `<button class="iconbtn primary" id="create" aria-label="Tạo nhân viên mới">${I('plus', 'lg')}</button>` })}
      <label class="search">${I('search')}<input id="pq" placeholder="Tìm nhân viên" value="${esc(ui.pickQ)}" autocomplete="off"></label>
      <div class="card">
        ${avail.length ? avail.map((w) => `<div class="check"><input type="checkbox" data-w="${w.id}" id="c_${w.id}">
          <label for="c_${w.id}" style="flex:1;min-width:0"><b>${esc(w.name)}</b><br><small class="muted">${esc(w.position || 'Nhân viên')}${w.phone ? ' · ' + esc(w.phone) : ''}</small></label>
          <input class="rate" data-rate="${w.id}" inputmode="numeric" data-money value="${fmtInput(lastRate(w.id))}" placeholder="Lương ngày" aria-label="Lương ngày"></div>`).join('')
        : emptyBox(db.workers.length ? 'Mọi thợ đã có trong công việc này. Bấm + để tạo thợ mới.' : 'Chưa có thợ nào. Bấm + để tạo thợ mới.')}
      </div>
      ${avail.length ? '<p class="hint">Đánh dấu thợ cần thêm, sửa lương ngày nếu cần (lương riêng cho công việc này).</p><button class="btn primary block" id="add">Thêm vào công việc</button>'
        : `<button class="btn primary block" id="create2">${I('plus')} Tạo nhân viên mới</button>`}
      <button class="btn block" style="margin-top:10px" data-go="/job/${job.id}">Xong</button>`;
    return [html, () => {
      bindMoney(app);
      $('#create').onclick = () => editWorker(null, null, job);
      if ($('#create2')) $('#create2').onclick = () => editWorker(null, null, job);
      keepFocus('#pq', 'pickQ');
      $$('.rate').forEach((r) => r.addEventListener('input', () => { const c = $(`[data-w="${r.dataset.rate}"]`); if (c) c.checked = true; }));
      if ($('#add')) $('#add').onclick = () => {
        const picked = $$('[data-w]').filter((c) => c.checked);
        if (!picked.length) return toast('Chọn ít nhất 1 thợ');
        for (const c of picked) if (!digits($(`[data-rate="${c.dataset.w}"]`).value)) return toast(`Nhập lương ngày cho ${workerById(c.dataset.w).name}`);
        for (const c of picked) job.members.push({ workerId: c.dataset.w, rate: digits($(`[data-rate="${c.dataset.w}"]`).value), otRate: 0, joinedAt: today(), active: true });
        save();
        toast(`Đã thêm ${picked.length} thợ`);
        ui.pickQ = '';
        go('/job/' + job.id);
      };
    }];
  }

  // Tạo / sửa thợ. Có job: lương ngày áp dụng cho công việc đó; tạo mới thì thêm luôn vào công việc.
  function editWorker(w, m, job) {
    const isNew = !w;
    w = w || { name: '', position: '', phone: '' };
    m = m || { rate: 0, otRate: 0, joinedAt: today() };
    openSheet(isNew ? 'Tạo nhân viên' : 'Sửa nhân viên', `
      <label class="f">Tên nhân viên <em>*</em></label><input id="wn" value="${esc(w.name)}" autocomplete="off" placeholder="Ví dụ: Anh Ba">
      <label class="f">Chức vụ</label><input id="wp" value="${esc(w.position)}" placeholder="Thợ chính, phụ hồ…">
      <label class="f">Số điện thoại</label><input id="wph" type="tel" value="${esc(w.phone)}">
      <label class="f">Kiểu chấm công <em>*</em></label><input value="Chấm theo ngày (cả ngày / nửa ngày)" readonly>
      <label class="f">Lương ngày <em>*</em></label><input id="wr" inputmode="numeric" data-money value="${fmtInput(m.rate)}" placeholder="Ví dụ 400.000">
      <label class="f">Tiền tăng ca 1 giờ</label><input id="wo" inputmode="numeric" data-money value="${fmtInput(m.otRate)}" placeholder="Để trống = lương ngày ÷ 8">
      <label class="f">Ngày bắt đầu làm</label><input id="wj" type="date" value="${m.joinedAt || today()}">
      ${job ? `<p class="hint">Lương ngày áp dụng cho công việc "${esc(job.name)}".</p>` : ''}
      <div class="actions"><button class="btn primary" id="ok">${isNew ? 'Tạo mới' : 'Lưu'}</button></div>`,
    (s) => {
      bindMoney(s);
      $('#ok', s).onclick = () => {
        const name = $('#wn', s).value.trim();
        const rate = digits($('#wr', s).value);
        if (!name) return toast('Nhập tên nhân viên');
        if (!rate) return toast('Nhập lương ngày');
        Object.assign(w, { name, position: $('#wp', s).value.trim(), phone: $('#wph', s).value.trim() });
        if (isNew) db.workers.push(Object.assign(w, { id: uid(), createdAt: today() }));
        Object.assign(m, { rate, otRate: digits($('#wo', s).value), joinedAt: $('#wj', s).value || today() });
        if (job && !memberOf(job, w.id)) job.members.push(Object.assign(m, { workerId: w.id, active: true }));
        closeSheet();
        rerender();
        toast(isNew ? `Đã tạo ${name}` : 'Đã lưu');
      };
    });
  }

  // ================= Tổng quan, bảng lương, phiếu lương =================
  function rangeOf() {
    const t = today();
    switch (ui.range) {
      case 'month': return monthRange(monthOf(t));
      case 'last': return monthRange(addMonths(monthOf(t), -1));
      case 'all': return [ALL_FROM, t];
      default: return [ui.from || monthRange(monthOf(t))[0], ui.to || t];
    }
  }

  function screenOverview(job) {
    const [from, to] = rangeOf();
    const { list, sum } = jobStats(job, from, to);
    const chip = (v, txt) => `<button data-r="${v}" class="${ui.range === v ? 'on' : ''}">${txt}</button>`;
    const html = `${head('Tổng quan công việc', { sub: job.name, right: `<button class="iconbtn" id="xls" aria-label="Xuất Excel">${I('excel')}</button>` })}
      <div class="chips">${chip('month', 'Tháng này')}${chip('last', 'Tháng trước')}${chip('all', 'Từ đầu')}${chip('custom', 'Tự chọn')}</div>
      ${ui.range === 'custom' ? `<div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input type="date" id="rf" value="${from}"><input type="date" id="rt" value="${to}"></div>` : ''}
      <div class="card">
        <div class="muted" style="margin-bottom:6px">${ui.range === 'all' ? 'Từ đầu' : 'Từ ' + dmy(from)} đến ${dmy(to)}</div>
        <div class="rows">
          <div class="r"><span>Tổng ngày công</span><span>${num(sum.days)}</span></div>
          <div class="r"><span>Tổng nghỉ có lương</span><span>${num(sum.leave)}</span></div>
          <div class="r"><span>Tiền công</span><span>${money(sum.wage)}</span></div>
          <div class="r"><span>Tăng ca</span><span>${money(sum.ot)}</span></div>
          <div class="r"><span>Thưởng, phụ cấp</span><span>${money(sum.bonus)}</span></div>
          <div class="r"><span>Tổng lương</span><span class="c-blue">${money(sum.total)}</span></div>
          <div class="r"><span>Tổng đã nhận (ứng + trả)</span><span class="c-green">${money(sum.received)}</span></div>
          <div class="r"><span>Khấu trừ</span><span class="c-red">${money(sum.deduct)}</span></div>
          <div class="r big"><span>Tổng chưa thanh toán</span><span>${money(sum.unpaid)}</span></div>
        </div></div>
      <div class="section-label"><span>Danh sách nhân viên: ${pad(list.length)}</span></div>
      ${list.map((s) => `<div class="card" data-go="/job/${job.id}/w/${s.m.workerId}">
        <div class="card-title"><h2>${esc(s.w.name)}</h2><span class="muted">${I('right2')}</span></div>
        <div class="rows">
          <div class="r"><span class="muted">Tổng ngày công</span><span>${num(s.days)}</span></div>
          <div class="r"><span class="muted">Tổng nghỉ có lương</span><span>${num(s.leave)}</span></div>
          <div class="r"><span class="muted">Tổng lương</span><span>${money(s.total)}</span></div>
          <div class="r"><span class="muted">Tổng đã nhận</span><span>${money(s.received)}</span></div>
          <div class="r big"><span class="muted">Tổng chưa nhận</span><span>${money(s.unpaid)}</span></div>
        </div></div>`).join('') || `<div class="card">${emptyBox('Chưa có dữ liệu.')}</div>`}`;
    return [html, () => {
      $$('[data-r]').forEach((b) => (b.onclick = () => { if (b.dataset.r === 'custom' && ui.range !== 'custom') [ui.from, ui.to] = rangeOf(); ui.range = b.dataset.r; render(); }));
      if ($('#rf')) { $('#rf').onchange = (e) => { ui.from = e.target.value; render(); }; $('#rt').onchange = (e) => { ui.to = e.target.value; render(); }; }
      $('#xls').onclick = () => exportJob(job, maxS(from, firstDate(job)), to, 'all');
    }];
  }
  // Ngày sớm nhất có dữ liệu, để bảng chấm công "Từ đầu" không kéo dài từ năm 2000.
  function firstDate(job) {
    let f = today();
    for (const k in db.att) if (k.startsWith(job.id + '|')) f = minS(f, k.slice(-10));
    for (const e of db.money) if (e.jobId === job.id) f = minS(f, e.date);
    return f;
  }

  function screenPayroll(job) {
    const [from, to] = monthRange(ui.month);
    const { list, sum } = jobStats(job, from, to);
    const html = `${head('Bảng lương theo tháng', { sub: job.name, right: `<button class="iconbtn" id="xls" aria-label="Xuất Excel">${I('excel')}</button>` })}
      ${monthNav()}
      <div class="card"><div class="rows">
        <div class="r"><span>Tổng lương</span><span class="c-blue">${money(sum.total)}</span></div>
        <div class="r"><span>Đã ứng</span><span class="c-red">${money(sum.adv)}</span></div>
        <div class="r"><span>Tiền trừ</span><span class="c-red">${money(sum.deduct)}</span></div>
        <div class="r"><span>Đã thanh toán</span><span class="c-red">${money(sum.pay)}</span></div>
        <div class="r big"><span>Chưa thanh toán</span><span>${money(sum.unpaid)}</span></div></div></div>
      ${list.map((s) => `<div class="card" data-go="/job/${job.id}/slip/${s.m.workerId}">
        <div class="person"><div class="avatar">${esc(initials(s.w.name))}</div><div class="who"><b>${esc(s.w.name)}</b><small>${num(s.days)} công · ${money(s.m.rate)}/ngày</small></div><span class="muted">${I('right2')}</span></div>
        <div class="rows" style="margin-top:8px">
          <div class="r"><span class="muted">Tổng lương</span><span>${money(s.total)}</span></div>
          <div class="r"><span class="muted">Đã ứng, trừ, đã trả</span><span class="c-red">${money(s.adv + s.deduct + s.pay)}</span></div>
          <div class="r big"><span class="muted">Chưa thanh toán</span><span class="${s.unpaid < 0 ? 'c-red' : ''}">${money(s.unpaid)}</span></div></div></div>`).join('') || `<div class="card">${emptyBox('Tháng này chưa có công.')}</div>`}
      ${sum.unpaid > 0 ? `<div class="bottombar"><div class="in"><span>Còn ${money(sum.unpaid)}</span><button class="btn primary" id="payAll">${I('wallet', 'sm')} Thanh toán lương</button></div></div>` : ''}`;
    return [html, () => {
      bindMonthNav();
      $('#xls').onclick = () => exportJob(job, from, to, 'all');
      if ($('#payAll')) $('#payAll').onclick = () => {
        const due = list.filter((s) => s.unpaid > 0);
        const date = payDate(from, to);
        confirmSheet('Thanh toán lương', `Ghi đã trả đủ lương tháng ${monthLabel(ui.month)} cho ${due.length} thợ, tổng ${money(due.reduce((a, s) => a + s.unpaid, 0))}?`, 'Đã trả lương', () => {
          for (const s of due) db.money.push({ id: uid(), jobId: job.id, workerId: s.m.workerId, type: 'pay', amount: s.unpaid, date, note: `Lương tháng ${monthLabel(ui.month)}` });
          rerender();
          toast('Đã ghi thanh toán lương');
        }, false);
      };
    }];
  }
  // Ghi thanh toán vào trong chính tháng đó để bảng lương tháng khớp: hôm nay nếu còn trong tháng, không thì ngày cuối tháng.
  const payDate = (from, to) => maxS(from, minS(to, today()));

  function slipRows(s, from, to) {
    return [
      ['Nhân viên', s.w.name], ['Kỳ lương', `${dmy(from)} - ${dmy(to)}`], ['Kiểu chấm công', 'Theo ngày'], ['Lương ngày', money(s.m.rate)],
      ['Số ngày công', num(s.days)], ['Nghỉ có lương', num(s.leave)], ['Tiền công', money(s.wage)],
      ['Tăng ca' + (s.otHours ? ` (${num(s.otHours)} giờ)` : ''), money(s.ot)], ['Thưởng, phụ cấp', money(s.bonus)],
      ['Tổng lương', money(s.total)], ['Đã ứng', money(s.adv)], ['Khấu trừ', money(s.deduct)], ['Đã thanh toán', money(s.pay)], ['Chưa thanh toán', money(s.unpaid)],
    ];
  }

  function screenSlip(job, wid) {
    const m = memberOf(job, wid);
    if (!m || !workerById(wid)) return null;
    const [from, to] = monthRange(ui.month);
    const s = statOf(job, m, from, to);
    const rows = slipRows(s, from, to);
    const html = `${head('Phiếu lương', { sub: job.name, right: `<button class="iconbtn" id="xls" aria-label="Xuất Excel">${I('excel')}</button>` })}
      ${monthNav()}
      <div class="card"><div class="rows">${rows.map(([k, v], i) => `<div class="r ${i === rows.length - 1 ? 'big' : ''}"><span class="muted">${k}</span><span class="${k === 'Tổng lương' ? 'c-blue' : ''}">${esc(v)}</span></div>`).join('')}</div></div>
      ${s.unpaid > 0 ? `<button class="btn primary block" id="pay">${I('wallet', 'sm')} Thanh toán ${money(s.unpaid)}</button>` : ''}
      <button class="btn block" style="margin-top:10px" data-go="/job/${job.id}/w/${wid}">Xem chấm công của thợ</button>`;
    return [html, () => {
      bindMonthNav();
      $('#xls').onclick = () => exportWorker(job, m, from, to);
      if ($('#pay')) $('#pay').onclick = () => {
        db.money.push({ id: uid(), jobId: job.id, workerId: wid, type: 'pay', amount: s.unpaid, date: payDate(from, to), note: `Lương tháng ${monthLabel(ui.month)}` });
        rerender();
        toast('Đã ghi thanh toán');
      };
    }];
  }

  // ================= Lợi nhuận =================
  function screenProfit(job) {
    const income = db.income.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
    const expense = db.expense.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
    const wages = jobStats(job, ALL_FROM, ALL_TO).sum;
    const wageCost = wages.total - wages.deduct;
    const tin = income.reduce((a, e) => a + e.amount, 0);
    const tout = wageCost + expense.reduce((a, e) => a + e.amount, 0);
    const profit = tin - tout;
    const on = ui.profitTab === 'in';
    const li = (e, kind) => `<li class="tap" data-${kind}="${e.id}"><div class="main"><b>${esc(e.source || (kind === 'in' ? 'Thu tiền' : 'Chi phí'))}</b><small>${dmy(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</small></div>
      <span class="amt ${kind === 'in' ? 'c-blue' : 'c-red'}">${kind === 'in' ? '+' : '−'}${money(e.amount)}</span></li>`;
    const addBtn = (id) => `<button class="iconbtn primary" id="${id}" style="width:40px;height:40px;border-radius:12px" aria-label="Thêm">${I('plus')}</button>`;
    const html = `${head('Quản lý lợi nhuận', { sub: job.name })}
      <div class="card"><div class="muted">Tổng lợi nhuận</div><div class="money-big ${profit < 0 ? 'red' : ''}">${money(profit)}</div>
        <div class="split"><div><small>Thu vào ${I('in', 'sm')}</small><b class="c-blue">${money(tin)}</b></div><div><small>Chi ra ${I('out', 'sm')}</small><b class="c-red">${money(tout)}</b></div></div>
        <p class="hint">Lợi nhuận = tiền nhận từ chủ nhà − tiền công thợ − chi phí khác.</p></div>
      <div class="seg"><button data-pt="in" class="${on ? 'on' : ''}">Thu vào</button><button data-pt="out" class="${on ? '' : 'on'}">Chi ra</button></div>
      ${on ? `<div class="card"><div class="card-title"><h2>Lịch sử nhận tiền</h2>${addBtn('addIn')}</div>
          ${income.length ? `<ul class="list">${income.map((e) => li(e, 'in')).join('')}</ul>` : emptyBox('Chưa nhận khoản nào từ chủ nhà.')}</div>`
      : `<div class="card"><div class="rows">
          <div class="r"><span>Tiền công thợ (đã trừ khấu trừ)</span><span class="c-red">${money(wageCost)}</span></div>
          <div class="r"><span class="muted">Trong đó đã trả (ứng + thanh toán)</span><span>${money(wages.received)}</span></div></div></div>
        <div class="card"><div class="card-title"><h2>Chi phí khác</h2>${addBtn('addOut')}</div>
          ${expense.length ? `<ul class="list">${expense.map((e) => li(e, 'out')).join('')}</ul>` : emptyBox('Vật tư, xăng xe, ăn uống… ghi ở đây.')}</div>`}`;
    return [html, () => {
      $$('[data-pt]').forEach((b) => (b.onclick = () => { ui.profitTab = b.dataset.pt; render(); }));
      const form = (kind, e) => {
        const isIn = kind === 'in';
        const rec = e || { date: today(), amount: 0, source: '', note: '' };
        openSheet(`${e ? 'Sửa' : 'Thêm'} ${isIn ? 'khoản thu' : 'chi phí'}`, `
          <label class="f">Số tiền <em>*</em></label><input id="pa" inputmode="numeric" data-money value="${fmtInput(rec.amount)}">
          <label class="f">${isIn ? 'Nguồn tiền' : 'Khoản chi'}</label><input id="ps" value="${esc(rec.source)}" placeholder="${isIn ? 'Chủ nhà, chủ đầu tư…' : 'Xi măng, cát, xăng xe…'}">
          <label class="f">Ngày</label><input type="date" id="pd" value="${rec.date}">
          <label class="f">Ghi chú</label><input id="pn" value="${esc(rec.note)}">
          <div class="actions">${e ? '<button class="btn danger" id="del">Xóa</button>' : ''}<button class="btn primary" id="ok">Lưu</button></div>`, (s) => {
          bindMoney(s);
          $('#ok', s).onclick = () => {
            const amount = digits($('#pa', s).value);
            if (!amount) return toast('Nhập số tiền');
            Object.assign(rec, { jobId: job.id, amount, source: $('#ps', s).value.trim(), date: $('#pd', s).value || today(), note: $('#pn', s).value.trim() });
            if (!e) (isIn ? db.income : db.expense).push(Object.assign(rec, { id: uid() }));
            closeSheet();
            rerender();
          };
          if ($('#del', s)) $('#del', s).onclick = () => {
            if (isIn) db.income = db.income.filter((x) => x !== e); else db.expense = db.expense.filter((x) => x !== e);
            closeSheet();
            rerender();
          };
        });
      };
      if ($('#addIn')) $('#addIn').onclick = () => form('in');
      if ($('#addOut')) $('#addOut').onclick = () => form('out');
      $$('[data-in]').forEach((l) => (l.onclick = () => form('in', db.income.find((x) => x.id === l.dataset.in))));
      $$('[data-out]').forEach((l) => (l.onclick = () => form('out', db.expense.find((x) => x.id === l.dataset.out))));
    }];
  }

  // ================= Xuất Excel =================
  const B = (v) => ({ v, bold: true });
  const M = (v) => ({ v: Math.round(v || 0), money: true });
  const BM = (v) => ({ v: Math.round(v || 0), money: true, bold: true });
  const attCell = (v) => (v === 'P' ? 'P' : v || '');

  function sheetAttendance(job, from, to, wid) {
    const days = daysBetween(from, to);
    const list = jobStats(job, from, to).list.filter((s) => !wid || s.m.workerId === wid);
    return { name: 'Bảng chấm công', widths: [24, ...days.map(() => 6), 9, 9], rows: [
      [B(`BẢNG CHẤM CÔNG – ${job.name}`)],
      [`Từ ${dmy(from)} đến ${dmy(to)}. Ký hiệu: 1 = cả ngày, 0,5 = nửa ngày, P = nghỉ có lương`],
      [B('Họ tên'), ...days.map((s) => B(`${THU[parse(s).getDay()]} ${dm(s)}`)), B('Công'), B('Nghỉ P')],
      ...list.map((s) => [s.w.name, ...days.map((d) => attCell(getAtt(job.id, s.m.workerId, d))), B(s.days), s.leave]),
    ] };
  }
  function sheetPayroll(job, from, to) {
    const { list, sum } = jobStats(job, from, to);
    const H = ['STT', 'Họ tên', 'Chức vụ', 'Lương ngày', 'Số công', 'Nghỉ có lương', 'Tiền công', 'Tăng ca', 'Phụ cấp', 'Tổng lương', 'Đã ứng', 'Khấu trừ', 'Đã thanh toán', 'Chưa thanh toán'];
    return { name: 'Bảng lương', widths: [5, 24, 14, 12, 9, 9, 14, 12, 12, 14, 13, 12, 14, 15], rows: [
      [B(`BẢNG LƯƠNG – ${job.name}`)], [`Từ ${dmy(from)} đến ${dmy(to)}`], [],
      H.map(B),
      ...list.map((s, i) => [i + 1, s.w.name, s.w.position || '', M(s.m.rate), s.days, s.leave, M(s.wage), M(s.ot), M(s.bonus), M(s.total), M(s.adv), M(s.deduct), M(s.pay), BM(s.unpaid)]),
      [B('Tổng'), '', '', '', B(sum.days), B(sum.leave), BM(sum.wage), BM(sum.ot), BM(sum.bonus), BM(sum.total), BM(sum.adv), BM(sum.deduct), BM(sum.pay), BM(sum.unpaid)],
    ] };
  }
  function sheetMoney(job, from, to, wid) {
    const list = db.money.filter((e) => e.jobId === job.id && e.date >= from && e.date <= to && (!wid || e.workerId === wid)).sort((a, b) => a.date.localeCompare(b.date));
    return { name: 'Ứng, tăng ca, phụ cấp', widths: [12, 24, 14, 9, 14, 30], rows: [
      [B(`ỨNG LƯƠNG, TĂNG CA, PHỤ CẤP, TRỪ TIỀN, THANH TOÁN – ${job.name}`)], [`Từ ${dmy(from)} đến ${dmy(to)}`], [],
      ['Ngày', 'Họ tên', 'Loại', 'Số giờ', 'Số tiền', 'Ghi chú'].map(B),
      ...list.map((e) => [dmy(e.date), (workerById(e.workerId) || {}).name || '?', TYPES[e.type].name, e.hours || '', M(e.amount), e.note || '']),
    ] };
  }
  function sheetSlip(job, m, from, to) {
    const s = statOf(job, m, from, to);
    return { name: 'PL ' + s.w.name, widths: [26, 26], rows: [[B('PHIẾU LƯƠNG')], [job.name], [], ...slipRows(s, from, to).map(([k, v], i, a) => [k, i === a.length - 1 ? B(v) : v])] };
  }

  function exportJob(job, from, to, kind) {
    const sheets = [];
    if (kind === 'all' || kind === 'att') sheets.push(sheetAttendance(job, from, to));
    if (kind === 'all' || kind === 'pay') sheets.push(sheetPayroll(job, from, to));
    if (kind === 'all' || kind === 'money') sheets.push(sheetMoney(job, from, to));
    if (kind === 'all' || kind === 'slip') for (const s of jobStats(job, from, to).list) sheets.push(sheetSlip(job, s.m, from, to));
    const names = { all: 'tong-hop', att: 'bang-cham-cong', pay: 'bang-luong', money: 'ung-tang-ca', slip: 'phieu-luong' };
    download(XLSX.build(sheets), `${slug(job.name)}_${names[kind]}_${from}_${to}.xlsx`);
  }
  function exportWorker(job, m, from, to) {
    const w = workerById(m.workerId);
    download(XLSX.build([sheetSlip(job, m, from, to), sheetAttendance(job, from, to, m.workerId), sheetMoney(job, from, to, m.workerId)]), `${slug(w.name)}_${from}_${to}.xlsx`);
  }
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'cham-cong';

  function screenExport(job) {
    const [from, to] = ui.exportCustom ? [ui.from || monthRange(ui.month)[0], ui.to || today()] : monthRange(ui.month);
    const btn = (k, icon, t, d) => `<button class="opt" data-x="${k}"><span class="tile">${I(icon)}</span><span><b>${t}</b><small>${d}</small></span></button>`;
    const html = `${head('Xuất dữ liệu ra Excel', { sub: job.name })}
      <div class="card">
        <div class="tabs2" style="margin-top:-6px"><button data-xc="0" class="${ui.exportCustom ? '' : 'on'}">Theo tháng</button><button data-xc="1" class="${ui.exportCustom ? 'on' : ''}">Tự chọn ngày</button></div>
        ${ui.exportCustom
          ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input type="date" id="xf" value="${from}"><input type="date" id="xt" value="${to}"></div>`
          : monthNav()}
        <p class="hint" style="margin-bottom:0">Kỳ: ${dmy(from)} – ${dmy(to)}</p>
      </div>
      ${btn('att', 'calCheck', 'Bảng chấm công', 'Từng thợ, từng ngày: 1 / 0,5 / P')}
      ${btn('pay', 'excel', 'Bảng lương', 'Công, tiền công, tăng ca, phụ cấp, ứng, trừ, còn lại')}
      ${btn('money', 'cashPlus', 'Ứng, tăng ca, phụ cấp, trừ tiền', 'Danh sách từng khoản theo ngày')}
      ${btn('slip', 'slip', 'Phiếu lương', 'Mỗi thợ một trang')}
      ${btn('all', 'download', 'Tất cả trong một file', 'Gồm cả 4 loại trên')}`;
    return [html, () => {
      $$('[data-xc]').forEach((b) => (b.onclick = () => { ui.exportCustom = b.dataset.xc === '1'; render(); }));
      bindMonthNav();
      if ($('#xf')) { $('#xf').onchange = (e) => { ui.from = e.target.value; render(); }; $('#xt').onchange = (e) => { ui.to = e.target.value; render(); }; }
      $$('[data-x]').forEach((b) => (b.onclick = () => { if (from > to) return toast('Khoảng ngày không đúng'); exportJob(job, from, to, b.dataset.x); }));
    }];
  }

  // ================= Tải / chia sẻ file =================
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  function download(blob, filename) {
    // iPhone: mở bảng Chia sẻ để lưu vào Tệp hoặc gửi Zalo; tải kiểu thường hay lỗi khi chạy từ màn hình chính.
    if (isIOS && navigator.canShare) {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: filename }).catch((e) => { if (e.name !== 'AbortError') saveLink(blob, filename); });
        return;
      }
    }
    saveLink(blob, filename);
  }
  function saveLink(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Đã tải ' + filename);
  }

  // iPhone tự xóa dữ liệu trang web không mở trong 7 ngày, trừ khi đã thêm vào màn hình chính.
  function installHint() {
    if (!isIOS || isStandalone() || db.ui.hideInstall) return '';
    return `<div class="card install" id="install">
      <p><b>Cài app lên màn hình chính</b> để mở nhanh và <b>không bị mất dữ liệu</b>:</p>
      <p>1. Bấm nút <b>Chia sẻ</b> ${I('share', 'sm')} ở thanh dưới Safari<br>2. Chọn <b>Thêm vào MH chính</b></p>
      <button class="btn block" id="hideInstall">Đã hiểu</button></div>`;
  }
  function bindInstall() { if ($('#hideInstall')) $('#hideInstall').onclick = () => { db.ui.hideInstall = true; rerender(); }; }

  // ================= Cá nhân =================
  function screenMe() {
    const html = `${head('Cá nhân', { back: false })}
      <div class="card"><div class="profile"><div class="avatar">${esc(initials(db.owner || 'Tôi'))}</div>
        <div style="flex:1;min-width:0"><b style="font-size:1.2rem">${esc(db.owner || 'Chưa đặt tên')}</b><div class="muted">${db.jobs.length} công việc · ${db.workers.length} thợ</div></div>
        <button class="iconbtn" id="name" aria-label="Đổi tên">${I('edit')}</button></div></div>
      ${installHint()}
      <div class="section-label"><span>Dữ liệu</span></div>
      <div class="card"><ul class="menu">
        <li><button id="backup">${I('download')} Tải file sao lưu ${I('right', 'chev')}</button></li>
        <li><button id="restore">${I('upload')} Khôi phục từ file ${I('right', 'chev')}</button></li>
        <li><button id="workers">${I('users')} Tất cả thợ (${db.workers.length}) ${I('right', 'chev')}</button></li>
      </ul><input type="file" id="file" accept=".json,application/json" hidden></div>
      <p class="hint" style="margin:0 6px 14px">Dữ liệu chỉ nằm trong điện thoại này. Nên tải file sao lưu mỗi tuần, gửi vào Zalo hoặc lưu vào Tệp để không bị mất.</p>
      <div class="section-label"><span>Ứng dụng</span></div>
      <div class="card"><ul class="menu">
        <li><button id="howto">${I('info')} Hướng dẫn sử dụng ${I('right', 'chev')}</button></li>
        <li><button id="about">${I('house')} Về ứng dụng ${I('right', 'chev')}</button></li>
      </ul></div>
      ${tabbar('me')}`;
    return [html, () => {
      bindInstall();
      $('#name').onclick = () => openSheet('Tên của anh', `<label class="f">Tên hiển thị</label><input id="on" value="${esc(db.owner)}" placeholder="Ví dụ: Anh Duy">
        <div class="actions"><button class="btn primary" id="ok">Lưu</button></div>`, (s) => ($('#ok', s).onclick = () => { db.owner = $('#on', s).value.trim(); closeSheet(); rerender(); }));
      $('#backup').onclick = () => download(new Blob([JSON.stringify(db)], { type: 'application/json' }), `cham-cong_sao-luu_${today()}.json`);
      $('#restore').onclick = () => $('#file').click();
      $('#file').onchange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        f.text().then((txt) => {
          let data;
          try {
            data = JSON.parse(txt);
            if (data.version === 1 || data.sites) data = migrateV1(data);
            if (!Array.isArray(data.jobs) || !Array.isArray(data.workers)) throw new Error();
          } catch (err) { return toast('File không đúng định dạng'); }
          confirmSheet('Khôi phục dữ liệu?', `Thay toàn bộ dữ liệu trong máy bằng file này (${data.jobs.length} công việc, ${data.workers.length} thợ).`, 'Khôi phục', () => {
            db = Object.assign(emptyDb(), data);
            rerender();
            toast('Đã khôi phục');
          });
        });
      };
      $('#workers').onclick = () => openSheet('Tất cả thợ', db.workers.length ? `<ul class="list">${db.workers.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi')).map((w) => {
        const jobs = db.jobs.filter((j) => memberOf(j, w.id)).map((j) => j.name);
        return `<li class="tap" data-w="${w.id}"><div class="avatar">${esc(initials(w.name))}</div><div class="main"><b>${esc(w.name)}</b><small>${esc(jobs.join(', ') || 'Chưa ở công việc nào')}</small></div>${I('edit', 'sm')}</li>`;
      }).join('')}</ul>` : emptyBox('Chưa có thợ.'), (s) => $$('[data-w]', s).forEach((li) => (li.onclick = () => editWorkerBasic(workerById(li.dataset.w)))));
      $('#howto').onclick = () => openSheet('Hướng dẫn sử dụng', `<ol style="padding-left:20px;line-height:1.6;margin-top:0">
        <li>Trang chủ bấm <b>+</b> để tạo công việc (công trình).</li>
        <li>Thêm nhân viên vào công việc, nhập lương ngày.</li>
        <li>Mỗi ngày bấm <b>Chấm công</b> ở thẻ công việc, rồi bấm <b>Chấm công</b> hoặc <b>Chấm 1/2 công</b> cho từng thợ. Nút tròn màu cam chấm 1 công cho cả đội.</li>
        <li>Bấm vào tên thợ để ghi <b>ứng lương, tăng ca, phụ cấp, trừ tiền, thanh toán</b> và xem lịch tháng.</li>
        <li>Cuối tháng vào <b>Xem thêm → Bảng lương theo tháng</b> để trả lương, hoặc <b>Xuất Excel</b>.</li></ol>`);
      $('#about').onclick = () => openSheet('Về ứng dụng', `<p>Chấm công thợ hồ: chạy trên điện thoại, không cần mạng, dữ liệu lưu trong máy.</p><p class="muted">Phiên bản 2.0</p>`);
    }];
  }
  function editWorkerBasic(w) {
    openSheet('Sửa thợ', `<label class="f">Tên</label><input id="wn" value="${esc(w.name)}">
      <label class="f">Chức vụ</label><input id="wp" value="${esc(w.position)}">
      <label class="f">Số điện thoại</label><input id="wph" type="tel" value="${esc(w.phone)}">
      <p class="hint">Lương ngày sửa trong từng công việc (Quản lý nhân viên).</p>
      <div class="actions"><button class="btn primary" id="ok">Lưu</button></div>`, (s) => ($('#ok', s).onclick = () => {
      const name = $('#wn', s).value.trim();
      if (!name) return toast('Nhập tên');
      Object.assign(w, { name, position: $('#wp', s).value.trim(), phone: $('#wph', s).value.trim() });
      closeSheet();
      rerender();
    }));
  }

  // ================= Khởi động =================
  db = load();
  save();
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

  // Cho phép kiểm thử
  window.__app = { statOf, jobStats, get db() { return db; }, migrateV1 };
})();
