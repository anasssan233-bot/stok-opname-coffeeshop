let CURRENT_USER = null;
let CABANG_LIST = [];

const root = document.getElementById('root');

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function fmtNum(n) {
  return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function showToast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

async function boot() {
  try {
    CURRENT_USER = await apiGet('/auth/me');
  } catch (e) {
    window.location.href = '/login.html';
    return;
  }
  CABANG_LIST = await apiGet('/cabang');
  renderShell();
  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.hash = '#/dashboard';
  renderRoute();
}

function navItems() {
  const items = [
    { hash: '#/dashboard', label: 'Dashboard', ic: '::' },
    { hash: '#/opname/baru', label: 'Input Opname', ic: '+' },
    { hash: '#/riwayat', label: 'Riwayat Opname', ic: '~' }
  ];
  if (CURRENT_USER.role === 'admin') {
    items.push({ hash: '#/master', label: 'Master Data', ic: '#' });
  }
  return items;
}

function renderShell() {
  root.innerHTML = `
    <div class="app">
      <button class="menu-toggle" id="menuToggle">☰ MENU</button>
      <aside class="sidebar" id="sidebar">
        <div class="brand">☕ Stok Opname</div>
        <div class="brand-sub">COFFEE SHOP &middot; 3 CABANG</div>
        <nav id="navList"></nav>
        <div class="sidebar-foot">
          <div class="who">${escapeHtml(CURRENT_USER.nama)}</div>
          <div class="who-role">${CURRENT_USER.role === 'admin' ? 'ADMIN PUSAT' : escapeHtml(CURRENT_USER.cabangNama || '')}</div>
          <button class="btn ghost block" id="logoutBtn" style="color:#F3E9D8;border-color:rgba(255,255,255,0.25)">Keluar</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>
  `;
  const navList = document.getElementById('navList');
  navList.innerHTML = navItems().map(n => `
    <a href="${n.hash}" class="nav-item" data-hash="${n.hash}"><span class="ic">${n.ic}</span>${n.label}</a>
  `).join('');
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiPost('/auth/logout', {});
    window.location.href = '/login.html';
  });
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function highlightNav() {
  const base = '#/' + (location.hash.split('/')[1] || 'dashboard');
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.hash === base);
  });
  document.getElementById('sidebar').classList.remove('open');
}

function renderRoute() {
  highlightNav();
  const hash = location.hash || '#/dashboard';
  const parts = hash.replace('#/', '').split('/');
  if (parts[0] === 'dashboard') return renderDashboard();
  if (parts[0] === 'opname' && parts[1] === 'baru') return renderOpnameForm();
  if (parts[0] === 'riwayat' && parts[1]) return renderRiwayatDetail(parts[1]);
  if (parts[0] === 'riwayat') return renderRiwayat();
  if (parts[0] === 'master') return renderMaster();
  return renderDashboard();
}

/* ============ DASHBOARD ============ */
async function renderDashboard() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="topbar"><div><h1>Dashboard</h1><div class="desc">Memuat ringkasan...</div></div></div>`;
  const s = await apiGet('/dashboard/summary');
  const isAdmin = CURRENT_USER.role === 'admin';

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Dashboard</h1>
        <div class="desc">${isAdmin ? 'Rekap stok opname semua cabang' : 'Ringkasan stok opname cabangmu'}</div>
      </div>
    </div>
    <div class="grid cols-3">
      <div class="card stat-card">
        <div class="label">Total Opname Tercatat</div>
        <div class="value mono">${s.totalOpname}</div>
        <div class="sub">${isAdmin ? 'seluruh cabang' : 'cabang ini'}</div>
      </div>
      <div class="card stat-card">
        <div class="label">Cabang Aktif</div>
        <div class="value mono">${s.perCabang.length}</div>
        <div class="sub">terhubung ke sistem</div>
      </div>
      <div class="card stat-card">
        <div class="label">Item Sering Selisih</div>
        <div class="value mono">${s.topSelisih.length}</div>
        <div class="sub">butuh perhatian</div>
      </div>
    </div>

    <div class="section-title">Ringkasan per Cabang</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cabang</th><th>Opname Tercatat</th><th>Opname Terakhir</th><th>Beda Item (terakhir)</th><th>Total Selisih (terakhir)</th></tr></thead>
        <tbody>
          ${s.perCabang.length === 0 ? `<tr class="empty-row"><td colspan="5">Belum ada data</td></tr>` :
            s.perCabang.map(c => `
              <tr>
                <td><strong>${escapeHtml(c.cabangNama)}</strong></td>
                <td class="mono">${c.jumlahOpname}</td>
                <td class="mono">${fmtDate(c.tanggalTerakhir)}</td>
                <td class="mono">${c.itemBedaTerakhir}</td>
                <td class="mono">${fmtNum(c.totalSelisihTerakhir)}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section-title">Item Paling Sering Selisih</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Satuan</th><th>Total Selisih (absolut)</th><th>Muncul Berapa Kali</th></tr></thead>
        <tbody>
          ${s.topSelisih.length === 0 ? `<tr class="empty-row"><td colspan="4">Belum ada selisih tercatat — bagus!</td></tr>` :
            s.topSelisih.map(i => `
              <tr>
                <td>${escapeHtml(i.itemNama)}</td>
                <td class="mono">${escapeHtml(i.satuan)}</td>
                <td class="mono">${fmtNum(i.totalSelisihAbs)}</td>
                <td class="mono">${i.kejadian}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ============ INPUT OPNAME ============ */
async function renderOpnameForm() {
  const main = document.getElementById('main');
  const isAdmin = CURRENT_USER.role === 'admin';
  const cabangOptions = isAdmin
    ? CABANG_LIST.map(c => `<option value="${c.id}">${escapeHtml(c.nama)}</option>`).join('')
    : '';

  main.innerHTML = `
    <div class="topbar">
      <div><h1>Input Opname</h1><div class="desc">Catat stok fisik hari ini dan bandingkan dengan stok sistem. Daftar item menyesuaikan cabang yang dipilih.</div></div>
    </div>
    <div class="card">
      <div class="form-row">
        ${isAdmin ? `
        <div class="field">
          <label>Cabang</label>
          <select id="cabangSelect">${cabangOptions}</select>
        </div>` : `
        <div class="field">
          <label>Cabang</label>
          <input value="${escapeHtml(CURRENT_USER.cabangNama || '')}" disabled />
        </div>`}
        <div class="field">
          <label>Tanggal Opname</label>
          <input type="date" id="tanggalInput" value="${todayStr()}" />
        </div>
      </div>

      <div class="item-col-head">
        <div>Item</div><div>Stok Sistem</div><div>Stok Fisik</div><div>Selisih</div><div>Keterangan</div>
      </div>
      <div id="itemRows"><div style="padding:16px 0;color:var(--ink-soft);font-style:italic">Memuat daftar item...</div></div>

      <div class="field" style="margin-top:18px">
        <label>Catatan Umum (opsional)</label>
        <textarea id="catatanUmum" rows="2" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card);font-size:14px;"></textarea>
      </div>

      <button class="btn" id="submitOpname">Simpan Opname</button>
      <div id="formMsg" style="margin-top:12px"></div>
    </div>
  `;

  const itemRows = document.getElementById('itemRows');

  async function loadItemsForCurrentCabang() {
    const cabangId = isAdmin ? document.getElementById('cabangSelect').value : CURRENT_USER.cabangId;
    itemRows.innerHTML = `<div style="padding:16px 0;color:var(--ink-soft);font-style:italic">Memuat daftar item...</div>`;
    const items = await apiGet('/items?cabangId=' + encodeURIComponent(cabangId));
    if (items.length === 0) {
      itemRows.innerHTML = `<div style="padding:16px 0;color:var(--ink-soft);font-style:italic">Cabang ini belum punya daftar item. Tambahkan lewat Master Data &gt; Item Stok.</div>`;
      return;
    }
    itemRows.innerHTML = items.map(it => `
      <div class="opname-item-row" data-item-id="${it.id}">
        <div>
          <div class="item-name">${escapeHtml(it.nama)}</div>
          <div class="item-unit">${escapeHtml(it.kategori)}</div>
        </div>
        <div><input type="number" step="any" class="stok-sistem" placeholder="0" /></div>
        <div><input type="number" step="any" class="stok-fisik" placeholder="0" /></div>
        <div class="selisih-badge zero" data-selisih>0</div>
        <div><input type="text" class="keterangan" placeholder="—" /></div>
      </div>
    `).join('');

    itemRows.querySelectorAll('.opname-item-row').forEach(row => {
      const sistem = row.querySelector('.stok-sistem');
      const fisik = row.querySelector('.stok-fisik');
      const badge = row.querySelector('[data-selisih]');
      function recalc() {
        const s = parseFloat(sistem.value) || 0;
        const f = parseFloat(fisik.value) || 0;
        const d = Number((f - s).toFixed(3));
        badge.textContent = (d > 0 ? '+' : '') + fmtNum(d);
        badge.className = 'selisih-badge ' + (d === 0 ? 'zero' : d > 0 ? 'plus' : 'minus');
      }
      sistem.addEventListener('input', recalc);
      fisik.addEventListener('input', recalc);
    });
  }

  if (isAdmin) {
    document.getElementById('cabangSelect').addEventListener('change', loadItemsForCurrentCabang);
  }
  await loadItemsForCurrentCabang();

  document.getElementById('submitOpname').addEventListener('click', async () => {
    const tanggal = document.getElementById('tanggalInput').value;
    const cabangSelect = document.getElementById('cabangSelect');
    const cabangId = isAdmin ? cabangSelect.value : undefined;
    const msgBox = document.getElementById('formMsg');
    msgBox.innerHTML = '';

    if (!tanggal) { msgBox.innerHTML = `<div class="error-msg">Tanggal wajib diisi</div>`; return; }

    const details = [];
    itemRows.querySelectorAll('.opname-item-row').forEach(row => {
      const itemId = row.dataset.itemId;
      const sistem = row.querySelector('.stok-sistem').value;
      const fisik = row.querySelector('.stok-fisik').value;
      const ket = row.querySelector('.keterangan').value;
      if (sistem === '' && fisik === '') return; // skip item kosong
      details.push({
        itemId,
        stokSistem: parseFloat(sistem) || 0,
        stokFisik: parseFloat(fisik) || 0,
        keterangan: ket
      });
    });

    if (details.length === 0) {
      msgBox.innerHTML = `<div class="error-msg">Isi minimal satu item stok sebelum menyimpan</div>`;
      return;
    }

    try {
      await apiPost('/opname', {
        cabangId, tanggal, details,
        catatan: document.getElementById('catatanUmum').value
      });
      showToast('Opname berhasil disimpan');
      location.hash = '#/riwayat';
    } catch (e) {
      msgBox.innerHTML = `<div class="error-msg">${escapeHtml(e.message)}</div>`;
    }
  });
}

/* ============ RIWAYAT (LIST) ============ */
async function renderRiwayat() {
  const main = document.getElementById('main');
  const isAdmin = CURRENT_USER.role === 'admin';
  main.innerHTML = `
    <div class="topbar">
      <div><h1>Riwayat Opname</h1><div class="desc">Daftar semua catatan stok opname${isAdmin ? ' (semua cabang)' : ''}.</div></div>
    </div>
    <div class="toolbar">
      ${isAdmin ? `<select id="filterCabang"><option value="">Semua Cabang</option>${CABANG_LIST.map(c => `<option value="${c.id}">${escapeHtml(c.nama)}</option>`).join('')}</select>` : ''}
      <input type="date" id="filterFrom" />
      <input type="date" id="filterTo" />
      <button class="btn ghost" id="filterBtn">Terapkan Filter</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Tanggal</th>${isAdmin ? '<th>Cabang</th>' : ''}<th>Diinput Oleh</th><th>Jml Item</th><th>Item Beda</th><th>Status</th><th></th>
        </tr></thead>
        <tbody id="riwayatBody"><tr class="empty-row"><td colspan="6">Memuat...</td></tr></tbody>
      </table>
    </div>
  `;

  async function load() {
    const params = new URLSearchParams();
    if (isAdmin) {
      const cb = document.getElementById('filterCabang').value;
      if (cb) params.set('cabangId', cb);
    }
    const from = document.getElementById('filterFrom').value;
    const to = document.getElementById('filterTo').value;
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const list = await apiGet('/opname?' + params.toString());
    const body = document.getElementById('riwayatBody');
    if (list.length === 0) {
      body.innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada catatan opname</td></tr>`;
      return;
    }
    body.innerHTML = list.map(o => `
      <tr>
        <td class="mono">${fmtDate(o.tanggal)}</td>
        ${isAdmin ? `<td>${escapeHtml(o.cabangNama)}</td>` : ''}
        <td>${escapeHtml(o.userNama)}</td>
        <td class="mono">${o.jumlahItem}</td>
        <td class="mono">${o.jumlahBeda}</td>
        <td>${o.jumlahBeda === 0
          ? `<span class="stamp good">Cocok</span>`
          : `<span class="stamp bad">Selisih</span>`}</td>
        <td><a href="#/riwayat/${o.id}" class="link-btn">Lihat →</a></td>
      </tr>
    `).join('');
  }

  document.getElementById('filterBtn').addEventListener('click', load);
  load();
}

/* ============ RIWAYAT DETAIL ============ */
async function renderRiwayatDetail(id) {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="topbar"><h1>Detail Opname</h1></div><div class="card">Memuat...</div>`;
  let o;
  try {
    o = await apiGet('/opname/' + id);
  } catch (e) {
    main.innerHTML = `<div class="topbar"><h1>Detail Opname</h1></div><div class="card error-msg">${escapeHtml(e.message)}</div>`;
    return;
  }
  const jumlahBeda = o.details.filter(d => d.selisih !== 0).length;

  main.innerHTML = `
    <div class="topbar">
      <div><h1>Detail Opname</h1><div class="desc"><a href="#/riwayat" class="link-btn">← Kembali ke riwayat</a></div></div>
      ${jumlahBeda === 0 ? `<span class="stamp good">Semua Cocok</span>` : `<span class="stamp bad">${jumlahBeda} Item Selisih</span>`}
    </div>
    <div class="toolbar">
      <button class="btn ghost" id="btnPrint58">🖨️ Cetak Struk (58mm)</button>
      <button class="btn ghost" id="btnDownloadPdf">⬇ Download PDF</button>
    </div>
    <div class="card detail-panel">
      <div class="detail-meta">
        <div><div class="k">Cabang</div><div class="v">${escapeHtml(o.cabangNama)}</div></div>
        <div><div class="k">Tanggal</div><div class="v">${fmtDate(o.tanggal)}</div></div>
        <div><div class="k">Diinput Oleh</div><div class="v">${escapeHtml(o.userNama)}</div></div>
        <div><div class="k">Dicatat Pada</div><div class="v">${new Date(o.createdAt).toLocaleString('id-ID')}</div></div>
      </div>
      ${o.catatan ? `<div class="card" style="background:var(--paper-dark);margin-bottom:16px"><strong>Catatan:</strong> ${escapeHtml(o.catatan)}</div>` : ''}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Satuan</th><th>Stok Sistem</th><th>Stok Fisik</th><th>Selisih</th><th>Keterangan</th></tr></thead>
          <tbody>
            ${o.details.map(d => `
              <tr>
                <td>${escapeHtml(d.itemNama)}</td>
                <td class="mono">${escapeHtml(d.satuan)}</td>
                <td class="mono">${fmtNum(d.stokSistem)}</td>
                <td class="mono">${fmtNum(d.stokFisik)}</td>
                <td class="mono ${d.selisih === 0 ? '' : d.selisih > 0 ? '' : ''}" style="color:${d.selisih === 0 ? 'var(--ink-soft)' : d.selisih > 0 ? 'var(--good)' : 'var(--bad)'};font-weight:700">
                  ${d.selisih > 0 ? '+' : ''}${fmtNum(d.selisih)}
                </td>
                <td>${escapeHtml(d.keterangan) || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btnDownloadPdf').addEventListener('click', () => {
    window.open('/api/opname/' + o.id + '/pdf', '_blank');
  });
  document.getElementById('btnPrint58').addEventListener('click', () => printReceipt58mm(o));
}

/* ============ CETAK STRUK 58MM (browser print, untuk printer kasir) ============ */
function printReceipt58mm(o) {
  const totalBeda = o.details.filter(d => d.selisih !== 0).length;
  const itemsHtml = o.details.map((d, idx) => `
    <div class="ritem">
      <div class="rname">${idx + 1}. ${escapeHtml(d.itemNama)}</div>
      <div class="rrow">Sis: ${fmtNum(d.stokSistem)}  Fis: ${fmtNum(d.stokFisik)}  Sel: ${d.selisih > 0 ? '+' : ''}${fmtNum(d.selisih)} ${escapeHtml(d.satuan)}</div>
      ${d.keterangan ? `<div class="rrow">Ket: ${escapeHtml(d.keterangan)}</div>` : ''}
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
    <meta charset="UTF-8" />
    <title>Struk Opname</title>
    <style>
      @page { size: 58mm auto; margin: 2mm; }
      * { box-sizing: border-box; }
      body {
        width: 54mm; margin: 0; padding: 0;
        font-family: 'Courier New', Courier, monospace;
        font-size: 11px; line-height: 1.35; color: #000;
      }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
      .meta div { margin-bottom: 1px; }
      .ritem { margin-bottom: 5px; }
      .rname { font-weight: 700; }
      .rrow { padding-left: 2px; }
      .footer { margin-top: 6px; }
    </style>
    </head>
    <body>
      <div class="center bold" style="font-size:13px">STOK OPNAME</div>
      <div class="center bold">${escapeHtml(o.cabangNama)}</div>
      <hr/>
      <div class="meta">
        <div>Tanggal : ${fmtDate(o.tanggal)}</div>
        <div>Oleh    : ${escapeHtml(o.userNama)}</div>
        <div>Cetak   : ${new Date().toLocaleString('id-ID')}</div>
      </div>
      <hr/>
      ${itemsHtml}
      <hr/>
      ${o.catatan ? `<div class="bold">Catatan:</div><div>${escapeHtml(o.catatan)}</div><hr/>` : ''}
      <div class="bold">Total item: ${o.details.length} | Selisih: ${totalBeda}</div>
      <div class="footer center">-- Terima kasih --</div>
      <script>
        window.onload = function () { window.print(); };
      </script>
    </body>
    </html>
  `;
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) { showToast('Popup diblokir browser — izinkan popup untuk mencetak', 'err'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ============ MASTER DATA (admin) ============ */
async function renderMaster() {
  const main = document.getElementById('main');
  if (CURRENT_USER.role !== 'admin') {
    main.innerHTML = `<div class="topbar"><h1>Akses Ditolak</h1></div><div class="card error-msg">Halaman ini khusus admin.</div>`;
    return;
  }
  main.innerHTML = `
    <div class="topbar"><div><h1>Master Data</h1><div class="desc">Kelola cabang, daftar item, dan akun staf.</div></div></div>
    <div class="toolbar">
      <button class="btn ghost tab-btn active" data-tab="cabang">Cabang</button>
      <button class="btn ghost tab-btn" data-tab="item">Item Stok</button>
      <button class="btn ghost tab-btn" data-tab="user">Akun Staf</button>
    </div>
    <div id="tabContent"></div>
  `;
  const tabBtns = main.querySelectorAll('.tab-btn');
  tabBtns.forEach(b => b.addEventListener('click', () => {
    tabBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderMasterTab(b.dataset.tab);
  }));
  renderMasterTab('cabang');
}

async function renderMasterTab(tab) {
  const box = document.getElementById('tabContent');
  if (tab === 'cabang') {
    box.innerHTML = `
      <div class="card">
        <div class="form-row">
          <div class="field"><label>Nama Cabang Baru</label><input id="newCabangNama" placeholder="mis. Cabang 4 - Mall XYZ" /></div>
          <div class="field"><label>Alamat (opsional)</label><input id="newCabangAlamat" /></div>
        </div>
        <button class="btn" id="addCabangBtn">Tambah Cabang</button>
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table><thead><tr><th>Nama</th><th>Alamat</th><th></th></tr></thead>
        <tbody>${CABANG_LIST.map(c => `
          <tr><td>${escapeHtml(c.nama)}</td><td>${escapeHtml(c.alamat) || '—'}</td>
          <td><button class="icon-btn del-cabang" data-id="${c.id}">Hapus</button></td></tr>
        `).join('')}</tbody></table>
      </div>
    `;
    document.getElementById('addCabangBtn').addEventListener('click', async () => {
      const nama = document.getElementById('newCabangNama').value.trim();
      if (!nama) return showToast('Nama cabang wajib diisi', 'err');
      await apiPost('/cabang', { nama, alamat: document.getElementById('newCabangAlamat').value });
      CABANG_LIST = await apiGet('/cabang');
      showToast('Cabang ditambahkan');
      renderMasterTab('cabang');
    });
    box.querySelectorAll('.del-cabang').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Hapus cabang ini?')) return;
      await apiDelete('/cabang/' + btn.dataset.id);
      CABANG_LIST = await apiGet('/cabang');
      showToast('Cabang dihapus');
      renderMasterTab('cabang');
    }));
  }

  if (tab === 'item') {
    if (!window.__masterItemCabang) window.__masterItemCabang = CABANG_LIST[0] ? CABANG_LIST[0].id : '';
    const selectedCabangId = window.__masterItemCabang;
    const items = selectedCabangId ? await apiGet('/items?cabangId=' + encodeURIComponent(selectedCabangId)) : [];

    box.innerHTML = `
      <div class="card">
        <div class="field">
          <label>Pilih Cabang</label>
          <select id="itemCabangSelect">
            ${CABANG_LIST.map(c => `<option value="${c.id}" ${c.id === selectedCabangId ? 'selected' : ''}>${escapeHtml(c.nama)}</option>`).join('')}
          </select>
        </div>
        <div class="desc" style="margin-bottom:14px">Setiap cabang punya daftar item sendiri — tambah, edit, atau hapus di sini hanya berlaku untuk cabang yang dipilih.</div>
        <div class="form-row">
          <div class="field"><label>Nama Item</label><input id="newItemNama" placeholder="mis. Bubuk Cokelat" /></div>
          <div class="field"><label>Satuan</label><input id="newItemSatuan" placeholder="kg / pcs / liter" /></div>
        </div>
        <div class="field"><label>Kategori</label><input id="newItemKategori" placeholder="Bahan Baku / Kemasan / Consumable" /></div>
        <button class="btn" id="addItemBtn">Tambah Item ke Cabang Ini</button>
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table><thead><tr><th>Nama</th><th>Satuan</th><th>Kategori</th><th></th></tr></thead>
        <tbody>${items.length === 0 ? `<tr class="empty-row"><td colspan="4">Belum ada item untuk cabang ini</td></tr>` : items.map(i => `
          <tr><td>${escapeHtml(i.nama)}</td><td class="mono">${escapeHtml(i.satuan)}</td><td>${escapeHtml(i.kategori)}</td>
          <td><button class="icon-btn del-item" data-id="${i.id}">Hapus</button></td></tr>
        `).join('')}</tbody></table>
      </div>
    `;
    document.getElementById('itemCabangSelect').addEventListener('change', (e) => {
      window.__masterItemCabang = e.target.value;
      renderMasterTab('item');
    });
    document.getElementById('addItemBtn').addEventListener('click', async () => {
      const nama = document.getElementById('newItemNama').value.trim();
      const satuan = document.getElementById('newItemSatuan').value.trim();
      if (!nama || !satuan) return showToast('Nama dan satuan wajib diisi', 'err');
      if (!selectedCabangId) return showToast('Pilih cabang dulu', 'err');
      await apiPost('/items', {
        nama, satuan, cabangId: selectedCabangId,
        kategori: document.getElementById('newItemKategori').value || 'Lainnya'
      });
      showToast('Item ditambahkan');
      renderMasterTab('item');
    });
    box.querySelectorAll('.del-item').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Hapus item ini?')) return;
      await apiDelete('/items/' + btn.dataset.id);
      showToast('Item dihapus');
      renderMasterTab('item');
    }));
  }

  if (tab === 'user') {
    const users = await apiGet('/users');
    box.innerHTML = `
      <div class="card">
        <div class="form-row">
          <div class="field"><label>Nama Lengkap</label><input id="newUserNama" /></div>
          <div class="field"><label>Username</label><input id="newUserUsername" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Password</label><input id="newUserPassword" type="text" /></div>
          <div class="field"><label>Peran</label>
            <select id="newUserRole">
              <option value="staff">Staf Cabang</option>
              <option value="admin">Admin Pusat</option>
            </select>
          </div>
        </div>
        <div class="field" id="userCabangField"><label>Cabang</label>
          <select id="newUserCabang">${CABANG_LIST.map(c => `<option value="${c.id}">${escapeHtml(c.nama)}</option>`).join('')}</select>
        </div>
        <button class="btn" id="addUserBtn">Tambah Akun</button>
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Cabang</th><th></th></tr></thead>
        <tbody>${users.map(u => `
          <tr><td>${escapeHtml(u.nama)}</td><td class="mono">${escapeHtml(u.username)}</td>
          <td><span class="badge-role">${u.role}</span></td>
          <td>${escapeHtml((CABANG_LIST.find(c => c.id === u.cabangId) || {}).nama || '—')}</td>
          <td>${u.id === CURRENT_USER.id ? '' : `<button class="icon-btn del-user" data-id="${u.id}">Hapus</button>`}</td></tr>
        `).join('')}</tbody></table>
      </div>
    `;
    const roleSelect = document.getElementById('newUserRole');
    const cabangField = document.getElementById('userCabangField');
    roleSelect.addEventListener('change', () => {
      cabangField.style.display = roleSelect.value === 'admin' ? 'none' : 'block';
    });
    document.getElementById('addUserBtn').addEventListener('click', async () => {
      const nama = document.getElementById('newUserNama').value.trim();
      const username = document.getElementById('newUserUsername').value.trim();
      const password = document.getElementById('newUserPassword').value;
      const role = roleSelect.value;
      const cabangId = document.getElementById('newUserCabang').value;
      if (!nama || !username || !password) return showToast('Lengkapi semua data akun', 'err');
      try {
        await apiPost('/users', { nama, username, password, role, cabangId });
        showToast('Akun ditambahkan');
        renderMasterTab('user');
      } catch (e) {
        showToast(e.message, 'err');
      }
    });
    box.querySelectorAll('.del-user').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Hapus akun ini?')) return;
      await apiDelete('/users/' + btn.dataset.id);
      showToast('Akun dihapus');
      renderMasterTab('user');
    }));
  }
}

boot();
