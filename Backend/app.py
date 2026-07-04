# Author: Natasha Mulumba
# import library to get API from .env file
from dotenv import load_dotenv
# import libraries for flask and google genai
from flask import Flask, request, jsonify
from flask_cors import CORS 
from flask_mail import Mail, Message
from google import genai
import os
import json
import mysql.connector

app = Flask(__name__)
CORS(app)

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API'))

INTERCEPT_EMAILS = True
DEVELOPER_EMAIL = os.getenv('DEVELOPER_EMAIL')

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
def build_match_prompt(patient_profile, doctor_list):

    # Bio lookup keyed by doctor ID
    bios = {
        1: "Best suited to clients across all life stages presenting with complex psychological conditions including personality disorders, psychosis, and severe mood instability. Particularly effective with families and couples where one member's clinical diagnosis is affecting the entire system.",
        2: "Best suited to individuals and families navigating grief, relational breakdown, or persistent low mood who need a warm, culturally attuned space to process. Particularly effective with clients who feel unheard in their relationships or are carrying unresolved loss.",
        3: "Best suited to older children, teens, and adults carrying trauma, PTSD, or mood instability who need a structured, evidence-based approach to reclaim their narrative. Particularly effective with clients who have tried conventional therapy before and need a more meaning-focused framework.",
        4: "Best suited to children, teens, and adults dealing with a wide range of concerns from anxiety and grief to identity questions and substance use. Particularly effective with younger clients and those whose issues benefit from exploratory, relationship-centred work rather than a structured protocol.",
        5: "Best suited to adults experiencing anxiety, low mood, or a sense of being stuck at a life crossroads who respond well to practical, present-focused techniques. Particularly effective with clients who want concrete tools alongside deeper self-awareness.",
        6: "Best suited to teens and adults who have experienced trauma and need a therapist who works at the emotional depth of the wound rather than just its surface symptoms. Particularly effective with clients whose trauma has disrupted their capacity for trust or close relationships.",
        7: "Best suited to working individuals whose mental health struggles are rooted in professional pressure, financial anxiety, or career uncertainty rather than clinical history. Particularly effective with clients who need both psychological support and practical direction to move forward at work.",
        8: "Best suited to individuals dealing with anxiety, disrupted sleep, or persistent low mood who prefer a structured, evidence-based approach with clear techniques to practice between sessions. Particularly effective with clients whose physical symptoms such as insomnia are tied to underlying emotional patterns.",
        9: "Best suited to adults navigating significant life changes, loss, or a search for renewed direction who want a strengths-focused, future-oriented space rather than a clinical diagnosis. Particularly effective with clients who feel their resilience is there but need help finding it again.",
        10: "Best suited to adults and older clients dealing with anxiety, depression, or work-related stress who benefit from a flexible, multi-modal approach grounded in their existing strengths. Particularly effective with clients who have had mixed results with a single therapy modality and need an approach tailored to their neurological and psychological profile.",
        11: "Best suited to adults recovering from complex trauma, narcissistic abuse, or a significant career disruption who need a therapist who combines self-compassion work with practical forward movement. Particularly effective with clients who are highly self-critical or have spent years minimising the impact of what they experienced.",
        12: "Best suited to adults and couples whose primary pain point is relational, recurring conflict, family breakdown, or a sense of disconnection in their closest relationships. Particularly effective with clients who have tried resolving relationship issues independently and need a skilled third party to help shift entrenched patterns.",
        13: "Best suited to adults experiencing persistent depression, anxiety, or a deep sense of emotional disturbance who are drawn to understanding the unconscious roots of their suffering rather than managing surface symptoms. Particularly effective with clients who are intellectually curious about their inner world and want depth over speed."
    }

    # Build the therapist list section
    therapist_lines = []
    for d in doctor_list:
        bio = bios.get(d['id'], '')
        line = (
            f"ID: {d['id']} | "
            f"Name: Dr {d['first_name']} {d['last_name']} | "
            f"Title: {d['title']} | "
            f"Specialisation: {d['specialisation']} | "
            f"Approach: {d['approach']} | "
            f"Language: {d['language']} | "
            f"Session type: {d['session_type']} | "
            f"Age group: {d['age_group']} | "
            f"Participants: {d['participants']} | "
            f"Gender: {d['gender']} | "
            f"Fee: R{d['price']} | "
            f"Bio: {bio}"
        )
        therapist_lines.append(line)

    therapist_block = "\n".join(therapist_lines)

    # Build the patient profile section
    gender_pref = patient_profile.get('therapistPrefs', {}).get('gender') or 'No preference'
    age_group = patient_profile.get('ageGroup') or 'Not specified'
    prior_worked = patient_profile.get('priorWorked') or 'Not provided'

    prompt = f"""You are a clinical matching assistant for Serenity Wellness Centre in South Africa.
    Your job is to recommend the single best therapist for a patient based on their profile and the available practitioners listed below.

    INSTRUCTIONS:
    - Read the presenting issue first and most carefully. It is the strongest signal.
    - Reason through each therapist step by step before deciding.
    - Apply hard filters in this order: participants, age group (for individuals only), language.
    - Then rank remaining therapists by: presenting issue fit, specialisation, approach, session type, gender preference.
    - Return ONLY valid JSON in the exact schema provided. No other text before or after.
    - You may ONLY recommend a therapist whose ID appears in the THERAPIST LIST below.
    - Do NOT invent names, specialisations, languages, or any other attributes.
    - If the presenting issue is incoherent or does not describe a real human experience, return a no_match result with gap_reason: "incoherent_input".
    - Write the reasoning field in second person directed at the user. Use "you" and "your". Never use "the patient", "the client", or any third-person reference to the user.
    - If no therapist meets all criteria together, return a no_match result with the single closest alternative doctor. The gap_reason must describe the combination of needs that could not be met together in plain, conversational English directed at the user. Do not reduce it to a single attribute. Do not use technical labels like "language:" or "gender:". Write it as a full natural sentence the user can read directly.
    - Examples of good gap_reason values:
        - "no therapist at Serenity speaks Zulu and specialises in anxiety and depression"
        - "no female therapist at Serenity speaks Sesotho and works with trauma"
        - "no therapist at Serenity offers in-person sessions and speaks Vietnamese"
    - Examples of bad gap_reason values:
        - "language: Zulu"
        - "gender preference unmet"
        - "session type mismatch"

    PATIENT PROFILE:
    - Presenting issue: {patient_profile.get('presentingIssue', '')}
    - Session for: {patient_profile.get('sessionFor', '')}
    - Age group: {age_group}
    - Preferred language: {patient_profile.get('language', '')}
    - Session type preference: {patient_profile.get('sessionType', '')}
    - Therapist gender preference: {gender_pref}
    - Prior therapy: {patient_profile.get('priorTherapy', '')}
    - What worked or did not in prior therapy: {prior_worked}

    THERAPIST LIST:
    {therapist_block}

    REASONING STEPS — work through each step before writing your answer:
    1. What is the core presenting issue? What type of specialisation and approach would best address it?
    2. Which therapists' specialisation and bio best match this presenting issue?
    3. Of those, which support the requested participant type ({patient_profile.get('sessionFor', '')})?
    4. Of those, which cover the age group ({age_group})?
    5. Of those, which speak {patient_profile.get('language', '')}?
    6. Of those, which match the session type preference ({patient_profile.get('sessionType', '')})?
    7. Of those, which match the gender preference ({gender_pref})?
    8. Who is the single strongest remaining match? State the doctor ID and explain why in one to two sentences.

    RESPONSE SCHEMA — return ONLY this JSON, no other text, no markdown, no code fences:

    If a strong match exists:
    {{
    "match": {{
        "doctor_id": <number>,
        "reasoning": "<1-2 sentences explaining the match directly to the user using you and your, not third-person language like the patient or the client>",
        "confidence": <number 0-100>
    }},
    "no_match": null,
    "gap_reason": null
    }}


    If no suitable match exists:
    {{
    "match": null,
    "no_match": {{
        "doctor_id": <number>,
        "reasoning": "<1-2 sentences directed to the user using you and your. Acknowledge the unmet preference honestly, then explain why this doctor is the closest fit in every other way.>",
        "gap_reason": "<full natural sentence describing what could not be met together, e.g. no therapist at Serenity speaks Zulu and specialises in anxiety>"
    }},
    "gap_reason": "<same as above>"
    }}"""

   

    return prompt
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
                       SELECT id, first_name, last_name, title, specialisation, approach, language, session_type, age_group, participants, gender, bio, price
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
    


#-------------------------------- CREATE MOCK MATCH TO TEST BEFORE PROMPTING LLM --------------------------------

#MOCK MATCH ENDPOINT :swap mock_result to test different scenarios
@app.route('/api/match/mock', methods=['POST'])
def match_therapist_mock():

    # Swap this object to test different scenarios from serenitybot_test_cases.md
    # Current scenario: Test Case 1 — Individual, exact match
    mock_result = {
    "result": {
        "match": {
            "doctor_id": 9,
            "reasoning": "Dr Tony Livingston specialises in life transitions and grief using positive psychology and narrative therapy. His strengths-focused approach is well matched to your search for renewed purpose after retirement.",
            "confidence": 89
        },
        "no_match": None,
        "gap_reason": None
    }
}

    return jsonify(mock_result), 200



# ROMPT PREVIEW ENDPOINT : returns assembled prompt without calling Gemini
@app.route('/api/match/prompt-preview', methods=['POST'])
def preview_prompt():
    try:
        data = request.get_json()
        patient_profile = data.get('patientProfile')
        doctor_list = data.get('doctorList')

        if not patient_profile or not doctor_list:
            return jsonify({'error': 'Missing patientProfile or doctorList'}), 400

        prompt = build_match_prompt(patient_profile, doctor_list)
        return jsonify({'prompt': prompt}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500







#-------------------------------- CREATE MOCK MATCH TO TEST BEFORE PROMPTING LLM --------------------------------
    
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
            subject=f"[TEST - for {to_email}] Your Serenity Wellness Centre Booking Confirmation",
            recipients=[DEVELOPER_EMAIL]
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
                        <td style="padding: 10px 0;">{data.get('session_type', 'In-person')}</td>
                    </tr>
                </table>

                <div style="background: #f7f4ee; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 0.85rem;">
                    {'<strong>Before your session:</strong><br><br>Our receptionist Cleo will be in contact with you before your appointment with a secure video link and any details you need to join your session. Please ensure you have a stable internet connection and a quiet, private space ready.<br><br>Need to cancel or reschedule your online session? Please give us at least <strong>24 hours notice</strong>.' 
                    if data.get('session_type') == 'Online' else 
                    '<strong>Before your session:</strong><br><br>Please arrive <strong>30 to 45 minutes early</strong> to complete your intake forms and arrange payment and medical aid. Bring your <strong>ID</strong> and <strong>medical aid card</strong> if applicable.<br><br>Our receptionist Cleo will be in contact with you before your appointment to confirm any outstanding details.'}
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
        print(f"Email sent successfully to {to_email} (intercepted to {DEVELOPER_EMAIL})")
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

        # Fetch doctor name for the email
        cursor2 = conn.cursor(dictionary=True)
        cursor2.execute("SELECT first_name, last_name FROM doctors WHERE id = %s", (data['doctor_id'],))
        doctor = cursor2.fetchone()
        cursor2.close()
        conn.close()

        doctor_name = f"Dr {doctor['first_name']} {doctor['last_name']}" if doctor else "your therapist"

        # Send confirmation email
        send_confirmation_email(
            to_email=data['patient_email'],
            data={
                'patient_name': data['patient_name'],
                'doctor_name':  doctor_name,
                'appt_date':    data['appt_date'],
                'appt_time':    data['appt_time'],
                'session_type': data.get('session_type', 'In-person')
            },
            reference=ref
        )

        return jsonify({'success': True, 'reference': ref})

       

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/match', methods=['POST'])
def match_therapist():
    try:
        data = request.get_json()
        patient_profile = data.get('patientProfile')
        doctor_list = data.get('doctorList')

        if not patient_profile or not doctor_list:
            return jsonify({'error': 'Missing patientProfile or doctorList'}), 400

        # Build the prompt
        prompt = build_match_prompt(patient_profile, doctor_list)

        # Call Gemini
        from google import genai
        client = genai.Client(api_key=os.environ.get('GEMINI_API'))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        raw = response.text.strip()

        # Strip markdown fences if Gemini wraps the JSON
        if raw.startswith('```'):
            raw = raw.split('```')[1]
            if raw.startswith('json'):
                raw = raw[4:]
            raw = raw.strip()

        # Parse JSON response
        result = json.loads(raw)
        return jsonify({'result': result, 'prompt_used': prompt}), 200

    except json.JSONDecodeError:
        return jsonify({'error': 'invalid_json', 'message': 'Gemini returned unparseable output'}), 502

    except Exception as e:
        error_str = str(e)
        print(f"GEMINI ERROR DETAIL: {error_str}")   # temporary, remove after diagnosing
        if '429' in error_str or 'quota' in error_str.lower() or 'exhausted' in error_str.lower():
            return jsonify({'error': 'quota_exceeded'}), 429
        if 'timeout' in error_str.lower() or 'connection' in error_str.lower():
            return jsonify({'error': 'network_error'}), 503
        return jsonify({'error': 'server_error', 'message': error_str}), 500
    
if __name__ == '__main__':
    app.run(debug=True)

