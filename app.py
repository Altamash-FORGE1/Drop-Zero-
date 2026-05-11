import os
import uuid
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

CORS(app)

# Database Configuration
database_url = os.getenv('DATABASE_URL')
if database_url and database_url.startswith("postgres://"):
    # SQLAlchemy 1.4+ dropped support for the "postgres://" prefix.
    # This ensures compatibility if the environment provides the older scheme.
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Groq Client
api_key = os.getenv('GROQ_API_KEY')
groq_client = None

if api_key:
    groq_client = Groq(api_key=api_key)
else:
    app.logger.warning("GROQ_API_KEY not found. AI features will be disabled.")

# --- Database Models ---
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    family_income = db.Column(db.Float)
    attendance_rate = db.Column(db.Float)
    fee_delays = db.Column(db.Integer)
    risk_level = db.Column(db.String(20))

class VaultFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)

class ExchangeItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    donor_name = db.Column(db.String(100), default="Anonymous Student")
    image_filename = db.Column(db.String(255))

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

# Flask will now automatically serve files like styles.css and app.js 
# because static_url_path is set to ''. 

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

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
        return jsonify({"error": "AI service is not configured on the server (missing API key)."}), 500
        
    data = request.get_json()
    if not data or 'messages' not in data:
        return jsonify({"error": "Missing 'messages' in request body"}), 400
        
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
        return jsonify({"response": completion.choices[0].message.content})
    except Exception as e:
        error_message = str(e)
        app.logger.error(f"Groq API Error in Chatbot: {error_message}")
        return jsonify({"error": f"AI service error: {error_message}"}), 500

@app.route('/api/student/insight', methods=['POST'])
def student_insight():
    if not groq_client:
        return jsonify({"insight": "AI configuration missing."}), 500

    student_data = request.get_json() or {}
    prompt = f"Summarize your risk profile for you as a student. All financial values are in INR (₹). Use clear, concise bullet points for the main risks and one bold recommendation. Data: {student_data}"
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

# --- Vault API Routes ---

@app.route('/api/vault/upload', methods=['POST'])
def upload_vault_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else ''
        unique_filename = f"{uuid.uuid4().hex}.{ext}"
        
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        new_file = VaultFile(filename=unique_filename, original_name=original_name)
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({"message": "File uploaded successfully", "id": new_file.id}), 201

@app.route('/api/vault/files', methods=['GET'])
def list_vault_files():
    files = VaultFile.query.all()
    return jsonify([{
        "id": f.id,
        "original_name": f.original_name,
        "filename": f.filename
    } for f in files])

@app.route('/api/vault/files/<int:file_id>', methods=['DELETE'])
def delete_vault_file(file_id):
    vault_file = VaultFile.query.get_or_404(file_id)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], vault_file.filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.session.delete(vault_file)
    db.session.commit()
    
    return jsonify({"message": "File deleted successfully"})

@app.route('/api/vault/view/<filename>')
def view_vault_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- Exchange Hub API Routes ---

@app.route('/api/exchange/items', methods=['GET'])
def list_exchange_items():
    items = ExchangeItem.query.all()
    return jsonify([{
        "id": i.id,
        "title": i.title,
        "donor_name": i.donor_name,
        "image_filename": i.image_filename
    } for i in items])

@app.route('/api/exchange/upload', methods=['POST'])
def upload_exchange_item():
    title = request.form.get('title')
    donor_name = request.form.get('donor_name', 'Anonymous Student')
    file = request.files.get('file')
    
    image_filename = None
    if file and file.filename != '':
        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else ''
        image_filename = f"exchange_{uuid.uuid4().hex}.{ext}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], image_filename))
    
    new_item = ExchangeItem(title=title, donor_name=donor_name, image_filename=image_filename)
    db.session.add(new_item)
    db.session.commit()
    return jsonify({"message": "Item posted successfully", "id": new_item.id}), 201

if __name__ == '__main__':
    with app.app_context():
        app.logger.info("Synchronizing database schemas...")
        db.create_all()
        app.logger.info("Database synchronization complete.")
    app.run(host='0.0.0.0', port=5000, debug=True)