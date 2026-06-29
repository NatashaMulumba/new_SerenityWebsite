# Author: Natasha Mulumba
# import library to get API from .env file
from dotenv import load_dotenv
# import libraries for flask and google genai
from flask import Flask, request, jsonify
from flask_cors import CORS 
from google import genai
import os
import mysql.connector

app = Flask(__name__)
CORS(app)

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API'))

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
    
if __name__ == '__main__':
    app.run(debug=True)

