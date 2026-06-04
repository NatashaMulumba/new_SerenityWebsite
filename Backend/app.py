# Author: Natasha Mulumba
# import library to get API from .env file
from dotenv import load_dotenv
# import libraries for flask and google genai
from flask import Flask, request, jsonify
from flask_cors import CORS 
from google import genai
import os

app = Flask(__name__)
CORS(app)

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API'))

# Get prompt text from textfile
with open('prompt.txt','r') as file:
    SYSTEM_PROMPT = file.read()
# Allow genai to use API key from .env file


@app.route('/chat', methods =['POST'])
def chat():
    data = request.get_json() # get the data from the request
    user_message = data['message'] # get the message from the data
    response = client.models.generate_content(model="gemini-3.5-flash", contents=SYSTEM_PROMPT + "\n\nPatient: " + user_message)
    return jsonify({'reply': response.text})

if __name__ == '__main__':
    app.run(debug=True)

