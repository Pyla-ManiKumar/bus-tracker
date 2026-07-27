// ══════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════
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

    if (btn.dataset.tab === 'dashboard')    loadDashboard();
    if (btn.dataset.tab === 'trips')        loadTrips();
    if (btn.dataset.tab === 'manage-buses') loadBusesList();
    if (btn.dataset.tab === 'drivers')      loadDriversList();
    if (btn.dataset.tab === 'assignments')  { loadAssignments(); loadAssignmentDropdowns(); }
    if (btn.dataset.tab === 'qr-codes')     loadQRCodes();
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
    document.getElementById('btn-stop').style.display  = 'inline-flex';
  }).catch(() => {
    toast('Camera not available or permission denied', 'error');
  });
}

function stopScanner() {
  if (scanner && scanning) {
    scanner.stop().then(() => {
      scanning = false;
      document.getElementById('btn-start').style.display = 'inline-flex';
      document.getElementById('btn-stop').style.display  = 'none';
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
    const res  = await fetch(`${API}/scan-bus`, {
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

  document.getElementById('r-icon').textContent =
    data.action === 'ENTRY' ? '🟢' : '🔴';
  document.getElementById('r-action').textContent =
    data.action === 'ENTRY' ? '✅ BUS ENTERED' : '🚪 BUS EXITED';
  document.getElementById('r-msg').textContent = data.message;

  let details = `
    ${row('Bus',        data.bus_number)}
    ${row('Route',      data.route)}
    ${row('Driver',     data.driver_name)}
    ${row('Entry Time', fmtTime(data.entry_time))}
  `;

  if (data.action === 'EXIT') {
    details += row('Exit Time',   fmtTime(data.exit_time));
    details += row('Time Inside', data.duration);
  }

  document.getElementById('r-details').innerHTML = details;
  document.getElementById('manual-id').value = '';
  setTimeout(() => { box.style.display = 'none'; }, 12000);
}

function showError(msg) {
  const box = document.getElementById('result-box');
  box.style.display = 'block';
  box.className = 'card result-box err';
  document.getElementById('r-icon').textContent   = '⚠️';
  document.getElementById('r-action').textContent = 'Invalid QR';
  document.getElementById('r-msg').textContent    = msg;
  document.getElementById('r-details').innerHTML  = '';
  toast(msg, 'error');
}

function row(label, val) {
  return `<div class="drow">
    <span class="dlabel">${label}</span>
    <span class="dval">${val}</span>
  </div>`;
}

// ══════════════════════════════════════════════════
//  LOAD BUSES (dropdown)
// ══════════════════════════════════════════════════
async function loadBuses() {
  try {
    const buses = await (await fetch(`${API}/buses`)).json();
    const el    = document.getElementById('f-bus');
    if (!el) return;
    const first = el.options[0];
    el.innerHTML = '';
    el.appendChild(first);
    buses.forEach(b => {
      const o       = document.createElement('option');
      o.value       = b.bus_number;
      o.textContent = `${b.bus_number} — ${b.route}`;
      el.appendChild(o);
    });
  } catch { console.warn('Could not load buses for dropdown'); }
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
function stat(color, value, label, icon) {
  return `<div class="stat ${color}">
    <div class="stat-icon">${icon}</div>
    <div class="stat-num">${value}</div>
    <div class="stat-lbl">${label}</div>
  </div>`;
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API}/dashboard`);
    if (!res.ok) return;
    const d = await res.json();

    document.getElementById('stats-grid').innerHTML = `
      ${stat('green',  d.buses_inside,      'Buses Inside',        '<i class="fa fa-bus"          style="color:#10b981"></i>')}
      ${stat('yellow', d.buses_outside,     'Buses Outside',       '<i class="fa fa-bus-simple"   style="color:#f59e0b"></i>')}
      ${stat('blue',   d.today_entries,     "Today's Entries",     '<i class="fa fa-sign-in-alt"  style="color:#6366f1"></i>')}
      ${stat('red',    d.today_exits,       "Today's Exits",       '<i class="fa fa-sign-out-alt" style="color:#ef4444"></i>')}
      ${stat('blue',   d.total_buses,       'Total Buses',         '<i class="fa fa-bus"          style="color:#6366f1"></i>')}
      ${stat('blue',   d.total_drivers,     'Total Drivers',       '<i class="fa fa-users"        style="color:#6366f1"></i>')}
      ${stat('yellow', d.today_assignments, "Today's Assignments", '<i class="fa fa-calendar"     style="color:#f59e0b"></i>')}
    `;

    document.getElementById('occupancy-list').innerHTML =
      d.bus_status.map(b => {
        const isInside = b.status === 'INSIDE';
        return `
          <div class="occ-card ${isInside ? 'inside' : 'outside'}">
            <div class="occ-head">
              <span>
                <i class="fa fa-bus"
                  style="color:${isInside ? '#10b981' : '#64748b'};"></i>
                ${b.bus_number}
              </span>
              <span class="badge ${isInside ? 'in' : 'done'}">
                ${isInside ? '🟢 Inside' : '⚪ Outside'}
              </span>
            </div>
            <div class="occ-route">
              <i class="fa fa-map-pin"
                style="color:#6366f1;font-size:10px;margin-right:4px;"></i>
              ${b.route}
            </div>
            ${isInside && b.entry_time ? `
              <div style="font-size:11px;color:#64748b;margin-top:6px;">
                <i class="fa fa-clock" style="color:#6366f1;"></i>
                ${fmtTime(b.entry_time)}
              </div>` : ''}
            ${b.today_driver && b.today_driver !== '-' ? `
              <div style="font-size:12px;color:#10b981;
                          margin-top:6px;font-weight:600;">
                <i class="fa fa-user"></i> ${b.today_driver}
              </div>` : `
              <div style="font-size:11px;color:#475569;
                          margin-top:6px;font-style:italic;">
                No driver assigned
              </div>`}
          </div>`;
      }).join('');
  } catch { toast('Dashboard load failed', 'error'); }
}

// ══════════════════════════════════════════════════
//  VISIT HISTORY
// ══════════════════════════════════════════════════
async function loadTrips() {
  try {
    let url      = `${API}/visits?`;
    const bus    = document.getElementById('f-bus').value;
    const status = document.getElementById('f-status').value;
    const date   = document.getElementById('f-date').value;
    if (bus)    url += `bus_number=${bus}&`;
    if (status) url += `status=${status}&`;
    if (date)   url += `date=${date}&`;

    const visits = await (await fetch(url)).json();
    const tbody  = document.getElementById('trips-body');

    if (!visits.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state">
          <i class="fa fa-clock-rotate-left"></i>
          <p>No records found</p>
        </div></td></tr>`;
      return;
    }

    tbody.innerHTML = visits.map(v => `
      <tr>
        <td>
          <strong style="color:#a5b4fc;">${v.bus_number}</strong><br>
          <small style="color:#64748b;">${v.route}</small>
        </td>
        <td style="color:#94a3b8;">${v.driver_name || '-'}</td>
        <td style="color:#94a3b8;">${fmtDT(v.entry_time)}</td>
        <td style="color:#94a3b8;">
          ${v.exit_time
            ? fmtDT(v.exit_time)
            : '<span style="color:#10b981;font-weight:700;">Still Inside</span>'}
        </td>
        <td style="color:#94a3b8;">${v.duration || '-'}</td>
        <td>
          <span class="badge ${v.status === 'INSIDE' ? 'in' : 'done'}">
            ${v.status === 'INSIDE' ? '🟢 Inside' : '✅ Left'}
          </span>
        </td>
        <td>
          <button class="btn danger" onclick="deleteVisit(${v.id})"
            style="padding:5px 10px;font-size:11px;">
            <i class="fa fa-trash"></i>
          </button>
        </td>
      </tr>`).join('');
  } catch { toast('Failed to load history', 'error'); }
}

// ══════════════════════════════════════════════════
//  BUSES
// ══════════════════════════════════════════════════
async function addBus(e) {
  e.preventDefault();
  const busNumber = document.getElementById('new-bus-number').value.trim();
  const route     = document.getElementById('new-bus-route').value.trim();
  const capacity  = document.getElementById('new-bus-capacity').value;
  const msg       = document.getElementById('bus-msg');
  try {
    const res  = await fetch(`${API}/buses`, {
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
    const list  = document.getElementById('buses-list');

    if (!buses.length) {
      list.innerHTML = `<div class="empty-state">
        <i class="fa fa-bus"></i><p>No buses added yet</p></div>`;
      return;
    }

    list.innerHTML = buses.map(b => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;
                    align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;font-size:16px;color:#f1f5f9;">
              <i class="fa fa-bus" style="color:#6366f1;"></i> ${b.bus_number}
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-top:4px;">
              <i class="fa fa-map-pin"
                style="color:#6366f1;font-size:11px;"></i> ${b.route}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              <i class="fa fa-users" style="font-size:11px;"></i>
              Capacity: ${b.capacity}
            </div>
            <div style="margin-top:10px;padding-top:10px;
                        border-top:1px solid rgba(255,255,255,0.06);">
              ${b.today_driver_name ? `
                <div style="font-size:13px;color:#10b981;font-weight:600;">
                  <i class="fa fa-user-check"></i> ${b.today_driver_name}
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:3px;">
                  <i class="fa fa-id-badge"></i> ${b.today_driver_id}
                  &nbsp;|&nbsp;
                  <i class="fa fa-clock"></i> ${b.today_shift}
                </div>
                ${b.today_driver_phone ? `
                  <div style="font-size:11px;color:#64748b;margin-top:2px;">
                    <i class="fa fa-phone"></i> ${b.today_driver_phone}
                  </div>` : ''}
              ` : `
                <div style="font-size:12px;color:#475569;font-style:italic;">
                  <i class="fa fa-triangle-exclamation"></i>
                  No driver assigned today
                </div>`}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button class="btn primary"
              style="padding:8px 14px;font-size:12px;"
              onclick='openEditBusModal(${JSON.stringify(b)})'>
              <i class="fa fa-pen"></i> Edit
            </button>
            <button class="btn danger"
              style="padding:8px 14px;font-size:12px;"
              onclick="deleteBus('${b.bus_number}')">
              <i class="fa fa-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>`).join('');
  } catch { toast('Failed to load buses', 'error'); }
}

async function deleteBus(busNumber) {
  if (!confirm(`Delete ${busNumber}?`)) return;
  try {
    const res  = await fetch(`${API}/buses/${busNumber}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast(`✅ ${data.message}`, 'success');
      loadBusesList();
      loadBuses();
    } else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

function openEditBusModal(bus) {
  document.getElementById('edit-bus-number').value      = bus.bus_number;
  document.getElementById('edit-bus-num-display').value = bus.bus_number;
  document.getElementById('edit-route').value           = bus.route    || '';
  document.getElementById('edit-capacity').value        = bus.capacity || 50;
  document.getElementById('edit-bus-modal').style.display = 'flex';
}

function closeEditBusModal() {
  document.getElementById('edit-bus-modal').style.display = 'none';
}

async function saveEditBus(e) {
  e.preventDefault();
  const busNumber = document.getElementById('edit-bus-number').value;
  const payload   = {
    route:    document.getElementById('edit-route').value.trim(),
    capacity: document.getElementById('edit-capacity').value
  };
  try {
    const res  = await fetch(`${API}/buses/${busNumber}`, {
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
    driver_id:  document.getElementById('new-driver-id').value.trim(),
    name:       document.getElementById('new-driver-name').value.trim(),
    phone:      document.getElementById('new-driver-phone').value.trim(),
    license_no: document.getElementById('new-driver-license').value.trim()
  };
  const msg = document.getElementById('driver-msg');
  try {
    const res  = await fetch(`${API}/drivers`, {
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
    const list    = document.getElementById('drivers-list');

    if (!drivers.length) {
      list.innerHTML = `<div class="empty-state">
        <i class="fa fa-id-card"></i><p>No drivers added yet</p></div>`;
      return;
    }

    list.innerHTML = drivers.map(d => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;
                    align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;font-size:16px;color:#f1f5f9;">
              <i class="fa fa-user" style="color:#6366f1;"></i> ${d.name}
            </div>
            <div style="font-size:13px;color:#94a3b8;margin-top:4px;">
              <i class="fa fa-id-badge" style="font-size:11px;"></i>
              ${d.driver_id}
            </div>
            ${d.phone ? `
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                <i class="fa fa-phone" style="font-size:10px;"></i> ${d.phone}
              </div>` : ''}
            ${d.license_no ? `
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                <i class="fa fa-id-card" style="font-size:10px;"></i>
                ${d.license_no}
              </div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button class="btn primary"
              style="padding:8px 14px;font-size:12px;"
              onclick='openEditDriverModal(${JSON.stringify(d)})'>
              <i class="fa fa-pen"></i> Edit
            </button>
            <button class="btn danger"
              style="padding:8px 14px;font-size:12px;"
              onclick="deleteDriver('${d.driver_id}')">
              <i class="fa fa-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>`).join('');
  } catch { toast('Failed to load drivers', 'error'); }
}

async function deleteDriver(driverId) {
  if (!confirm(`Delete driver ${driverId}?`)) return;
  try {
    const res  = await fetch(`${API}/drivers/${driverId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast(`✅ ${data.message}`, 'success'); loadDriversList(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

function openEditDriverModal(d) {
  document.getElementById('edit-driver-id').value         = d.driver_id;
  document.getElementById('edit-driver-id-display').value = d.driver_id;
  document.getElementById('edit-driver-name').value       = d.name       || '';
  document.getElementById('edit-driver-phone').value      = d.phone      || '';
  document.getElementById('edit-driver-license').value    = d.license_no || '';
  document.getElementById('edit-driver-modal').style.display = 'flex';
}

function closeEditDriverModal() {
  document.getElementById('edit-driver-modal').style.display = 'none';
}

async function saveEditDriver(e) {
  e.preventDefault();
  const driverId = document.getElementById('edit-driver-id').value;
  const payload  = {
    name:       document.getElementById('edit-driver-name').value.trim(),
    phone:      document.getElementById('edit-driver-phone').value.trim(),
    license_no: document.getElementById('edit-driver-license').value.trim()
  };
  try {
    const res  = await fetch(`${API}/drivers/${driverId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      toast('✅ Driver updated!', 'success');
      closeEditDriverModal();
      loadDriversList();
    } else toast('❌ ' + data.error, 'error');
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

    const dSel = document.getElementById('assign-driver');
    dSel.innerHTML = '<option value="">-- Choose Driver --</option>';
    drivers.forEach(d => {
      const o       = document.createElement('option');
      o.value       = d.driver_id;
      o.textContent = `${d.driver_id} — ${d.name}`;
      dSel.appendChild(o);
    });

    const bSel = document.getElementById('assign-bus');
    bSel.innerHTML = '<option value="">-- Choose Bus --</option>';
    buses.forEach(b => {
      const o       = document.createElement('option');
      o.value       = b.bus_number;
      o.textContent = `${b.bus_number} — ${b.route}`;
      bSel.appendChild(o);
    });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!document.getElementById('assign-date').value)
      document.getElementById('assign-date').value = today;
    if (!document.getElementById('filter-assign-date').value)
      document.getElementById('filter-assign-date').value = today;

  } catch { console.warn('Could not load dropdowns'); }
}

async function addAssignment(e) {
  e.preventDefault();
  const payload = {
    driver_id:       document.getElementById('assign-driver').value,
    bus_number:      document.getElementById('assign-bus').value,
    assignment_date: document.getElementById('assign-date').value,
    shift:           document.getElementById('assign-shift').value
  };
  const msg = document.getElementById('assign-msg');
  try {
    const res  = await fetch(`${API}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showMsg(msg, '✅ Assignment created!', true);
      loadAssignments();
      toast('Driver assigned!', 'success');
    } else showMsg(msg, '❌ ' + data.error, false);
  } catch { toast('Connection error', 'error'); }
}

async function loadAssignments() {
  try {
    const date = document.getElementById('filter-assign-date').value;
    const url  = `${API}/assignments${date ? '?date=' + date : ''}`;
    const assignments = await (await fetch(url)).json();
    const list = document.getElementById('assignments-list');

    if (!assignments.length) {
      list.innerHTML = `<div class="empty-state">
        <i class="fa fa-calendar-xmark"></i>
        <p>No assignments for this date</p></div>`;
      return;
    }

    list.innerHTML = assignments.map(a => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;
                    align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;font-size:14px;color:#f1f5f9;">
              <i class="fa fa-bus" style="color:#6366f1;"></i>
              ${a.bus_number}
              <i class="fa fa-arrow-right"
                style="font-size:10px;color:#64748b;margin:0 4px;"></i>
              <i class="fa fa-user" style="color:#6366f1;"></i>
              ${a.driver_name}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">
              <i class="fa fa-calendar"></i> ${a.assignment_date}
              &nbsp;|&nbsp;
              <i class="fa fa-clock"></i> ${a.shift}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              <i class="fa fa-map-pin"
                style="color:#6366f1;font-size:10px;"></i> ${a.route}
            </div>
            ${a.driver_phone && a.driver_phone !== '-' ? `
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                <i class="fa fa-phone" style="font-size:10px;"></i>
                ${a.driver_phone}
              </div>` : ''}
          </div>
          <button class="btn danger"
            style="padding:8px 14px;font-size:12px;"
            onclick="deleteAssignment(${a.id})">
            <i class="fa fa-trash"></i> Remove
          </button>
        </div>
      </div>`).join('');
  } catch { toast('Failed to load assignments', 'error'); }
}

async function deleteAssignment(id) {
  if (!confirm('Remove this assignment?')) return;
  try {
    const res  = await fetch(`${API}/assignments/${id}`, { method: 'DELETE' });
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
    const grid  = document.getElementById('qr-grid');

    if (!buses.length) {
      grid.innerHTML = `<div class="empty-state">
        <i class="fa fa-qrcode"></i><p>No buses yet</p></div>`;
      return;
    }

    grid.innerHTML = buses.map(b => `
      <div class="qr-card">
        <div id="qr-${b.bus_number}"
          style="display:flex;justify-content:center;margin-bottom:10px;"></div>
        <div style="font-weight:700;font-size:13px;color:#f1f5f9;">
          <i class="fa fa-bus" style="color:#6366f1;font-size:11px;"></i>
          ${b.bus_number}
        </div>
        <div style="font-size:10px;color:#64748b;
                    margin-top:2px;margin-bottom:12px;">
          ${b.route}
        </div>
        <button class="btn primary"
          style="padding:7px 12px;font-size:11px;width:100%;"
          onclick="downloadQR('${b.bus_number}')">
          <i class="fa fa-download"></i> Download
        </button>
      </div>`).join('');

    buses.forEach(b => {
      const container = document.getElementById(`qr-${b.bus_number}`);
      if (container) {
        new QRCode(container, {
          text: b.bus_number,
          width: 150, height: 150,
          colorDark:  '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    });

    // Magic card mouse tracking (from magicui)
    document.querySelectorAll('.qr-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx',
          ((e.clientX - r.left) / r.width  * 100) + '%');
        card.style.setProperty('--my',
          ((e.clientY - r.top)  / r.height * 100) + '%');
      });
    });

    toast('✅ QR codes loaded!', 'success');
  } catch { toast('Failed to load QR codes', 'error'); }
}

function downloadQR(busNumber) {
  const container = document.getElementById(`qr-${busNumber}`);
  const canvas    = container.querySelector('canvas');
  const img       = container.querySelector('img');
  let   dataUrl;
  if (canvas)   dataUrl = canvas.toDataURL('image/png');
  else if (img) dataUrl = img.src;
  else { toast('QR not ready', 'error'); return; }
  const link    = document.createElement('a');
  link.download = `${busNumber}.png`;
  link.href     = dataUrl;
  link.click();
}

// ══════════════════════════════════════════════════
//  TIME HELPERS (UTC → IST)
// ══════════════════════════════════════════════════
function fmtDT(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    month:    'short',
    day:      'numeric',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   true,
    timeZone: 'Asia/Kolkata'
  });
}

function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   true,
    timeZone: 'Asia/Kolkata'
  });
}

// ══════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════
function toast(msg, type = 'info') {
  const icons = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info'
  };
  const t     = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'error' : type}`;
  t.innerHTML = `<i class="fa ${icons[type] || icons.info}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity   = '0';
    t.style.transform = 'translateX(120px)';
    t.style.transition = '0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ══════════════════════════════════════════════════
//  BEEP
// ══════════════════════════════════════════════════
function beep(isEntry) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = isEntry ? 880 : 440;
    osc.type            = 'sine';
    gain.gain.value     = 0.25;
    osc.start();
    setTimeout(() => osc.stop(), 180);
  } catch {}
}

// ══════════════════════════════════════════════════
//  SHOW MSG
// ══════════════════════════════════════════════════
function showMsg(el, text, ok) {
  el.textContent   = text;
  el.className     = `msg-box ${ok ? 'ok' : 'err'}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ══════════════════════════════════════════════════
//  CLEAR HISTORY
// ══════════════════════════════════════════════════
async function clearAllHistory() {
  if (!confirm('⚠️ Delete ALL visit records permanently?')) return;
  if (!confirm('❌ FINAL WARNING — this cannot be undone. Continue?')) return;
  try {
    const res  = await fetch(`${API}/visits/clear-all`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast(data.message, 'success'); loadTrips(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

async function clearOldHistory() {
  if (!confirm('Delete all records older than 30 days?')) return;
  try {
    const res  = await fetch(`${API}/visits/clear-old`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast(data.message, 'success'); loadTrips(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

async function clearByDate() {
  const date = document.getElementById('f-date').value;
  if (!date) { toast('Select a date first!', 'error'); return; }
  if (!confirm(`Delete all visits from ${date}?`)) return;
  try {
    const res  = await fetch(
      `${API}/visits/clear-by-date?date=${date}`, { method: 'DELETE' }
    );
    const data = await res.json();
    if (res.ok) { toast(data.message, 'success'); loadTrips(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

async function deleteVisit(id) {
  if (!confirm('Delete this record?')) return;
  try {
    const res  = await fetch(`${API}/visits/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast('✅ Record deleted', 'success'); loadTrips(); }
    else toast('❌ ' + data.error, 'error');
  } catch { toast('Connection error', 'error'); }
}

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadBuses();
  loadDashboard();
  const fDate = document.getElementById('f-date');
  if (fDate) {
    fDate.value = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata'
    });
  }
});