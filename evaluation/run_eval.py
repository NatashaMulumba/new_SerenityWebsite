import json
import mysql.connector
from dotenv import load_dotenv
from google import genai
import os
import re

#--------------Path and file setup----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
Test_case_path = os.path.join(BASE_DIR, "serenitybot_test_cases.json")
 
prompt_files = {
    "zero_shot": os.path.join(BASE_DIR, "v1_zero_shot.txt"),
    "few_shot": os.path.join(BASE_DIR, "v2_few_shot.txt"),
    "chain_of_thought": os.path.join(BASE_DIR, "v3_chain_of_thought.txt"),
}

ENV_PATH = os.path.join(BASE_DIR, "..", "backend", ".env")
LOG_PATH = os.path.join(BASE_DIR, "evaluation_log.json")
#--------------Path and file setup----------------



# loads test case and return list of dictionaries, each dictionary contains a test case
def load_test_cases():
    with open(Test_case_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["test_cases"]

# load prompt cases based on version name, return the prompt cases as a string
def load_prompt_cases(version):
    filename = prompt_files[version]  # Change this to the desired prompt type
    with open(filename, "r", encoding="utf-8") as f:
        return f.read()
    
# fetch doctor profile from the database and return a list of dictionaries, each dictionary contains a doctor profile   
def fetch_doctor_profile():

    load_dotenv(ENV_PATH)

    conn = mysql.connector.connect(
        host=os.environ["DB_HOST"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
    )
    cursor = conn.cursor(dictionary=True)
 
    query = """
        SELECT
            d.ID, d.first_name, d.last_name, d.gender, d.title, d.bio, d.price,
            d.offers_online, d.offers_in_person,
            d.sees_child_teen, d.sees_adult, d.sees_elder,
            d.sees_individuals, d.sees_couples, d.sees_family, d.sees_group,
            GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS specialisations,
            GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS approaches,
            GROUP_CONCAT(DISTINCT l.name ORDER BY l.name SEPARATOR ', ') AS languages
        FROM doctors d
        LEFT JOIN doctor_specialisations ds ON ds.doctor_id = d.ID
        LEFT JOIN specialisations s ON s.specialisation_id = ds.specialisation_id
        LEFT JOIN doctor_approaches da ON da.doctor_id = d.ID
        LEFT JOIN approaches a ON a.approach_id = da.approach_id
        LEFT JOIN doctor_languages dl ON dl.doctor_id = d.ID
        LEFT JOIN languages l ON l.language_id = dl.language_id
        GROUP BY d.ID
        ORDER BY d.ID;
    """
    cursor.execute(query)
    doctors = cursor.fetchall()
 
    cursor.close()
    conn.close()
 
    return doctors


# create the therapist block for each doctor profile, return a string containing all the therapist blocks
def format_therapist_block(doctors):
    blocks = []
    for d in doctors:
        session_type = []
        if d["offers_online"]:
            session_type.append("Online")
        if d["offers_in_person"]:
            session_type.append("In-person")
 
        age_group = []
        if d["sees_child_teen"]:
            age_group.append("Child/Teen")
        if d["sees_adult"]:
            age_group.append("Adult")
        if d["sees_elder"]:
            age_group.append("Elder")
 
        participants = []
        if d["sees_individuals"]:
            participants.append("Individuals")
        if d["sees_couples"]:
            participants.append("Couples")
        if d["sees_family"]:
            participants.append("Family")
        if d["sees_group"]:
            participants.append("Group")
 
        block = (
            f"ID: {d['ID']}\n"
            f"Name: Dr. {d['first_name']} {d['last_name']}\n"
            f"Title: {d['title']}\n"
            f"Gender: {d['gender']}\n"
            f"Specialisation: {d['specialisations']}\n"
            f"Approach: {d['approaches']}\n"
            f"Language: {d['languages']}\n"
            f"Session Type: {', '.join(session_type)}\n"
            f"Age Group: {', '.join(age_group)}\n"
            f"Participants: {', '.join(participants)}\n"
            f"Bio: {d['bio']}\n"
            f"Price: R{d['price']}"
        )
        blocks.append(block)
 
    return "\n\n".join(blocks)

#reformat the patient profile in a format the prompt can use
def format_patient_profile(case):
        intake = case["input"]
        return {
            "presenting_issue": intake["presenting_issue"],
            "session_for": intake["session_for"],
            "age_group": intake["age_group"],
            "language": intake["language"],
            "session_type": intake["session_type"],
            "gender_preference": intake["gender_preference"],
            "prior_therapy": intake["prior_therapy"],
            "prior_therapy_detail": intake["prior_therapy_detail"] or "N/A",
        }
 
#Build out the prompt with patient profile and call the LLM to get the response
def send_prompt(prompt, patient_profile, therapist_block):
    load_dotenv(ENV_PATH)
 
    full_prompt = prompt.format(therapist_block=therapist_block, **patient_profile)
 
    client = genai.Client(api_key=os.environ["GEMINI_API"])
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=full_prompt,
    )
    return response.text

# Parse LLM response and grade outcome
def grade_LLM_response(response, test_case, doctor):
    # clean text 
    cleaned = response.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    #parse text
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {...}
    
    #Link doctor ID to doctor name 
    id_to_name = {d["ID"]: f"{d['first_name']} {d['last_name']}" for d in doctors}
    acceptable = test_case["acceptable_answer_set"] #get acceptable answer from Ground truth
    #Grade the response
    if parsed.get("match_found"):
        therapist_id = parsed.get("therapist_id")
        recommended_name = id_to_name.get(therapist_id)
        correct = recommended_name in acceptable
    else:
        recommended_name = None
        correct = len(acceptable) == 0

    return {
        "parsed": parsed,
        "parse_error": None,
        "correct": correct,
        "recommended_name": recommended_name,
    }


#Check to see if the LLM response is valid and does not violate any guardrails
def run_guardrail_checks(parsed, doctors):
    fired = []
 
    if parsed is None:
        fired.append("unparseable_response")
        return fired
 
    valid_ids = {d["ID"] for d in doctors}
    
    
    if parsed.get("match_found"):
        # check against hallucinated therapist ID if match found
        therapist_id = parsed.get("therapist_id")
        if therapist_id not in valid_ids:
            fired.append("hallucinated_therapist_id")

        # check against confidence level below floor if match found
        confidence = parsed.get("confidence")
        if confidence is None or confidence < 60:
            fired.append("confidence_below_floor")

        # check if reasoning is empty if match found
        reasoning = parsed.get("reasoning", "")
        if not reasoning or not reasoning.strip():
            fired.append("empty_reasoning")
 
    else:
        # check against hallucinated alternative ID if no match found
        alt_id = parsed.get("alternative_therapist_id")
        if alt_id not in valid_ids:
            fired.append("hallucinated_alternative_id")
 
        # check if gap reason is empty if no match found
        gap_reason = parsed.get("gap_reason", "")
        if not gap_reason or not gap_reason.strip():
            fired.append("empty_gap_reason")
 
    return fired

#load exisiting results to prevent re-running the same test case and technique combination
def load_existing_results():
    if not os.path.exists(LOG_PATH):
        return []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)
    
#save results 
def save_result(result):
    existing = load_existing_results()
    existing.append(result)
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

# run a single test case end to end and return results
def run_single_case(test_case,technique,prompt,doctors,therapist_block):
    patient_profile = format_patient_profile(test_case)
    raw_response = send_prompt(prompt, patient_profile, therapist_block)
    graded = grade_LLM_response(raw_response, test_case, doctors)
    guardrails_fired = run_guardrail_checks(graded["parsed"], doctors)
 
    return {
        "case_id": test_case["case_id"],
        "category": test_case["category"],
        "difficulty": test_case["difficulty"],
        "technique": technique,
        "raw_response": raw_response,
        "parsed": graded["parsed"],
        "parse_error": graded["parse_error"],
        "correct": graded["correct"],
        "recommended_name": graded["recommended_name"],
        "guardrails_fired": guardrails_fired,
    }

# Evaluate all test cases for a given technique and log results to a file
def run_full_eval():
    cases = load_test_cases()
    doctors = fetch_doctor_profile()
    therapist_block = format_therapist_block(doctors)
 
    prompts = {
        t: load_prompt_cases(t)
        for t in ("zero_shot", "few_shot", "chain_of_thought")
    }
 
    existing = load_existing_results()
    already_done = {(r["case_id"], r["technique"]) for r in existing}
 
    for case in cases:
        for technique, prompt in prompts.items():
            key = (case["case_id"], technique)
            if key in already_done:
                print(f"Skipping {case['case_id']} / {technique}, already logged")
                continue
 
            print(f"Running {case['case_id']} / {technique}...")
            result = run_single_case(case, technique, prompt, doctors, therapist_block)
            save_result(result)
            print(f"  -> correct={result['correct']}, guardrails_fired={result['guardrails_fired']}")
 


if __name__ == "__main__":
    # doctors = fetch_doctor_profile()
    # print(len(doctors), "doctors loaded")
    # print(doctors[0])

    # TESTING GEMINI-3.1-FLASH-LITE
    cases = load_test_cases()
    tc006 = [c for c in cases if c['case_id'] == 'TC006'][0]

    doctors = fetch_doctor_profile()
    therapist_block = format_therapist_block(doctors)

    for technique in ['zero_shot', 'few_shot', 'chain_of_thought']:
        prompt = load_prompt_cases(technique)
        result = run_single_case(tc006, technique, prompt, doctors, therapist_block)
        print(f"--- {technique} ---")
        print("Correct:", result['correct'])
        print("Recommended:", result['recommended_name'])
        print("Guardrails fired:", result['guardrails_fired'])
        reasoning = result['parsed'].get('reasoning') if result['parsed'] else result['parse_error']
        print("Reasoning/error:", reasoning)
        print()







    # cases = load_test_cases()
    # tc001 = [c for c in cases if c['case_id'] == 'TC001'][0]

    # prompt = load_prompt_cases('zero_shot')
    # patient_profile = format_patient_profile(tc001)
    # print("Patient Profile:", patient_profile  )
    # doctors = fetch_doctor_profile()
    # therapist_block = format_therapist_block(doctors)

    # response = send_prompt(prompt, patient_profile, therapist_block)
    # print(response)
 


