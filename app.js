// Chấm công thợ hồ – toàn bộ dữ liệu lưu trong máy (localStorage), không cần mạng.
(function () {
  'use strict';

  // ---------- Dữ liệu ----------
  const KEY = 'chamcong_thoho_v1';

  function emptyDb() {
    return { version: 1, workers: [], sites: [], att: {}, adv: [], ui: {} };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyDb();
      return Object.assign(emptyDb(), JSON.parse(raw));
    } catch (e) {
      return emptyDb();
    }
  }

  let db = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      toast('Không lưu được! Bộ nhớ máy đầy?');
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- Ngày tháng ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (s, n) => {
    const d = parse(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
  };
  const today = () => ymd(new Date());
  const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const THU_DAI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dmy = (s) => {
    const d = parse(s);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  const dm = (s) => {
    const d = parse(s);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  };

  function weekRange(s) {
    const d = parse(s);
    const back = (d.getDay() + 6) % 7; // tuần bắt đầu thứ hai
    const from = addDays(s, -back);
    return [from, addDays(from, 6)];
  }
  function monthRange(s) {
    const d = parse(s);
    return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  }
  function daysBetween(from, to) {
    const out = [];
    for (let s = from; s <= to; s = addDays(s, 1)) out.push(s);
    return out;
  }

  // ---------- Tiền ----------
  const money = (n) => Math.round(n || 0).toLocaleString('vi-VN') + ' đ';
  const num = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('vi-VN');
  const digits = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0;

  // ---------- Tính lương ----------
  const attKey = (date, wid) => date + '|' + wid;
  const otRate = (w) => (w.otRate ? w.otRate : Math.round((w.rate || 0) / 8));

  function payroll(from, to, siteId) {
    const rows = new Map();
    const row = (w) => {
      if (!rows.has(w.id)) rows.set(w.id, { w, days: 0, ot: 0, wage: 0, adv: 0 });
      return rows.get(w.id);
    };
    const byId = new Map(db.workers.map((w) => [w.id, w]));
    for (const k in db.att) {
      const a = db.att[k];
      if (a.date < from || a.date > to) continue;
      if (siteId && a.siteId !== siteId) continue;
      const w = byId.get(a.workerId);
      if (!w) continue;
      const r = row(w);
      r.days += a.day;
      r.ot += a.ot || 0;
      r.wage += a.day * (w.rate || 0) + (a.ot || 0) * otRate(w);
    }
    for (const a of db.adv) {
      if (a.date < from || a.date > to) continue;
      const w = byId.get(a.workerId);
      if (!w) continue;
      row(w).adv += a.amount;
    }
    const list = [...rows.values()].sort((a, b) => a.w.name.localeCompare(b.w.name, 'vi'));
    for (const r of list) r.net = r.wage - r.adv;
    const total = list.reduce(
      (t, r) => ({ days: t.days + r.days, ot: t.ot + r.ot, wage: t.wage + r.wage, adv: t.adv + r.adv, net: t.net + r.net }),
      { days: 0, ot: 0, wage: 0, adv: 0, net: 0 }
    );
    return { list, total };
  }

  // ---------- Tiện ích giao diện ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const view = $('#view');
  const dlg = $('#dlg');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 1800);
  }

  function openDialog(html, onSubmit) {
    dlg.innerHTML = html;
    const form = $('form', dlg);
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.submitter && e.submitter.value === 'cancel') return dlg.close();
        if (onSubmit(new FormData(form), e.submitter && e.submitter.value) !== false) dlg.close();
      });
    }
    dlg.showModal();
  }

  function confirmBox(msg, okText, onOk) {
    openDialog(
      `<form><h2>${esc(msg)}</h2><div class="actions">
        <button class="btn" value="cancel">Thôi</button>
        <button class="btn primary" value="ok">${esc(okText)}</button></div></form>`,
      () => onOk()
    );
  }

  function moneyInputs(root) {
    root.querySelectorAll('input[data-money]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const n = digits(inp.value);
        inp.value = n ? n.toLocaleString('vi-VN') : '';
      });
    });
  }

  const activeWorkers = () =>
    db.workers.filter((w) => w.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const activeSites = () => db.sites.filter((s) => s.active !== false);
  const siteName = (id) => (db.sites.find((s) => s.id === id) || {}).name || '—';

  function siteOptions(selected, withAll) {
    const opts = withAll ? [`<option value="">Tất cả công trình</option>`] : [];
    const sites = db.sites.filter((s) => s.active !== false || s.id === selected);
    for (const s of sites) opts.push(`<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`);
    return opts.join('');
  }

  // ---------- Màn hình: Chấm công ----------
  const state = { date: today(), tab: 'chamcong', period: 'week', from: null, to: null, repSite: '' };

  function renderChamCong() {
    const workers = activeWorkers();
    const sites = activeSites();
    if (!db.ui.siteId || !sites.some((s) => s.id === db.ui.siteId)) db.ui.siteId = sites[0] ? sites[0].id : '';
    const siteId = db.ui.siteId;
    const d = parse(state.date);

    if (!workers.length || !sites.length) {
      view.innerHTML = `${installHint()}<div class="card empty">
        <p>Chưa có ${!workers.length ? 'thợ' : ''}${!workers.length && !sites.length ? ' và ' : ''}${!sites.length ? 'công trình' : ''}.</p>
        <button class="btn primary block" id="goManage">Vào Quản lý để thêm</button></div>`;
      $('#goManage').onclick = () => go('quanly');
      if ($('#hideInstall')) $('#hideInstall').onclick = () => { db.ui.hideInstall = true; save(); render(); };
      return;
    }

    let total = 0;
    const items = workers
      .map((w) => {
        const a = db.att[attKey(state.date, w.id)];
        const day = a ? a.day : null;
        const ot = a ? a.ot || 0 : 0;
        if (a) total += a.day;
        const other = a && a.siteId !== siteId ? `<small>ở ${esc(siteName(a.siteId))}</small>` : '';
        return `<div class="worker" data-w="${w.id}">
          <div class="name"><span>${esc(w.name)}</span>${other}</div>
          <div class="seg">
            <button data-v="1" class="${day === 1 ? 'on' : ''}">Cả ngày</button>
            <button data-v="0.5" class="${day === 0.5 ? 'on' : ''}">Nửa ngày</button>
            <button data-v="0" class="${day === 0 ? 'on' : ''}">Nghỉ</button>
          </div>
          <div class="ot">
            <span class="lbl">Tăng ca</span>
            <button data-ot="-1" aria-label="Bớt giờ">−</button>
            <span class="val">${num(ot)} giờ</span>
            <button data-ot="1" aria-label="Thêm giờ">+</button>
          </div>
        </div>`;
      })
      .join('');

    view.innerHTML = `${installHint()}
      <div class="card stack">
        <div class="datebar">
          <button class="btn" id="prev" aria-label="Hôm trước">‹</button>
          <div class="day">${THU_DAI[d.getDay()]}<small>${dmy(state.date)}${state.date === today() ? ' · hôm nay' : ''}</small></div>
          <button class="btn" id="next" aria-label="Hôm sau">›</button>
        </div>
        <input type="date" id="pick" value="${state.date}">
        <select id="site">${siteOptions(siteId)}</select>
      </div>
      <div class="card">
        <div class="row" style="margin-bottom:6px">
          <button class="btn primary" id="allFull">Cả đội đi làm</button>
        </div>
        ${items}
      </div>
      <div class="card summary"><span>Tổng công hôm nay</span><span>${num(total)} công</span></div>`;

    if ($('#hideInstall')) $('#hideInstall').onclick = () => { db.ui.hideInstall = true; save(); render(); };
    $('#prev').onclick = () => { state.date = addDays(state.date, -1); render(); };
    $('#next').onclick = () => { state.date = addDays(state.date, 1); render(); };
    $('#pick').onchange = (e) => { if (e.target.value) { state.date = e.target.value; render(); } };
    $('#site').onchange = (e) => { db.ui.siteId = e.target.value; save(); render(); };
    $('#allFull').onclick = () => {
      for (const w of workers) {
        const k = attKey(state.date, w.id);
        if (!db.att[k]) db.att[k] = { date: state.date, workerId: w.id, siteId, day: 1, ot: 0 };
      }
      save();
      render();
      toast('Đã chấm cả ngày cho thợ chưa chấm');
    };

    view.querySelectorAll('.worker').forEach((el) => {
      const wid = el.dataset.w;
      const k = attKey(state.date, wid);
      el.querySelectorAll('.seg button').forEach((b) => {
        b.onclick = () => {
          const v = Number(b.dataset.v);
          const a = db.att[k];
          if (a && a.day === v && a.siteId === siteId) {
            delete db.att[k]; // bấm lại để bỏ chấm
          } else {
            db.att[k] = { date: state.date, workerId: wid, siteId, day: v, ot: a ? a.ot || 0 : 0 };
          }
          save();
          render();
        };
      });
      el.querySelectorAll('[data-ot]').forEach((b) => {
        b.onclick = () => {
          const a = db.att[k] || { date: state.date, workerId: wid, siteId, day: 1, ot: 0 };
          a.ot = Math.max(0, (a.ot || 0) + Number(b.dataset.ot) * 0.5);
          a.siteId = siteId;
          db.att[k] = a;
          save();
          render();
        };
      });
    });
  }

  // ---------- Màn hình: Ứng tiền ----------
  function renderUng() {
    const workers = activeWorkers();
    if (!workers.length) {
      view.innerHTML = `<div class="card empty"><p>Chưa có thợ.</p><button class="btn primary block" id="goManage">Vào Quản lý để thêm</button></div>`;
      $('#goManage').onclick = () => go('quanly');
      return;
    }
    const recent = [...db.adv].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 40);
    const byId = new Map(db.workers.map((w) => [w.id, w]));
    view.innerHTML = `
      <form class="card" id="advForm">
        <h2>Ghi tiền ứng</h2>
        <label for="aw">Thợ</label>
        <select id="aw" name="w" required>
          <option value="">— Chọn thợ —</option>
          ${workers.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
        </select>
        <label for="aa">Số tiền</label>
        <input id="aa" name="amount" inputmode="numeric" data-money placeholder="Ví dụ 500.000" autocomplete="off">
        <div class="quick">
          <button type="button" data-q="200000">200 nghìn</button>
          <button type="button" data-q="500000">500 nghìn</button>
          <button type="button" data-q="1000000">1 triệu</button>
        </div>
        <label for="ad">Ngày</label>
        <input id="ad" type="date" name="date" value="${today()}">
        <label for="an">Ghi chú</label>
        <input id="an" name="note" placeholder="(không bắt buộc)">
        <div style="margin-top:14px"><button class="btn primary block">Lưu tiền ứng</button></div>
      </form>
      <div class="card">
        <h2>Đã ứng gần đây</h2>
        ${
          recent.length
            ? `<ul class="list">${recent
                .map(
                  (a) => `<li><div class="main"><b>${esc((byId.get(a.workerId) || {}).name || '?')}</b>
                  <small>${dmy(a.date)}${a.note ? ' · ' + esc(a.note) : ''}</small></div>
                  <span class="amt">${money(a.amount)}</span>
                  <button class="x" data-del="${a.id}" aria-label="Xóa">✕</button></li>`
                )
                .join('')}</ul>`
            : '<p class="empty">Chưa có.</p>'
        }
      </div>`;
    const form = $('#advForm');
    moneyInputs(form);
    form.querySelectorAll('[data-q]').forEach((b) => {
      b.onclick = () => ($('#aa').value = Number(b.dataset.q).toLocaleString('vi-VN'));
    });
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const amount = digits(fd.get('amount'));
      if (!fd.get('w')) return toast('Chọn thợ trước');
      if (!amount) return toast('Nhập số tiền');
      db.adv.push({ id: uid(), workerId: fd.get('w'), amount, date: fd.get('date') || today(), note: String(fd.get('note') || '').trim() });
      save();
      toast('Đã lưu ' + money(amount));
      render();
    };
    view.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () =>
        confirmBox('Xóa khoản ứng này?', 'Xóa', () => {
          db.adv = db.adv.filter((a) => a.id !== b.dataset.del);
          save();
          render();
        });
    });
  }

  // ---------- Màn hình: Bảng lương ----------
  function currentRange() {
    const t = today();
    switch (state.period) {
      case 'week': return weekRange(t);
      case 'lastweek': return weekRange(addDays(weekRange(t)[0], -1));
      case 'month': return monthRange(t);
      case 'lastmonth': return monthRange(addDays(monthRange(t)[0], -1));
      default: return [state.from || monthRange(t)[0], state.to || t];
    }
  }

  function renderBaoCao() {
    const [from, to] = currentRange();
    const { list, total } = payroll(from, to, state.repSite);
    const chip = (v, t) => `<button data-p="${v}" class="${state.period === v ? 'on' : ''}">${t}</button>`;
    view.innerHTML = `
      <div class="card stack">
        <div class="chips">${chip('week', 'Tuần này')}${chip('lastweek', 'Tuần trước')}</div>
        <div class="chips">${chip('month', 'Tháng này')}${chip('lastmonth', 'Tháng trước')}${chip('custom', 'Tự chọn')}</div>
        ${
          state.period === 'custom'
            ? `<div class="row"><input type="date" id="from" value="${from}"><input type="date" id="to" value="${to}"></div>`
            : ''
        }
        <select id="repSite">${siteOptions(state.repSite, true)}</select>
        <div class="muted">Từ ${dmy(from)} đến ${dmy(to)}</div>
      </div>
      <div class="card">
        ${
          list.length
            ? `${list
              .map(
                (r) => `<div class="payrow" data-w="${r.w.id}">
                <div class="name"><b>${esc(r.w.name)}</b><span>${num(r.days)} công${r.ot ? ` +${num(r.ot)}h TC` : ''}</span></div>
                <div class="line"><span>Tiền công</span><span>${money(r.wage)}</span></div>
                ${r.adv ? `<div class="line"><span>Đã ứng</span><span class="neg">−${money(r.adv)}</span></div>` : ''}
                <div class="line net ${r.net < 0 ? 'neg' : ''}"><span>Còn lại</span><span>${money(r.net)}</span></div>
              </div>`
              )
              .join('')}
            <div class="payrow total">
              <div class="name"><b>Tổng cả đội</b><span>${num(total.days)} công${total.ot ? ` +${num(total.ot)}h TC` : ''}</span></div>
              <div class="line"><span>Tiền công</span><span>${money(total.wage)}</span></div>
              <div class="line"><span>Đã ứng</span><span>−${money(total.adv)}</span></div>
              <div class="line net"><span>Còn phải trả</span><span>${money(total.net)}</span></div>
            </div>
          <p class="muted" style="font-size:.85rem">Bấm vào tên thợ để xem từng ngày.${state.repSite ? ' Tiền ứng tính chung mọi công trình.' : ''}</p>`
            : '<p class="empty">Không có công hay tiền ứng trong khoảng này.</p>'
        }
      </div>
      <button class="btn primary block" id="xls" ${list.length ? '' : 'disabled'}>⬇ Xuất file Excel</button>`;

    view.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => {
      if (b.dataset.p === 'custom' && state.period !== 'custom') [state.from, state.to] = currentRange();
      state.period = b.dataset.p;
      render();
    }));
    if ($('#from')) {
      $('#from').onchange = (e) => { state.from = e.target.value; render(); };
      $('#to').onchange = (e) => { state.to = e.target.value; render(); };
    }
    $('#repSite').onchange = (e) => { state.repSite = e.target.value; render(); };
    view.querySelectorAll('.payrow[data-w]').forEach((tr) => (tr.onclick = () => showWorkerDetail(tr.dataset.w, from, to)));
    $('#xls').onclick = () => exportExcel(from, to, state.repSite);
  }

  function showWorkerDetail(wid, from, to) {
    const w = db.workers.find((x) => x.id === wid);
    const lines = [];
    for (const s of daysBetween(from, to)) {
      const a = db.att[attKey(s, wid)];
      if (a && (!state.repSite || a.siteId === state.repSite)) {
        const label = a.day === 1 ? 'Cả ngày' : a.day === 0.5 ? 'Nửa ngày' : 'Nghỉ';
        lines.push(`<li><div class="main"><b>${THU[parse(s).getDay()]} ${dm(s)} · ${label}${a.ot ? ` +${num(a.ot)}h` : ''}</b>
          <small>${esc(siteName(a.siteId))}</small></div>
          <span class="amt">${money(a.day * (w.rate || 0) + (a.ot || 0) * otRate(w))}</span></li>`);
      }
      for (const v of db.adv.filter((v) => v.workerId === wid && v.date === s)) {
        lines.push(`<li><div class="main"><b>${THU[parse(s).getDay()]} ${dm(s)} · Ứng tiền</b><small>${esc(v.note || '')}</small></div>
          <span class="amt neg">−${money(v.amount)}</span></li>`);
      }
    }
    openDialog(
      `<form><h2>${esc(w.name)}</h2>
        <p class="muted">${money(w.rate)}/công · tăng ca ${money(otRate(w))}/giờ</p>
        <ul class="list">${lines.join('') || '<li class="empty">Không có gì.</li>'}</ul>
        <div class="actions"><button class="btn primary" value="cancel">Đóng</button></div></form>`,
      () => {}
    );
  }

  function exportExcel(from, to, siteId) {
    const { list, total } = payroll(from, to, siteId);
    const days = daysBetween(from, to);
    const B = (v) => ({ v, bold: true });
    const M = (v) => ({ v: Math.round(v), money: true });
    const BM = (v) => ({ v: Math.round(v), money: true, bold: true });
    const scope = siteId ? siteName(siteId) : 'Tất cả công trình';

    const sheet1 = [
      [B('BẢNG LƯƠNG THỢ')],
      [`Từ ${dmy(from)} đến ${dmy(to)}`],
      [`Công trình: ${scope}`],
      [],
      ['STT', 'Thợ', 'Đơn giá/công', 'Số công', 'Giờ tăng ca', 'Tiền tăng ca/giờ', 'Tiền công', 'Đã ứng', 'Còn lại'].map(B),
      ...list.map((r, i) => [i + 1, r.w.name, M(r.w.rate || 0), r.days, r.ot, M(otRate(r.w)), M(r.wage), M(r.adv), BM(r.net)]),
      [B('Tổng'), '', '', B(total.days), B(total.ot), '', BM(total.wage), BM(total.adv), BM(total.net)],
    ];

    const sheet2 = [
      [B('BẢNG CÔNG')],
      [`Từ ${dmy(from)} đến ${dmy(to)} · ${scope}`, ...days.map(() => '')],
      [B('Thợ'), ...days.map((s) => B(`${THU[parse(s).getDay()]} ${dm(s)}`)), B('Tổng công'), B('Giờ TC')],
      ...list.map((r) => {
        const cells = days.map((s) => {
          const a = db.att[attKey(s, r.w.id)];
          if (!a || (siteId && a.siteId !== siteId)) return '';
          if (a.ot) return `${num(a.day)} +${num(a.ot)}h`;
          return a.day;
        });
        return [r.w.name, ...cells, B(r.days), r.ot];
      }),
    ];

    const byId = new Map(db.workers.map((w) => [w.id, w]));
    const advs = db.adv.filter((a) => a.date >= from && a.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    const sheet3 = [
      [B('TIỀN ỨNG')],
      [`Từ ${dmy(from)} đến ${dmy(to)}`],
      [],
      ['Ngày', 'Thợ', 'Số tiền', 'Ghi chú'].map(B),
      ...advs.map((a) => [dmy(a.date), (byId.get(a.workerId) || {}).name || '?', M(a.amount), a.note || '']),
      [B('Tổng'), '', BM(advs.reduce((s, a) => s + a.amount, 0)), ''],
    ];

    const blob = XLSX.build([
      { name: 'Bảng lương', rows: sheet1, widths: [6, 24, 14, 10, 12, 16, 16, 14, 16] },
      { name: 'Bảng công', rows: sheet2, widths: [24, ...days.map(() => 10), 11, 9] },
      { name: 'Tiền ứng', rows: sheet3, widths: [12, 24, 14, 30] },
    ]);
    download(blob, `bang-luong_${from}_${to}.xlsx`);
  }

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  function download(blob, filename) {
    // iPhone: mở bảng Chia sẻ để lưu vào Tệp hoặc gửi Zalo; tải kiểu thường hay bị lỗi khi chạy từ màn hình chính.
    if (isIOS && navigator.canShare) {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: filename }).catch((e) => {
          if (e.name !== 'AbortError') saveLink(blob, filename);
        });
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

  // iPhone tự xóa dữ liệu của trang web không mở trong 7 ngày, trừ khi đã thêm vào màn hình chính.
  function installHint() {
    if (!isIOS || isStandalone() || db.ui.hideInstall) return '';
    return `<div class="card install" id="install">
      <p><b>Cài app lên màn hình chính</b> để mở nhanh và <b>không bị mất dữ liệu</b>:</p>
      <p>1. Bấm nút <b>Chia sẻ</b> <span aria-hidden="true">⬆️</span> ở thanh dưới Safari<br>2. Chọn <b>Thêm vào MH chính</b></p>
      <button class="btn block" id="hideInstall">Đã hiểu</button></div>`;
  }

  // ---------- Màn hình: Quản lý ----------
  function renderQuanLy() {
    const workers = [...db.workers].sort(
      (a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name, 'vi')
    );
    const sites = [...db.sites].sort((a, b) => (a.active === false) - (b.active === false));
    view.innerHTML = `
      <div class="card">
        <h2>Thợ (${activeWorkers().length})</h2>
        ${
          workers.length
            ? `<ul class="list">${workers
                .map(
                  (w) => `<li data-w="${w.id}"><div class="main"><b>${esc(w.name)}${w.active === false ? ' <small>(nghỉ làm)</small>' : ''}</b>
                  <small>${money(w.rate)}/công · TC ${money(otRate(w))}/giờ${w.phone ? ' · ' + esc(w.phone) : ''}</small></div>
                  <span class="muted">›</span></li>`
                )
                .join('')}</ul>`
            : '<p class="empty">Chưa có thợ nào.</p>'
        }
        <button class="btn primary block" id="addW">＋ Thêm thợ</button>
      </div>
      <div class="card">
        <h2>Công trình (${activeSites().length})</h2>
        ${
          sites.length
            ? `<ul class="list">${sites
                .map(
                  (s) => `<li data-s="${s.id}"><div class="main"><b>${esc(s.name)}${s.active === false ? ' <small>(đã xong)</small>' : ''}</b>
                  ${s.address ? `<small>${esc(s.address)}</small>` : ''}</div><span class="muted">›</span></li>`
                )
                .join('')}</ul>`
            : '<p class="empty">Chưa có công trình nào.</p>'
        }
        <button class="btn primary block" id="addS">＋ Thêm công trình</button>
      </div>
      <div class="card stack">
        <h2>Sao lưu dữ liệu</h2>
        <p class="muted" style="margin:0">Dữ liệu chỉ nằm trong máy này. Nên sao lưu thường xuyên, hoặc để chuyển sang máy khác.</p>
        <button class="btn block" id="backup">⬇ Tải file sao lưu</button>
        <label class="btn block" style="margin:0">⬆ Khôi phục từ file<input type="file" id="restore" accept=".json,application/json" hidden></label>
      </div>`;

    $('#addW').onclick = () => editWorker();
    $('#addS').onclick = () => editSite();
    view.querySelectorAll('[data-w]').forEach((li) => (li.onclick = () => editWorker(db.workers.find((w) => w.id === li.dataset.w))));
    view.querySelectorAll('[data-s]').forEach((li) => (li.onclick = () => editSite(db.sites.find((s) => s.id === li.dataset.s))));
    $('#backup').onclick = () =>
      download(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }), `cham-cong_sao-luu_${today()}.json`);
    $('#restore').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then((txt) => {
        let data;
        try {
          data = JSON.parse(txt);
          if (!Array.isArray(data.workers) || !data.att) throw new Error();
        } catch (err) {
          return toast('File không đúng định dạng');
        }
        confirmBox(`Thay toàn bộ dữ liệu bằng file này (${data.workers.length} thợ)?`, 'Khôi phục', () => {
          db = Object.assign(emptyDb(), data);
          save();
          render();
          toast('Đã khôi phục');
        });
      });
    };
  }

  function editWorker(w) {
    const isNew = !w;
    w = w || { name: '', phone: '', rate: 0, otRate: 0, active: true };
    openDialog(
      `<form><h2>${isNew ? 'Thêm thợ' : 'Sửa thợ'}</h2>
        <label>Tên thợ</label><input name="name" value="${esc(w.name)}" required autocomplete="off">
        <label>Tiền công 1 ngày</label><input name="rate" inputmode="numeric" data-money value="${w.rate ? w.rate.toLocaleString('vi-VN') : ''}" placeholder="Ví dụ 400.000" required>
        <label>Tiền tăng ca 1 giờ</label><input name="otRate" inputmode="numeric" data-money value="${w.otRate ? w.otRate.toLocaleString('vi-VN') : ''}" placeholder="Để trống = tiền ngày ÷ 8">
        <label>Số điện thoại</label><input name="phone" type="tel" value="${esc(w.phone)}">
        ${!isNew ? `<label class="row" style="gap:10px"><input type="checkbox" name="active" style="width:28px;height:28px;flex:0" ${w.active !== false ? 'checked' : ''}> <span>Đang làm</span></label>` : ''}
        <div class="actions"><button class="btn" value="cancel" formnovalidate>Thôi</button><button class="btn primary" value="ok">Lưu</button></div></form>`,
      (fd) => {
        const name = String(fd.get('name')).trim();
        const rate = digits(fd.get('rate'));
        if (!name || !rate) { toast('Cần tên và tiền công'); return false; }
        Object.assign(w, { name, rate, otRate: digits(fd.get('otRate')), phone: String(fd.get('phone') || '').trim() });
        if (!isNew) w.active = fd.get('active') === 'on';
        if (isNew) db.workers.push(Object.assign(w, { id: uid() }));
        save();
        render();
      }
    );
    moneyInputs(dlg);
  }

  function editSite(s) {
    const isNew = !s;
    s = s || { name: '', address: '', active: true };
    openDialog(
      `<form><h2>${isNew ? 'Thêm công trình' : 'Sửa công trình'}</h2>
        <label>Tên công trình</label><input name="name" value="${esc(s.name)}" required autocomplete="off" placeholder="Ví dụ: Nhà anh Tư - Q.7">
        <label>Địa chỉ</label><input name="address" value="${esc(s.address)}">
        ${!isNew ? `<label class="row" style="gap:10px"><input type="checkbox" name="active" style="width:28px;height:28px;flex:0" ${s.active !== false ? 'checked' : ''}> <span>Đang thi công</span></label>` : ''}
        <div class="actions"><button class="btn" value="cancel" formnovalidate>Thôi</button><button class="btn primary" value="ok">Lưu</button></div></form>`,
      (fd) => {
        const name = String(fd.get('name')).trim();
        if (!name) return false;
        Object.assign(s, { name, address: String(fd.get('address') || '').trim() });
        if (!isNew) s.active = fd.get('active') === 'on';
        if (isNew) db.sites.push(Object.assign(s, { id: uid() }));
        save();
        render();
      }
    );
  }

  // ---------- Điều hướng ----------
  const TITLES = { chamcong: 'Chấm công', ung: 'Ứng tiền', baocao: 'Bảng lương', quanly: 'Quản lý' };
  const RENDER = { chamcong: renderChamCong, ung: renderUng, baocao: renderBaoCao, quanly: renderQuanLy };

  function render() {
    $('#title').textContent = TITLES[state.tab];
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
    RENDER[state.tab]();
  }
  function go(tab) {
    state.tab = tab;
    window.scrollTo(0, 0);
    render();
  }
  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));

  render();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Cho phép kiểm thử
  window.__app = { payroll, weekRange, monthRange, get db() { return db; } };
})();
