# Serenity Wellness Centre with AI-Powered Chatbot

This is a full website for a fictional wellness centre. It is centred on an AI-powered chatbot that matches patients to the best-suited therapist and handles real appointment booking end-to-end. Patients can also browse therapists manually if they prefer.

## Tech stack

**Frontend:** HTML, CSS, JavaScript

**Backend:** Flask, Flask-Mail

**Database:** MySQL

**AI:** Gemini API

## Purpose of this project
This project examines how AI engineering techniques, especially prompt engineering, can enhance business efficiency and customer outcomes using AI chatbots. The focus is on a practical application in the health care sector: a mental wellness chatbot designed to improve client-therapist matching. Clients often book mainly based on availability. This can lead to a mismatch in clinical needs. Addressing this gap boosts client satisfaction, which could ultimately drive revenue growth.


## Approach
Below is a flow diagram used to outline the main flow of the SerenityBot for the website.

```mermaid
flowchart TD
    A[Find match] --> B[User explains reason for therapy]
    B --> C[Input validation]
    C --> D[Ask user who the session is for]
    D --> D1[Just me]
    D --> D2[My partner and I]
    D --> D3[My family]
    D --> D4[A group]
    D1 --> E[Ask user to select age group]
    E --> E1[Child]
    E --> E2[Adult]
    E --> E3[Elder]
    E1 --> F[Ask user to select a language]
    E2 --> F
    E3 --> F
    D2 --> F
    D3 --> F
    D4 --> F
    F --> F1[User selects language]
    F1 --> G[Ask if user prefers a specific therapist]
    G --> G1[Female]
    G --> G2[Male]
    G --> G3[No preference]
    G1 --> H[Ask which session style they need]
    G2 --> H
    G3 --> H
    H --> H1[Online]
    H --> H2[In-person]
    H --> H3[No preference]
    H1 --> I{Seen a therapist before?}
    H2 --> I
    H3 --> I
    I -->|Yes| I1[List what worked before]
    I1 --> J[Build LLM prompt]
    I -->|No| J
    J --> K[Run LLM match]
    K --> L{Match found?}
    L -->|No| M[No match]
    M --> M1[Display second best match]
    M --> M2[Sister centre referral]
    L -->|Yes| N[Display selected doctor match]
    N --> N1[Book session]
    N --> N2[Return to main menu]
```
