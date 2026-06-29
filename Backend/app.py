# Author: Natasha Mulumba
# import library to get API from .env file
from dotenv import load_dotenv
# import libraries for flask and google genai
from flask import Flask, request, jsonify
from flask_cors import CORS 
from flask_mail import Mail, Message
from google import genai
import os
import mysql.connector

app = Flask(__name__)
CORS(app)

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API'))


# Configure Flask-Mail using environment variables
app.config['MAIL_SERVER']   = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT']     = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS']  = os.getenv('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = (
    os.getenv('MAIL_SENDER_NAME', 'Serenity Wellness Centre'),
    os.getenv('MAIL_USERNAME')
)

mail = Mail(app)


# Get prompt text from textfile
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPT_PATH = os.path.join(BASE_DIR, 'prompt.txt')
with open(PROMPT_PATH, 'r') as file:
    SYSTEM_PROMPT = file.read()
# Allow genai to use API key from .env file


@app.route('/chat', methods =['POST'])
def chat():
    data = request.get_json() # get the data from the request
    user_message = data['message'] # get the message from the data
    response = client.models.generate_content(model="gemini-3.5-flash", contents=SYSTEM_PROMPT + "\n\nPatient: " + user_message)
    return jsonify({'reply': response.text})

# create a new route to fetch therapy data from database
@app.route('/api/therapists', methods=['GET'])
def get_therapists():
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            port=int(os.getenv('DB_PORT',3306))
        )
        cursor = conn.cursor(dictionary=True) # convert row to dictionary format
        # query doctors from Database
        cursor.execute( """
                       SELECT id, first_name, last_name, title, specialisation, bio, price
                       FROM doctors
                       ORDER by last_name
                       """
        )
        therapists = cursor.fetchall() # add rows found into a list
        cursor.close()
        conn.close()
        return jsonify(therapists) # convert python list of dictionaries into JSON Format
    except Exception as e:
        return jsonify({'error': str(e)}),500 # error handling
    
#  get available days and times for each doctor
@app.route('/api/availability', methods=['GET'])
def get_availability():
    try:
        doctor_id = request.args.get('doctor_id') #read doctor id from URL
        if not doctor_id:
            return jsonify({'error': 'doctor_id required'}), 400

        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            port=int(os.getenv('DB_PORT', 3306))
        )
        cursor = conn.cursor(dictionary=True)

        # Get the days this doctor works
        cursor.execute("""
            SELECT day FROM availability
            WHERE doctor_id = %s
        """, (doctor_id,))
        days = [row['day'] for row in cursor.fetchall()]  # turns list of row dictionaries to plain list

        # Get already booked slots for this doctor
        cursor.execute("""
            SELECT appt_date, appt_time FROM appointments
            WHERE doctor_id = %s
        """, (doctor_id,))
        booked = [
            {'date': str(row['appt_date']), 'time': row['appt_time']}
            for row in cursor.fetchall()
        ]

        cursor.close()
        conn.close()

        return jsonify({
            'working_days': days,
            'booked_slots': booked
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

# Send booking confirmation email to the patient
def send_confirmation_email(to_email, data, reference):
    try:
        msg = Message(
            subject="Your Serenity Wellness Centre Booking Confirmation",
            recipients=[to_email]
        )
        msg.html = f"""
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #2b2a26;">

            <div style="background: #5f7766; padding: 24px 32px;">
                <h1 style="color: white; font-family: Georgia, serif; margin: 0; font-size: 1.4rem;">
                    Serenity Wellness Centre
                </h1>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 0.9rem;">
                    Booking Confirmation
                </p>
            </div>

            <div style="padding: 32px;">
                <p style="font-size: 1rem; margin-bottom: 8px;">
                    Dear <strong>{data['patient_name']}</strong>,
                </p>
                <p style="color: #5f7766; font-size: 0.9rem; margin-bottom: 24px;">
                    Your session has been confirmed. Here are your booking details:
                </p>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 24px;">
                    <tr style="border-bottom: 1px solid #f7f4ee;">
                        <td style="padding: 10px 0; color: #888; width: 140px;">Reference</td>
                        <td style="padding: 10px 0; font-weight: 600; color: #5f7766;">{reference}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f7f4ee;">
                        <td style="padding: 10px 0; color: #888;">Therapist</td>
                        <td style="padding: 10px 0;">{data['doctor_name']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f7f4ee;">
                        <td style="padding: 10px 0; color: #888;">Date</td>
                        <td style="padding: 10px 0;">{data['appt_date']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f7f4ee;">
                        <td style="padding: 10px 0; color: #888;">Time</td>
                        <td style="padding: 10px 0;">{data['appt_time']}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #888;">Session type</td>
                        <td style="padding: 10px 0;">In-person / Online</td>
                    </tr>
                </table>

                <div style="background: #f7f4ee; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 0.85rem;">
                    <strong>Before your first session:</strong><br><br>
                    Please arrive <strong>30–45 minutes early</strong> to complete your intake forms 
                    and arrange payment and medical aid. Bring your <strong>ID</strong> and 
                    <strong>medical aid card</strong> if applicable.
                </div>

                <p style="font-size: 0.85rem; color: #888; margin-bottom: 4px;">
                    Need to cancel or reschedule? Please give us at least <strong style="color: #5f7766;">24 hours' notice</strong>.
                </p>
                <p style="font-size: 0.85rem; color: #888;">
                    Call our receptionist Cleo on <strong style="color: #2b2a26;">015 783 2323</strong> or reply to this email to make any changes.
                </p>
            </div>

            <div style="background: #f7f4ee; padding: 16px 32px; font-size: 0.78rem; color: #888; text-align: center;">
                &copy; 2026 Serenity Wellness Centre &middot; All rights reserved
            </div>

        </div>
        """
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False
    
# Write a new appointment booking to the database
@app.route('/api/bookings', methods=['POST'])
def create_booking():
    try:
        data = request.get_json()

        # Generate a unique reference number
        import random, string
        ref = 'SWC-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))

        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            port=int(os.getenv('DB_PORT', 3306))
        )
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO appointments (
                doctor_id, patient_name, patient_dob,
                patient_phone, patient_email, emergency_contact,
                prev_therapy, prev_detail, presenting,
                medications, appt_date, appt_time, reference
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            data['doctor_id'],
            data['patient_name'],
            data['patient_dob'],
            data['patient_phone'],
            data['patient_email'],
            data['emergency_contact'],
            data['prev_therapy'],
            data.get('prev_detail', None),
            data['presenting'],
            data['medications'],
            data['appt_date'],
            data['appt_time'],
            ref
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'reference': ref})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    app.run(debug=True)

