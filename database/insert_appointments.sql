CREATE TABLE appointments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id     INT NOT NULL,
    patient_name  VARCHAR(100) NOT NULL,
    patient_dob   VARCHAR(20) NOT NULL,
    patient_phone VARCHAR(30) NOT NULL,
    patient_email VARCHAR(100) NOT NULL,
    emergency_contact VARCHAR(150) NOT NULL,
    prev_therapy  VARCHAR(10) NOT NULL,
    prev_detail   TEXT,
    presenting    TEXT NOT NULL,
    medications   TEXT NOT NULL,
    appt_date     DATE NOT NULL,
    appt_time     VARCHAR(10) NOT NULL,
    reference     VARCHAR(20) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);