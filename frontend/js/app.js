// Auto-detect IP address
const API = 'https://bus-tracker-y44b.onrender.com/api';
let scanner = null;
let scanning = false;

// ══════════════════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'trips') loadTrips();
    if (btn.dataset.tab === 'manage-buses') loadBusesList();
    if (btn.dataset.tab === 'drivers') loadDriversList();
    if (btn.dataset.tab === 'assignments') { loadAssignments(); loadAssignmentDropdowns(); }
    if (btn.dataset.tab === 'qr-codes') loadQRCodes();
  });
});

// ══════════════════════════════════════════════════
//  QR SCANNER
// ══════════════════════════════════════════════════
function startScanner() {
  scanner = new Html5Qrcode('qr-reader');
  scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    qrText => {
      stopScanner();
      processScan(qrText.trim());
    },
    () => {}
  ).then(() => {
    scanning = true;
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'inline-block';
  }).catch(() => {
    toast('Camera not available or permission denied', 'error');
  });
}

function stopScanner() {
  if (scanner && scanning) {
    scanner.stop().then(() => {
      scanning = false;
      document.getElementById('btn-start').style.display = 'inline-block';
      document.getElementById('btn-stop').style.display = 'none';
    });
  }
}

function manualScan() {
  const busNumber = document.getElementById('manual-id').value.trim();
  if (!busNumber) { toast('Enter a Bus Number', 'error'); return; }
  processScan(busNumber);
}

async function processScan(busNumber) {
  try {
    const res = await fetch(`${API}/scan-bus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bus_number: busNumber })
    });
    const data = await res.json();
    if (res.ok) {
      showResult(data);
      beep(data.action === 'ENTRY');
    } else {
      showError(data.error || 'Invalid QR code');
    }
  } catch {
    showError('Cannot connect to server. Is the backend running?');
  }
}

function showResult(data) {
  const box = document.getElementById('result-box');
  box.style.display = 'block';
  box.className = 'card result-box ' + (data.action === 'ENTRY' ? 'entry' : 'exit');

  document.getElementById('r-icon').textContent = data.action === 'ENTRY' ? '🟢' : '🔴';
  document.getElementById('r-action').textContent =
    data.action === 'ENTRY' ? '✅ BUS ENTERED' : '🚪 BUS EXITED';
  document.getElementById('r-action').style.color =
    data.action === 'ENTRY' ? '#16a34a' : '#dc2626';
  document.getElementById('r-msg').textContent = data.message;

  let details = `
    ${row('Bus', data.bus_number)}
    ${row('Route', data.route)}
    ${row('Driver', data.driver_name)}
  `;

  if (data.action === 'ENTRY') {
    details += row('Entry Time', fmtTime(data.entry_time));
  } else {
    details += row('Entry Time', fmtTime(data.entry_time));
    details += row('Exit Time', fmtTime(data.exit_time));
    details += row('Time Inside', data.duration);
  }

  document.getElementById('r-details').innerHTML = details;
  document.getElementById('manual-id').value = '';
  setTimeout(() => box.style.display = 'none', 12000);
}

function showError(msg) {
  const box = document.getElementById('result-box');
  box.style.display = 'block';
  box.className = 'card result-box err';
  document.getElementById('r-icon').textContent = '⚠️';
  document.getElementById('r-action').textContent = 'Invalid QR';
  document.getElementById('r-action').style.color = '#d97706';
  document.getElementById('r-msg').textContent = msg;
  document.getElementById('r-details').innerHTML = '';
  toast(msg, 'error');
}

function row(label, val) {
  return `<div class="drow"><span class="dlabel">${label}</span><span class="dval">${val}</span></div>`;
}

// ══════════════════════════════════════════════════
//  LOAD BUSES (for dropdowns)
// ══════════════════════════════════════════════════
async function loadBuses() {
  try {
    const buses = await (await fetch(`${API}/buses`)).json();
    ['f-bus'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const firstOption = el.options[0];
      el.innerHTML = '';
      el.appendChild(firstOption);
      buses.forEach(b => {
        const o = document.createElement('option');
        o.value = b.bus_number;
        o.textContent = `${b.bus_number} — ${b.route}`;
        el.appendChild(o);
      });
    });
  } catch { console.warn('Could not load buses'); }
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/dashboard`);
    if (!res.ok) return;
    const d = await res.json();
    document.getElementById('stats-grid').innerHTML = `
      ${stat('green', d.buses_inside, '🟢 Buses INSIDE')}
      ${stat('yellow', d.buses_outside, '🚌 Buses OUTSIDE')}
      ${stat('blue', d.today_entries, "Today's Entries")}
      ${stat('red', d.today_exits, "Today's Exits")}
      ${stat('blue', d.total_buses, 'Total Buses')}
      ${stat('blue', d.total_drivers, 'Total Drivers')}
      ${stat('yellow', d.today_assignments, "Today's Assignments")}
    `;

    document.getElementById('occupancy-list').innerHTML =
      d.bus_status.map(b => {
        const isInside = b.status === 'INSIDE';
        return `
          <div class="occ-card" style="border-left:4px solid ${isInside ? '#16a34a' : '#94a3b8'};">
            <div class="occ-head">
              <span>🚌 ${b.bus_number}</span>
              <span style="color:${isInside ? '#16a34a' : '#94a3b8'};font-weight:800;">
                ${isInside ? '🟢 INSIDE' : '⚪ OUTSIDE'}
              </span>
            </div>
            <div class="occ-route">📍 ${b.route}</div>
            ${isInside && b.entry_time ? `
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
                🕐 Entered: ${fmtTime(b.entry_time)}
              </div>` : ''}
            ${b.today_driver && b.today_driver !== '-' ? `
              <div style="font-size:12px;color:#16a34a;margin-top:6px;font-weight:600;">
                👤 Driver: ${b.today_driver}
              </div>` : `
              <div style="font-size:12px;color:#94a3b8;margin-top:6px;font-style:italic;">
                No driver assigned
              </div>`}
          </div>`;
      }).join('');
  } catch { toast('Dashboard load failed', 'error'); }
}

function stat(color, value, label) {
  return `<div class="stat ${color}">
    <div class="stat-num">${value}</div>
    <div class="stat-lbl">${label}</div>
  </div>`;
}

// ══════════════════════════════════════════════════
//  VISIT HISTORY
// ══════════════════════════════════════════════════
async function loadTrips() {
  try {
    let url = `${API}/visits?`;
    const bus = document.getElementById('f-bus').value;
    const status = document.getElementById('f-status').value;
    const date = document.getElementById('f-date').value;
    if (bus) url += `bus_number=${bus}&`;
    if (status) url += `status=${status}&`;
    if (date) url += `date=${date}&`;

    const visits = await (await fetch(url)).json();
    const tbody = document.getElementById('trips-body');

    if (!visits.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8">No visits found</td></tr>';
      return;
    }
    tbody.innerHTML = visits.map(v => `
      <tr>
        <td><strong>${v.bus_number}</strong><br><small>${v.route}</small></td>
        <td>${v.driver_name || '-'}</td>
        <td>${fmtDT(v.entry_time)}</td>
        <td>${v.exit_time ? fmtDT(v.exit_time) : '<span style="color:#16a34a;font-weight:700;">Still inside</span>'}</td>
        <td>${v.duration}</td>
        <td><span class="badge ${v.status === 'INSIDE' ? 'in' : 'done'}">
          ${v.status === 'INSIDE' ? '🟢 INSIDE' : '✅ Left'}
        </span></td>
      </tr>`).join('');
  } catch { toast('Failed to load history', 'error'); }
}

// ══════════════════════════════════════════════════
//  BUSES
// ══════════════════════════════════════════════════
async function addBus(e) {
  e.preventDefault();
  const busNumber = document.getElementById('new-bus-number').value.trim();
  const route = document.getElementById('new-bus-route').value.trim();
  const capacity = document.getElementById('new-bus-capacity').value;
  const msg = document.getElementById('bus-msg');

  try {
    const res = await fetch(`${API}/buses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bus_number: busNumber, route, capacity })
    });
    const data = await res.json();
    if (res.ok) {
      showMsg(msg, `✅ Bus ${busNumber} added!`, true);
      e.target.reset();
      document.getElementById('new-bus-capacity').value = 50;
      loadBusesList();
      loadBuses();
      toast('Bus added!', 'success');
    } else {
      showMsg(msg, '❌ ' + data.error, false);
    }
  } catch { toast('Connection error', 'error'); }
}

async function loadBusesList() {
  try {
    const buses = await (await fetch(`${API}/buses`)).json();
    const list = document.getElementById('buses-list');
    if (!buses.length) {
      list.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No buses yet</p>';
      return;
    }
    list.innerHTML = buses.map(b => `
      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:10px;
                  border:1px solid #e2e8f0;display:flex;justify-content:space-between;
                  align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-weight:700;font-size:17px;color:#1e293b;">🚌 ${b.bus_number}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;">📍 ${b.route}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">👥 Capacity: ${b.capacity}</div>

          ${b.today_driver_name ? `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;">
              <div style="font-size:13px;color:#16a34a;font-weight:700;">
                👤 Today's Driver: ${b.today_driver_name}
              </div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">
                🆔 ${b.today_driver_id} | ⏰ ${b.today_shift}
              </div>
              ${b.today_driver_phone ? `
                <div style="font-size:11px;color:#64748b;margin-top:2px;">
                  📞 ${b.today_driver_phone}
                </div>` : ''}
            </div>
          ` : `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;">
              <div style="font-size:12px;color:#94a3b8;font-style:italic;">
                ⚠️ No driver assigned today
              </div>
            </div>
          `}
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
          <button class="btn primary" onclick='openEditBusModal(${JSON.stringify(b)})'
                  style="padding:8px 14px;font-size:12px;">✏️ Edit</button>
          <button class="btn danger" onclick="deleteBus('${b.bus_number}')"
                  style="padding:8px 14px;font-size:12px;">🗑️ Delete</button>
        </div>
      </div>`).join('');
  } catch { toast('Failed to load buses', 'error'); }
}

async function deleteBus(busNumber) {
  if (!confirm(`Delete ${busNumber}?`)) return;
  try {
    const res = await fetch(`${API}/buses/${busNumber}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast(`✅ ${data.message}`, 'success');
      loadBusesList();
      loadBuses();
    } else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

function openEditBusModal(bus) {
  document.getElementById('edit-bus-number').value = bus.bus_number;
  document.getElementById('edit-bus-num-display').value = bus.bus_number;
  document.getElementById('edit-route').value = bus.route || '';
  document.getElementById('edit-capacity').value = bus.capacity || 50;
  document.getElementById('edit-bus-modal').style.display = 'flex';
}

function closeEditBusModal() {
  document.getElementById('edit-bus-modal').style.display = 'none';
}

async function saveEditBus(e) {
  e.preventDefault();
  const busNumber = document.getElementById('edit-bus-number').value;
  const payload = {
    route: document.getElementById('edit-route').value.trim(),
    capacity: document.getElementById('edit-capacity').value
  };
  try {
    const res = await fetch(`${API}/buses/${busNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      toast('✅ Bus updated!', 'success');
      closeEditBusModal();
      loadBusesList();
      loadBuses();
    } else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

// ══════════════════════════════════════════════════
//  DRIVERS
// ══════════════════════════════════════════════════
async function addDriver(e) {
  e.preventDefault();
  const payload = {
    driver_id: document.getElementById('new-driver-id').value.trim(),
    name: document.getElementById('new-driver-name').value.trim(),
    phone: document.getElementById('new-driver-phone').value.trim(),
    license_no: document.getElementById('new-driver-license').value.trim()
  };
  const msg = document.getElementById('driver-msg');
  try {
    const res = await fetch(`${API}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showMsg(msg, `✅ Driver ${payload.driver_id} added!`, true);
      e.target.reset();
      loadDriversList();
      toast('Driver added!', 'success');
    } else showMsg(msg, '❌ ' + data.error, false);
  } catch { toast('Connection error', 'error'); }
}

async function loadDriversList() {
  try {
    const drivers = await (await fetch(`${API}/drivers`)).json();
    const list = document.getElementById('drivers-list');
    if (!drivers.length) {
      list.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No drivers yet</p>';
      return;
    }
    list.innerHTML = drivers.map(d => `
      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:10px;
                  border:1px solid #e2e8f0;display:flex;justify-content:space-between;
                  align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-weight:700;font-size:16px;color:#1e293b;">👤 ${d.name}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;">🆔 ${d.driver_id}</div>
          ${d.phone ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">📞 ${d.phone}</div>` : ''}
          ${d.license_no ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">🪪 ${d.license_no}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button class="btn primary" onclick='openEditDriverModal(${JSON.stringify(d)})' style="padding:8px 14px;font-size:12px;">✏️ Edit</button>
          <button class="btn danger" onclick="deleteDriver('${d.driver_id}')" style="padding:8px 14px;font-size:12px;">🗑️ Delete</button>
        </div>
      </div>`).join('');
  } catch { toast('Failed to load drivers', 'error'); }
}

async function deleteDriver(driverId) {
  if (!confirm(`Delete driver ${driverId}?`)) return;
  try {
    const res = await fetch(`${API}/drivers/${driverId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast(`✅ ${data.message}`, 'success'); loadDriversList(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

function openEditDriverModal(d) {
  document.getElementById('edit-driver-id').value = d.driver_id;
  document.getElementById('edit-driver-id-display').value = d.driver_id;
  document.getElementById('edit-driver-name').value = d.name || '';
  document.getElementById('edit-driver-phone').value = d.phone || '';
  document.getElementById('edit-driver-license').value = d.license_no || '';
  document.getElementById('edit-driver-modal').style.display = 'flex';
}

function closeEditDriverModal() {
  document.getElementById('edit-driver-modal').style.display = 'none';
}

async function saveEditDriver(e) {
  e.preventDefault();
  const driverId = document.getElementById('edit-driver-id').value;
  const payload = {
    name: document.getElementById('edit-driver-name').value.trim(),
    phone: document.getElementById('edit-driver-phone').value.trim(),
    license_no: document.getElementById('edit-driver-license').value.trim()
  };
  try {
    const res = await fetch(`${API}/drivers/${driverId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) { toast('✅ Driver updated!', 'success'); closeEditDriverModal(); loadDriversList(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

// ══════════════════════════════════════════════════
//  ASSIGNMENTS
// ══════════════════════════════════════════════════
async function loadAssignmentDropdowns() {
  try {
    const [drivers, buses] = await Promise.all([
      fetch(`${API}/drivers`).then(r => r.json()),
      fetch(`${API}/buses`).then(r => r.json())
    ]);
    const driverSel = document.getElementById('assign-driver');
    driverSel.innerHTML = '<option value="">-- Choose Driver --</option>';
    drivers.forEach(d => {
      const o = document.createElement('option');
      o.value = d.driver_id;
      o.textContent = `${d.driver_id} — ${d.name}`;
      driverSel.appendChild(o);
    });
    const busSel = document.getElementById('assign-bus');
    busSel.innerHTML = '<option value="">-- Choose Bus --</option>';
    buses.forEach(b => {
      const o = document.createElement('option');
      o.value = b.bus_number;
      o.textContent = `${b.bus_number} — ${b.route}`;
      busSel.appendChild(o);
    });
    const today = new Date().toISOString().split('T')[0];
    if (!document.getElementById('assign-date').value) document.getElementById('assign-date').value = today;
    if (!document.getElementById('filter-assign-date').value) document.getElementById('filter-assign-date').value = today;
  } catch { console.warn('Could not load dropdowns'); }
}

async function addAssignment(e) {
  e.preventDefault();
  const payload = {
    driver_id: document.getElementById('assign-driver').value,
    bus_number: document.getElementById('assign-bus').value,
    assignment_date: document.getElementById('assign-date').value,
    shift: document.getElementById('assign-shift').value
  };
  const msg = document.getElementById('assign-msg');
  try {
    const res = await fetch(`${API}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) { showMsg(msg, '✅ Assignment created!', true); loadAssignments(); toast('Driver assigned!', 'success'); }
    else showMsg(msg, '❌ ' + data.error, false);
  } catch { toast('Connection error', 'error'); }
}

async function loadAssignments() {
  try {
    const date = document.getElementById('filter-assign-date').value;
    let url = `${API}/assignments`;
    if (date) url += `?date=${date}`;
    const assignments = await (await fetch(url)).json();
    const list = document.getElementById('assignments-list');
    if (!assignments.length) {
      list.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No assignments for this date</p>';
      return;
    }
    list.innerHTML = assignments.map(a => `
      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:10px;
                  border:1px solid #e2e8f0;display:flex;justify-content:space-between;
                  align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-weight:700;font-size:15px;color:#1e293b;">🚌 ${a.bus_number} → 👤 ${a.driver_name}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">📅 ${a.assignment_date} | ⏰ ${a.shift}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">📍 ${a.route}</div>
          ${a.driver_phone && a.driver_phone !== '-' ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">📞 ${a.driver_phone}</div>` : ''}
        </div>
        <button class="btn danger" onclick="deleteAssignment(${a.id})" style="padding:8px 14px;font-size:12px;">🗑️ Remove</button>
      </div>`).join('');
  } catch { toast('Failed to load assignments', 'error'); }
}

async function deleteAssignment(id) {
  if (!confirm('Remove this assignment?')) return;
  try {
    const res = await fetch(`${API}/assignments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast(`✅ ${data.message}`, 'success'); loadAssignments(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

// ══════════════════════════════════════════════════
//  QR CODES
// ══════════════════════════════════════════════════
async function loadQRCodes() {
  try {
    const buses = await (await fetch(`${API}/buses`)).json();
    const grid = document.getElementById('qr-grid');
    if (!buses.length) {
      grid.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No buses yet</p>';
      return;
    }

    // Create card HTML for each bus
    grid.innerHTML = buses.map(b => `
      <div style="background:white;border:2px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
        <div id="qr-${b.bus_number}" style="display:flex;justify-content:center;margin-bottom:10px;"></div>
        <div style="font-weight:700;font-size:14px;color:#1e293b;">🚌 ${b.bus_number}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${b.route}</div>
        <button class="btn primary" style="padding:6px 12px;font-size:11px;margin-top:8px;" onclick="downloadQR('${b.bus_number}')">⬇️ Download</button>
      </div>`).join('');

    // Generate QR codes using QRCode.js library
    buses.forEach(b => {
      const container = document.getElementById(`qr-${b.bus_number}`);
      if (container) {
        new QRCode(container, {
          text: b.bus_number,
          width: 160,
          height: 160,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    });

    toast('✅ QR codes loaded!', 'success');
  } catch (err) {
    console.error('QR load error:', err);
    toast('Failed to load QR codes', 'error');
  }
}

function downloadQR(busNumber) {
  const container = document.getElementById(`qr-${busNumber}`);
  const img = container.querySelector('img');
  const canvas = container.querySelector('canvas');
  
  let dataUrl;
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else if (img) {
    dataUrl = img.src;
  } else {
    toast('QR not ready', 'error');
    return;
  }
  
  const link = document.createElement('a');
  link.download = `${busNumber}.png`;
  link.href = dataUrl;
  link.click();
}
// ══════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════
function fmtDT(iso) {
  if (!iso) return '-';
  // Add 'Z' to treat as UTC, then convert to IST (India time)
  const dateStr = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(dateStr).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
}

function fmtTime(iso) {
  if (!iso) return '-';
  const dateStr = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
}
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function beep(isEntry) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = isEntry ? 880 : 440;
    osc.type = 'sine';
    gain.gain.value = 0.25;
    osc.start();
    setTimeout(() => osc.stop(), 180);
  } catch {}
}

function showMsg(el, text, ok) {
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = ok ? '#dcfce7' : '#fee2e2';
  el.style.color = ok ? '#16a34a' : '#dc2626';
  el.style.padding = '10px';
  el.style.borderRadius = '8px';
  el.style.textAlign = 'center';
  el.style.marginTop = '10px';
  el.style.fontWeight = '700';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadBuses();
  const fDate = document.getElementById('f-date');
  if (fDate) fDate.value = new Date().toISOString().split('T')[0];
});