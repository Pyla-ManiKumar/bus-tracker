from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

def now_ist():
    return datetime.now(IST).replace(tzinfo=None)

db = SQLAlchemy()


class Bus(db.Model):
    __tablename__ = 'buses'

    id = db.Column(db.Integer, primary_key=True)
    bus_number = db.Column(db.String(20), unique=True, nullable=False)
    route = db.Column(db.String(150))
    capacity = db.Column(db.Integer, default=50)

    def to_dict(self):
        return {
            'id': self.id,
            'bus_number': self.bus_number,
            'route': self.route,
            'capacity': self.capacity
        }


class Driver(db.Model):
    __tablename__ = 'drivers'

    id = db.Column(db.Integer, primary_key=True)
    driver_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    license_no = db.Column(db.String(50))

    def to_dict(self):
        return {
            'id': self.id,
            'driver_id': self.driver_id,
            'name': self.name,
            'phone': self.phone or '',
            'license_no': self.license_no or ''
        }


class Assignment(db.Model):
    __tablename__ = 'assignments'

    id = db.Column(db.Integer, primary_key=True)
    driver_id = db.Column(db.Integer, db.ForeignKey('drivers.id'), nullable=False)
    bus_id = db.Column(db.Integer, db.ForeignKey('buses.id'), nullable=False)
    assignment_date = db.Column(db.Date, nullable=False, default=date.today)
    shift = db.Column(db.String(20), default='Full Day')

    def to_dict(self):
        driver = Driver.query.get(self.driver_id)
        bus = Bus.query.get(self.bus_id)
        return {
            'id': self.id,
            'driver_id': driver.driver_id if driver else '-',
            'driver_name': driver.name if driver else '-',
            'driver_phone': driver.phone if driver else '-',
            'bus_number': bus.bus_number if bus else '-',
            'route': bus.route if bus else '-',
            'assignment_date': self.assignment_date.isoformat() if self.assignment_date else None,
            'shift': self.shift
        }


class BusVisit(db.Model):
    """Tracks bus entering and leaving college"""
    __tablename__ = 'bus_visits'

    id = db.Column(db.Integer, primary_key=True)
    bus_id = db.Column(db.Integer, db.ForeignKey('buses.id'), nullable=False)
    entry_time = db.Column(db.DateTime, default=datetime.utcnow)
    exit_time = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='INSIDE')  # INSIDE or COMPLETED

    def to_dict(self):
        bus = Bus.query.get(self.bus_id)
        duration = '-'
        if self.exit_time and self.entry_time:
            diff = self.exit_time - self.entry_time
            total_sec = int(diff.total_seconds())
            hours = total_sec // 3600
            mins = (total_sec % 3600) // 60
            duration = f"{hours}h {mins}m"

        # Get driver for that day
        driver_name = '-'
        if self.entry_time:
            assign = Assignment.query.filter_by(
                bus_id=self.bus_id,
                assignment_date=self.entry_time.date()
            ).first()
            if assign:
                drv = Driver.query.get(assign.driver_id)
                if drv:
                    driver_name = drv.name

        return {
            'id': self.id,
            'bus_number': bus.bus_number if bus else '-',
            'route': bus.route if bus else '-',
            'entry_time': self.entry_time.isoformat() if self.entry_time else None,
            'exit_time': self.exit_time.isoformat() if self.exit_time else None,
            'status': self.status,
            'duration': duration,
            'driver_name': driver_name
        }