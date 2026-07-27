from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from models import db, Bus, Driver, Assignment, BusVisit
from datetime import datetime, date, timezone, timedelta

# India Standard Time (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def now_ist():
    """Get current time in India Standard Time"""
    return datetime.now(IST).replace(tzinfo=None)
from io import BytesIO
import zipfile

app = Flask(__name__)
CORS(app)

import os
DB_PATH = os.environ.get('DATABASE_PATH', 'sqlite:///bus_tracker.db')
app.config['SQLALCHEMY_DATABASE_URI'] = DB_PATH
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

    if Bus.query.count() == 0:
        routes = [
            'Route 1: City Center', 'Route 2: Main Station', 'Route 3: North Zone',
            'Route 4: South Zone', 'Route 5: East Zone', 'Route 6: West Zone',
            'Route 7: Airport', 'Route 8: Railway', 'Route 9: Highway',
            'Route 10: Downtown', 'Route 11: Suburbs', 'Route 12: Mall',
            'Route 13: Beach', 'Route 14: Hills', 'Route 15: Village',
            'Route 16: Old Town', 'Route 17: New Town', 'Route 18: Market',
            'Route 19: Temple', 'Route 20: Sports Complex',
            'Route 21: Metro Line', 'Route 22: Hospital', 'Route 23: Park',
            'Route 24: Bypass', 'Route 25: Ring Road'
        ]
        for i in range(1, 26):
            db.session.add(Bus(
                bus_number=f'BUS-{i:03d}',
                route=routes[i - 1],
                capacity=50
            ))
        db.session.commit()
        print("✅ 25 default buses created.")

    if Driver.query.count() == 0:
        db.session.add_all([
            Driver(driver_id='DRV-001', name='Ramesh Kumar', phone='+91 98765 43210', license_no='DL-1234567890'),
            Driver(driver_id='DRV-002', name='Suresh Reddy', phone='+91 98765 43211', license_no='DL-1234567891'),
            Driver(driver_id='DRV-003', name='Mahesh Sharma', phone='+91 98765 43212', license_no='DL-1234567892'),
        ])
        db.session.commit()
        print("✅ Default drivers created.")


# ══════════════════════════════════════════════════
#  BUSES
# ══════════════════════════════════════════════════
@app.route('/api/buses', methods=['GET'])
def get_buses():
    today = datetime.utcnow().date()
    buses = Bus.query.all()
    result = []

    for b in buses:
        bus_dict = b.to_dict()

        # Get today's assigned driver
        today_assign = Assignment.query.filter_by(
            bus_id=b.id, assignment_date=today
        ).first()

        if today_assign:
            drv = Driver.query.get(today_assign.driver_id)
            if drv:
                bus_dict['today_driver_name'] = drv.name
                bus_dict['today_driver_id'] = drv.driver_id
                bus_dict['today_driver_phone'] = drv.phone or ''
                bus_dict['today_shift'] = today_assign.shift
            else:
                bus_dict['today_driver_name'] = None
        else:
            bus_dict['today_driver_name'] = None

        result.append(bus_dict)

    return jsonify(result)


@app.route('/api/buses', methods=['POST'])
def add_bus():
    data = request.json
    if not data.get('bus_number') or not data.get('route'):
        return jsonify({'error': 'Bus number and route required'}), 400
    if Bus.query.filter_by(bus_number=data['bus_number']).first():
        return jsonify({'error': 'Bus number already exists'}), 409

    bus = Bus(
        bus_number=data['bus_number'],
        route=data['route'],
        capacity=int(data.get('capacity', 50))
    )
    db.session.add(bus)
    db.session.commit()
    return jsonify({'message': 'Bus added', 'bus': bus.to_dict()}), 201


@app.route('/api/buses/<bus_number>', methods=['PUT'])
def update_bus(bus_number):
    bus = Bus.query.filter_by(bus_number=bus_number).first()
    if not bus:
        return jsonify({'error': 'Bus not found'}), 404
    data = request.json
    if data.get('route'):
        bus.route = data['route']
    if data.get('capacity'):
        bus.capacity = int(data['capacity'])
    db.session.commit()
    return jsonify({'message': f'Bus {bus_number} updated', 'bus': bus.to_dict()})


@app.route('/api/buses/<bus_number>', methods=['DELETE'])
def delete_bus(bus_number):
    bus = Bus.query.filter_by(bus_number=bus_number).first()
    if not bus:
        return jsonify({'error': 'Bus not found'}), 404
    BusVisit.query.filter_by(bus_id=bus.id).delete()
    Assignment.query.filter_by(bus_id=bus.id).delete()
    db.session.delete(bus)
    db.session.commit()
    return jsonify({'message': f'Bus {bus_number} deleted'})


# ══════════════════════════════════════════════════
#  DRIVERS
# ══════════════════════════════════════════════════
@app.route('/api/drivers', methods=['GET'])
def get_drivers():
    return jsonify([d.to_dict() for d in Driver.query.all()])


@app.route('/api/drivers', methods=['POST'])
def add_driver():
    data = request.json
    if not data.get('driver_id') or not data.get('name'):
        return jsonify({'error': 'Driver ID and name required'}), 400
    if Driver.query.filter_by(driver_id=data['driver_id']).first():
        return jsonify({'error': 'Driver ID already exists'}), 409

    driver = Driver(
        driver_id=data['driver_id'],
        name=data['name'],
        phone=data.get('phone', ''),
        license_no=data.get('license_no', '')
    )
    db.session.add(driver)
    db.session.commit()
    return jsonify({'message': 'Driver added', 'driver': driver.to_dict()}), 201


@app.route('/api/drivers/<driver_id>', methods=['PUT'])
def update_driver(driver_id):
    driver = Driver.query.filter_by(driver_id=driver_id).first()
    if not driver:
        return jsonify({'error': 'Driver not found'}), 404
    data = request.json
    if data.get('name'):
        driver.name = data['name']
    if 'phone' in data:
        driver.phone = data['phone']
    if 'license_no' in data:
        driver.license_no = data['license_no']
    db.session.commit()
    return jsonify({'message': 'Driver updated', 'driver': driver.to_dict()})


@app.route('/api/drivers/<driver_id>', methods=['DELETE'])
def delete_driver(driver_id):
    driver = Driver.query.filter_by(driver_id=driver_id).first()
    if not driver:
        return jsonify({'error': 'Driver not found'}), 404
    Assignment.query.filter_by(driver_id=driver.id).delete()
    db.session.delete(driver)
    db.session.commit()
    return jsonify({'message': f'Driver {driver_id} deleted'})


# ══════════════════════════════════════════════════
#  ASSIGNMENTS
# ══════════════════════════════════════════════════
@app.route('/api/assignments', methods=['GET'])
def get_assignments():
    date_filter = request.args.get('date')
    query = Assignment.query
    if date_filter:
        try:
            d = datetime.strptime(date_filter, '%Y-%m-%d').date()
            query = query.filter_by(assignment_date=d)
        except Exception:
            pass
    return jsonify([a.to_dict() for a in query.order_by(Assignment.assignment_date.desc()).all()])


@app.route('/api/assignments', methods=['POST'])
def add_assignment():
    data = request.json
    driver_id_str = data.get('driver_id')
    bus_number = data.get('bus_number')
    assign_date = data.get('assignment_date')
    shift = data.get('shift', 'Full Day')

    if not driver_id_str or not bus_number or not assign_date:
        return jsonify({'error': 'Driver, Bus, and Date required'}), 400

    driver = Driver.query.filter_by(driver_id=driver_id_str).first()
    if not driver:
        return jsonify({'error': 'Driver not found'}), 404
    bus = Bus.query.filter_by(bus_number=bus_number).first()
    if not bus:
        return jsonify({'error': 'Bus not found'}), 404

    try:
        assign_date_obj = datetime.strptime(assign_date, '%Y-%m-%d').date()
    except Exception:
        return jsonify({'error': 'Invalid date format'}), 400

    existing = Assignment.query.filter_by(
        bus_id=bus.id, assignment_date=assign_date_obj, shift=shift).first()
    if existing:
        return jsonify({'error': f'Bus {bus_number} already assigned for {assign_date} ({shift})'}), 409

    assignment = Assignment(
        driver_id=driver.id,
        bus_id=bus.id,
        assignment_date=assign_date_obj,
        shift=shift
    )
    db.session.add(assignment)
    db.session.commit()
    return jsonify({'message': 'Assignment created', 'assignment': assignment.to_dict()}), 201


@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    a = Assignment.query.get(assignment_id)
    if not a:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(a)
    db.session.commit()
    return jsonify({'message': 'Removed'})


# ══════════════════════════════════════════════════
#  BUS ENTRY/EXIT SCAN
# ══════════════════════════════════════════════════
@app.route('/api/scan-bus', methods=['POST'])
def scan_bus():
    data = request.json
    bus_number = data.get('bus_number', '').strip()

    if not bus_number:
        return jsonify({'error': 'Bus QR code required'}), 400

    bus = Bus.query.filter_by(bus_number=bus_number).first()
    if not bus:
        return jsonify({'error': f'Invalid QR. Bus {bus_number} not found.'}), 404

    # Check if this bus is currently inside college
    active_visit = BusVisit.query.filter_by(
        bus_id=bus.id, status='INSIDE'
    ).order_by(BusVisit.entry_time.desc()).first()

    # Get today's driver
    today = now_ist().date()
    today_assign = Assignment.query.filter_by(
        bus_id=bus.id, assignment_date=today).first()
    driver_name = '-'
    if today_assign:
        drv = Driver.query.get(today_assign.driver_id)
        driver_name = drv.name if drv else '-'

    if active_visit:
        # EXIT — bus is leaving
        active_visit.exit_time = now_ist()
        active_visit.status = 'COMPLETED'
        db.session.commit()

        diff = active_visit.exit_time - active_visit.entry_time
        total_sec = int(diff.total_seconds())
        hours = total_sec // 3600
        mins = (total_sec % 3600) // 60
        duration = f"{hours}h {mins}m"

        return jsonify({
            'action': 'EXIT',
            'message': f'🚪 {bus.bus_number} LEFT college',
            'bus_number': bus.bus_number,
            'route': bus.route,
            'driver_name': driver_name,
            'entry_time': active_visit.entry_time.isoformat(),
            'exit_time': active_visit.exit_time.isoformat(),
            'duration': duration
        })
    else:
        # ENTRY — bus is arriving
        visit = BusVisit(bus_id=bus.id, entry_time=now_ist(), status='INSIDE')
        db.session.add(visit)
        db.session.commit()

        return jsonify({
            'action': 'ENTRY',
            'message': f'✅ {bus.bus_number} ENTERED college',
            'bus_number': bus.bus_number,
            'route': bus.route,
            'driver_name': driver_name,
            'entry_time': visit.entry_time.isoformat()
        })


# ══════════════════════════════════════════════════
#  VISIT HISTORY
# ══════════════════════════════════════════════════
# ══════════════════════════════════════════════════
#  CLEAR HISTORY
# ══════════════════════════════════════════════════
@app.route('/api/visits/clear-all', methods=['DELETE'])
def clear_all_visits():
    """Delete ALL visit records"""
    try:
        count = BusVisit.query.count()
        BusVisit.query.delete()
        db.session.commit()
        return jsonify({
            'message': f'✅ Deleted all {count} records'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/visits/clear-old', methods=['DELETE'])
def clear_old_visits():
    """Delete records older than 30 days"""
    try:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=30)
        old_visits = BusVisit.query.filter(BusVisit.entry_time < cutoff)
        count = old_visits.count()
        old_visits.delete()
        db.session.commit()
        return jsonify({
            'message': f'✅ Deleted {count} records older than 30 days'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/visits/<int:visit_id>', methods=['DELETE'])
def delete_visit(visit_id):
    """Delete a specific visit record"""
    visit = BusVisit.query.get(visit_id)
    if not visit:
        return jsonify({'error': 'Visit not found'}), 404
    db.session.delete(visit)
    db.session.commit()
    return jsonify({'message': 'Visit deleted'})


@app.route('/api/visits/clear-by-date', methods=['DELETE'])
def clear_visits_by_date():
    """Delete all visits on a specific date"""
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Date required'}), 400

    try:
        d = datetime.strptime(date_str, '%Y-%m-%d').date()
        visits = BusVisit.query.filter(
            db.func.date(BusVisit.entry_time) == d
        )
        count = visits.count()
        visits.delete()
        db.session.commit()
        return jsonify({
            'message': f'✅ Deleted {count} records from {date_str}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    bus_number = request.args.get('bus_number')
    status = request.args.get('status')
    date_str = request.args.get('date')

    query = BusVisit.query
    if bus_number:
        bus = Bus.query.filter_by(bus_number=bus_number).first()
        if bus:
            query = query.filter_by(bus_id=bus.id)
    if status:
        query = query.filter_by(status=status)
    if date_str:
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
            query = query.filter(db.func.date(BusVisit.entry_time) == d)
        except Exception:
            pass

    visits = query.order_by(BusVisit.entry_time.desc()).limit(200).all()
    return jsonify([v.to_dict() for v in visits])


# ══════════════════════════════════════════════════
#  DASHBOARD
# ══════════════════════════════════════════════════
@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    try:
        today = now_ist().date()

        buses_inside = BusVisit.query.filter_by(status='INSIDE').count()

        today_entries = BusVisit.query.filter(
            db.func.date(BusVisit.entry_time) == today).count()
        today_exits = BusVisit.query.filter(
            db.func.date(BusVisit.exit_time) == today,
            BusVisit.status == 'COMPLETED'
        ).count()

        # List all buses with their current status
        buses = Bus.query.all()
        bus_status = []
        for b in buses:
            active = BusVisit.query.filter_by(bus_id=b.id, status='INSIDE').first()

            today_assign = Assignment.query.filter_by(
                bus_id=b.id, assignment_date=today).first()
            driver_name = '-'
            if today_assign:
                drv = Driver.query.get(today_assign.driver_id)
                driver_name = drv.name if drv else '-'

            bus_status.append({
                'bus_number': b.bus_number,
                'route': b.route,
                'status': 'INSIDE' if active else 'OUTSIDE',
                'entry_time': active.entry_time.isoformat() if active else None,
                'today_driver': driver_name
            })

        return jsonify({
            'total_buses': Bus.query.count(),
            'total_drivers': Driver.query.count(),
            'buses_inside': buses_inside,
            'buses_outside': Bus.query.count() - buses_inside,
            'today_entries': today_entries,
            'today_exits': today_exits,
            'today_assignments': Assignment.query.filter_by(assignment_date=today).count(),
            'bus_status': bus_status
        })
    except Exception as e:
        print(f"Dashboard error: {e}")
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════
#  QR CODES DOWNLOAD
# ══════════════════════════════════════════════════
@app.route('/api/generate-qrs', methods=['POST'])
def generate_qrs():
    try:
        import qrcode
        buses = Bus.query.all()
        zip_buffer = BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for bus in buses:
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_H,
                    box_size=15,
                    border=4
                )
                qr.add_data(bus.bus_number)
                qr.make(fit=True)
                img = qr.make_image(fill_color='black', back_color='white')
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                zf.writestr(f'{bus.bus_number}.png', img_buffer.getvalue())

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name='bus_qr_codes.zip'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚌 Bus Gate Scanner running on port {port}")
    app.run(debug=False, port=port, host='0.0.0.0')