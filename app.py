import os
import uuid
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
import mimetypes
from sqlalchemy import text
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
import time
import logging

# Set up logging immediately
logging.basicConfig(level=logging.INFO)

load_dotenv()

# Ensure proper MIME types for static files in proxy environments
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')
app = Flask(__name__, static_folder='.', static_url_path='', template_folder='.')
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

CORS(app)

# Database Configuration
database_url = os.getenv('DATABASE_URL')
if not database_url:
    database_url = 'sqlite:///dropzero.db'
elif database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Groq Client
api_key = os.getenv('GROQ_API_KEY')
groq_client = None

if api_key and api_key.strip() and not api_key.startswith("your_"):
    try:
        groq_client = Groq(api_key=api_key)
        app.logger.info("Groq AI client initialized successfully.")
    except Exception as e:
        app.logger.error(f"Failed to initialize Groq client: {e}")
else:
    app.logger.warning("GROQ_API_KEY is missing or is the default placeholder. AI features will be disabled.")

# --- Database Models ---
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    family_income = db.Column(db.Float)
    attendance_rate = db.Column(db.Float)
    fee_delays = db.Column(db.Integer)
    risk_level = db.Column(db.String(20))

class ExchangeItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20))  # Borrow, Rent, Buy
    price = db.Column(db.Float, default=0.0)
    donor_name = db.Column(db.String(100), default="Anonymous Student")
    image_filename = db.Column(db.String(255))

class VaultItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))
    upload_date = db.Column(db.DateTime, default=db.func.current_timestamp())

# --- Risk Engine Logic ---
def calculate_risk(income, attendance, delays):
    score = (100 - attendance) * 0.5 + (delays * 15)
    if income < 20000: score += 30
    
    if score > 60: return "High"
    if score > 30: return "Medium"
    return "Low"

# --- API Routes ---

@app.route('/api/health')
def health_check():
    try:
        # Test database connection
        db.session.execute(text('SELECT 1'))
        student_count = Student.query.count()
        return jsonify({
            "status": "healthy", 
            "database": "connected",
            "total_records": student_count
        }), 200
    except Exception as e:
        app.logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "database": str(e)}), 500

@app.teardown_appcontext
def shutdown_session(exception=None):
    """Ensures database sessions are cleaned up after every request."""
    db.session.remove()

@app.errorhandler(Exception)
def handle_exception(e):
    """Handle all unhandled exceptions and return JSON instead of HTML."""
    app.logger.error(f"Unhandled Exception: {str(e)}")
    return jsonify({"error": "Internal Server Error", "message": str(e)}), 500

# Flask will now automatically serve files like styles.css and app.js 
# because static_url_path is set to ''. 

@app.route('/')
def index():
    google_client_id = os.getenv('GOOGLE_CLIENT_ID', '722211810013-j3pmc5f0abkqhkeqi0cdl8euu5fs7rem.apps.googleusercontent.com')
    return render_template('index.html', google_client_id=google_client_id)

@app.after_request
def add_security_headers(response):
    """Ensures Google Auth popups can communicate with the main window."""
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
    # Allow the app to be viewed inside the GitHub Codespaces preview pane
    response.headers['Content-Security-Policy'] = "frame-ancestors 'self' https://*.github.dev https://*.github.com;"
    return response

@app.route('/api/risk-assessment', methods=['POST'])
def assess_risk():
    data = request.json
    income = data.get('income', 50000)
    attendance = data.get('attendance', 100)
    delays = data.get('delays', 0)
    
    risk = calculate_risk(income, attendance, delays)
    
    # FIX: Add unique identifiers to prevent DB Unique Constraint failures on refresh
    unique_id = str(uuid.uuid4())[:8]
    new_student = Student(
        name=f"Demo Student {unique_id}",
        email=f"student_{unique_id}@example.com",
        family_income=income, 
        attendance_rate=attendance, 
        fee_delays=delays, 
        risk_level=risk
    )
    db.session.add(new_student)
    db.session.commit()
    
    return jsonify({"risk_level": risk, "status": "success"})

@app.route('/api/chat', methods=['POST'])
def chatbot():
    if not groq_client:
        return jsonify({"error": "AI service is currently unavailable. Please check the server configuration."}), 503
        
    data = request.get_json()
    if not data or 'messages' not in data:
        return jsonify({"error": "Invalid request: messages are required."}), 400
        
    messages = data.get('messages')
    if not isinstance(messages, list) or not all(isinstance(m, dict) and 'role' in m and 'content' in m for m in messages):
        return jsonify({"error": "Invalid 'messages' format. Expected a list of objects with 'role' and 'content'."}), 400

    # Basic validation for content within the messages list
    for msg_obj in messages:
        if not msg_obj['content'] or not str(msg_obj['content']).strip():
            return jsonify({"error": "Message content cannot be empty or just whitespace."}), 400

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages # Pass the entire list of messages
        )
        
        if not completion.choices or not completion.choices[0].message:
            return jsonify({"error": "AI service returned an empty completion."}), 502
            
        return jsonify({"response": completion.choices[0].message.content.strip() or ""})
    except Exception as e:
        error_message = str(e)
        app.logger.error(f"Groq API Error in Chatbot: {error_message}")
        if "401" in error_message:
            return jsonify({"error": "Authentication failed with the AI provider."}), 401
        if "limit" in error_message.lower():
            return jsonify({"error": "Rate limit exceeded. Please try again in a moment."}), 429
        return jsonify({"error": "An error occurred while communicating with the AI."}), 500

@app.route('/api/student/insight', methods=['POST'])
def student_insight():
    if not groq_client:
        return jsonify({"insight": "AI Assistant is offline. Please check your API key."}), 503

    student_data = request.get_json() or {}
    prompt = f"Summarize the academic and financial risk profile for a student with the following data: {student_data}. All financial values are in INR (₹). Use clear, concise bullet points for the main risks and provide one bold, actionable recommendation."
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are an expert academic risk profiler. Use structured bullet points."},
                {"role": "user", "content": prompt}
            ]
        )
        return jsonify({"insight": completion.choices[0].message.content})
    except Exception as e:
        app.logger.error(f"Groq API Error in Advisor Insight: {str(e)}")
        return jsonify({"insight": "Could not generate insight at this time."}), 500

# --- Exchange Hub API Routes ---

@app.route('/api/exchange/items', methods=['GET'])
def list_exchange_items():
    items = ExchangeItem.query.all()
    return jsonify([{
        "id": i.id,
        "title": i.title,
        "type": i.type,
        "price": i.price,
        "donor_name": i.donor_name,
        "image_filename": i.image_filename
    } for i in items])

@app.route('/api/exchange/upload', methods=['POST'])
def upload_exchange_item():
    title = request.form.get('title')
    item_type = request.form.get('type', 'Buy')
    price = float(request.form.get('price', 0))
    donor_name = request.form.get('donor_name', 'Anonymous Student')
    file = request.files.get('file')
    
    image_filename = None
    if file and file.filename != '':
        ext = secure_filename(file.filename).rsplit('.', 1)[1].lower() if '.' in file.filename else 'png'
        image_filename = f"exchange_{uuid.uuid4().hex}.{ext}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], image_filename))
    
    new_item = ExchangeItem(title=title, type=item_type, price=price, donor_name=donor_name, image_filename=image_filename)
    db.session.add(new_item)
    db.session.commit()
    return jsonify({"message": "Item posted successfully", "id": new_item.id}), 201

@app.route('/api/exchange/view/<filename>')
def view_exchange_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- Vault API Routes ---

@app.route('/api/vault/items', methods=['GET'])
def list_vault_items():
    items = VaultItem.query.all()
    return jsonify([{
        "id": i.id,
        "filename": i.filename,
        "original_name": i.original_name,
        "file_type": i.file_type,
        "upload_date": i.upload_date.strftime("%Y-%m-%d %H:%M")
    } for i in items])

@app.route('/api/vault/upload', methods=['POST'])
def upload_vault_item():
    file = request.files.get('file')
    if not file or file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    original_name = secure_filename(file.filename)
    ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else 'file'
    filename = f"vault_{uuid.uuid4().hex}.{ext}"
    
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    
    new_item = VaultItem(filename=filename, original_name=original_name, file_type=file.content_type)
    db.session.add(new_item)
    db.session.commit()
    return jsonify({"message": "File uploaded", "id": new_item.id}), 201

@app.route('/api/vault/delete/<int:item_id>', methods=['DELETE'])
def delete_vault_item(item_id):
    item = VaultItem.query.get_or_404(item_id)
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], item.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

def init_db():
    """Initialize database with retries and schema patches."""
    with app.app_context():
        max_retries = 5
        for attempt in range(max_retries):
            try:
                app.logger.info(f"Database sync attempt {attempt + 1}...")
                # 1. Test connection
                db.session.execute(text('SELECT 1'))
                db.session.commit()
                db.session.remove()
                
                # 2. Create tables if they don't exist
                db.create_all()
                
                app.logger.info("Database synchronized successfully.")
                return True
            except Exception as e:
                db.session.rollback()
                if attempt < max_retries - 1:
                    app.logger.warning(f"DB connection failed, retrying in 2s... {e}")
                    time.sleep(2)
                else:
                    app.logger.error(f"Could not connect to database after {max_retries} attempts.")
                    return False
    return False

if __name__ == '__main__':
    # Initialize DB before starting server
    if not init_db():
        app.logger.error("Database synchronization failed. Continuing startup, but DB features may be unavailable.")
    
    # Binding to 0.0.0.0 is essential for Docker/Codespaces access
    # debug=True provides better error logs; use_reloader=False prevents double-init in Docker
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)