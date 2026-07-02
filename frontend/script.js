// CHATBOT Functionality //

// chatbot memory container
const chatState = {
  phase: 'idle',
  patientProfile: {
    presentingIssue: null,
    sessionFor: null,
    ageGroup: null,
    language: null,
    sessionType: null,
    therapistPrefs: { gender: null, background: null },
    availability: [],
    priorTherapy: null,
    priorType: null,
    priorWorked: null,
  },
  selectedDoctor: null,
  bookingData: {},
  bookingStep: 0,
  messages: [],
  crisisDetected: false,
  faqContext: {
    therapyGroup: null,   // stores the group name while user browses styles
    seenStyles: [], 
  }
};



// this function checks four 4 checks: crisis words, prompt injection, PII strip, gibberish detection
function sanitiseInput(text) {
  const t = text.trim();

  // CHECK 1: Crisis keywords
  const crisisKeywords = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'end it all',
    'self-harm', 'self harm', 'hurt myself', 'cut myself',
    'don\'t want to be here', 'dont want to be here',
    'no reason to live', 'want to die', 'better off dead'
  ];
  const lowerT = t.toLowerCase();
  const hasCrisis = crisisKeywords.some(k => lowerT.includes(k));
  if (hasCrisis) {
    return { passed: false, reason: 'crisis' };
  }

  // CHECK 2: Prompt injection detection
  const injectionPhrases = [
    'ignore previous instructions', 'ignore all previous',
    'you are now', 'forget everything', 'forget all previous',
    'act as', 'act like', 'system prompt', 'disregard',
    'new instructions', 'override', 'jailbreak',
    'pretend you are', 'pretend to be', 'your new role'
  ];
  const hasInjection = injectionPhrases.some(p => lowerT.includes(p));
  if (hasInjection) {
    return { passed: false, reason: 'injection' };
  }

  // CHECK 3: PII strip (silent, never blocks)
  let cleaned = t;

  // SA phone numbers: 0XXXXXXXXX or +27XXXXXXXXX
  cleaned = cleaned.replace(/(\+27|0)[6-8][0-9]{8}/g, '[removed]');

  // Email addresses
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[removed]');

  // SA ID numbers: 13 consecutive digits
  cleaned = cleaned.replace(/\b\d{13}\b/g, '[removed]');

  // Credit card patterns: 16 digits, optionally spaced or dashed
  cleaned = cleaned.replace(/\b(\d{4}[\s-]?){3}\d{4}\b/g, '[removed]');

  // CHECK 4: Gibberish detection
  const emojiOnly = /^[\p{Emoji}\s]+$/u.test(cleaned);
  const numbersOnly = /^\d+$/.test(cleaned);
  const noVowels = !/[aeiouAEIOU]/.test(cleaned) && cleaned.length > 4;
  const repeating = /(.)\1{4,}/.test(cleaned);

  if (emojiOnly || numbersOnly || noVowels || repeating) {
    return { passed: false, reason: 'gibberish' };
  }

  // All checks passed
  return { passed: true, text: cleaned };
}

// function that appends the bot message to the chat window if sanitisation fails
function showSanitiseBlockMessage() {
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "That does not look like a valid response. Please try again in your own words."
    );
  }, 600);
}




const toggleBtn = document.querySelector("#chat-toggle-btn")
const chatWindow= document.querySelector("#chat-window")
const closeBtn = document.querySelector("#close-button")
const hamburger = document.querySelector(".hamburger")
const navMenu = document.querySelector(".navbar-menu")
const pills = document.querySelectorAll(".pill");
const cards = document.querySelectorAll(".therapist-card"); // Select all pills and all therapist cards
const testimonialCards = document.querySelectorAll(".testimonial-card");
const dots = document.querySelectorAll(".dot");
const chatInput = document.querySelector("#chat-input");
const sendBtn = document.querySelector("#chat-send-btn");
const chatMessages = document.querySelector("#chat-messages");
let currentIndex = 0;




//Open Menu when clicked//
hamburger.addEventListener("click",function(){
    navMenu.classList.toggle("menu-open");

    const isOpen = navMenu.classList.contains("menu-open");
    hamburger.setAttribute("aria-expanded",isOpen);
});

// find the navigation links and listen for when a link is clicked 
navMenu.querySelectorAll("a").forEach(function(link){
    link.addEventListener("click",function() {
        navMenu.classList.remove("menu-open");
        hamburger.setAttribute("aria-expanded", false);
    });
});

// Show and Hide therapist card based on pill filter info
pills.forEach(function(pill) {
    pill.addEventListener("click", function() {

        //move the "active" highlight to the clicked pill
        pills.forEach(function(p) { p.classList.remove("active"); });
        pill.classList.add("active");

        // read what this pill is filtering for
        const filter = pill.getAttribute("data-filter");

        // loop through every card and decide show or hide
        cards.forEach(function(card) {
            const categories = card.getAttribute("data-categories");

            if (filter === "all" || categories.includes(filter)) {
                card.style.display = "";     // restores to CSS default setting to show card
            } else {
                card.style.display = "none"; // else hide the card
            }
        });
    });
});



// Create an auto advance testimonal carousel
// Extracted into a named function so both the timer AND the click can call it
function goToSlide(index) {
    testimonialCards.forEach(function(card) { card.classList.remove("active"); });
    dots.forEach(function(d) { d.classList.remove("active"); });
    testimonialCards[index].classList.add("active");
    dots[index].classList.add("active");
    currentIndex = index; // keep currentIndex in sync
}

// Auto-advance every 3 seconds
setInterval(function() {
    goToSlide((currentIndex + 1) % testimonialCards.length);
}, 3000);

// --------------    FUNCTIONS----------------------------------------
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.classList.add('chat-message', 'bot-message', 'typing-indicator');
  indicator.id = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  document.querySelector('#chat-messages').appendChild(indicator);
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function scrollToBottom() {
  const messages = document.querySelector('#chat-messages');
  messages.scrollTop = messages.scrollHeight;
}

// function that converts text to lower case and check if word is present in KEYWORD list
function detectCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw)); // return true if keyword found or false if not present
}

// Send function takes user message as input
function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;                  // ignore empty sends

  chatInput.value = '';                  // clear the input field

  appendUserMessage(trimmed);            // show what the user typed

  chatState.messages.push({ role: 'user', content: trimmed });  // log to history

  if (detectCrisis(trimmed)) {          // pre-LLM keyword scan, every message
    chatState.crisisDetected = true;
    chatState.phase = 'crisis';
  }

  handlePhase(trimmed);                 // route based on current phase
}

// Append user message into a right-aligned bubble
function appendUserMessage(text) {
  const div = document.createElement('div');
  div.classList.add('chat-message', 'user-message');
  div.textContent = text;
  chatMessages.appendChild(div);
  scrollToBottom();
}
// Append bot message into a right-aligned bubble
function appendBotMessage(text) {
  const div = document.createElement('div');
  div.classList.add('chat-message', 'bot-message');
  div.innerHTML = text;           // innerHTML so we can use <br> and links later
  chatMessages.appendChild(div);
  scrollToBottom();
}

//function to redisplay menu options
function showMenuOptions() {
  appendBotMessage(
    "Hi! I'm SerenityBot, the Serenity assistant. How can I help you today?<br><br>" +
    "<button class='menu-option' onclick='sendMessage(\"🔍 Find my match\")'>🔍 Find my match</button>" +
    "<button class='menu-option' onclick='sendMessage(\"👤 Browse the team\")'>👤 Browse the team</button>" +
    "<button class='menu-option' onclick='sendMessage(\"📋 FAQ\")'>📋 FAQ</button>" +
    "<button class='menu-option' onclick='sendMessage(\"🆘 Crisis support\")'>🆘 Crisis support</button>"
  );
}

//function that resets chat to welcome screen
function resetToWelcome() {
  // Reset chatState back to defaults
  chatState.phase = 'menu';
  chatState.crisisDetected = false;
  chatState.selectedDoctor = null;
  chatState.messages = [];
  chatState.patientProfile = {
    presentingIssue: null,
    sessionFor: null,
    ageGroup: null,
    language: null,
    sessionType: null,
    therapistPrefs: { gender: null, background: null },
    availability: [],
    priorTherapy: null,
    priorType: null,
    priorWorked: null,
  };

  // Clear the chat window entirely
  chatMessages.innerHTML = '';

  // Re-render the welcome screen
  showMenuOptions();
}

// Fetch therapists from Flask and render the two-column list
function handleBrowseTeam() {
  showTypingIndicator();

  fetch('http://127.0.0.1:5000/api/therapists')
    .then(response => response.json())
    .then(therapists => {
      hideTypingIndicator();

      chatState.browseList = therapists;

      const buttons = therapists.map(t =>
        `<button class="therapist-option" onclick="showTherapistCard(${t.id})">
          <span class="t-name">Dr ${t.first_name} ${t.last_name}</span>
          <span class="t-spec">${t.title}</span>
        </button>`
      ).join('');

      appendBotMessage(
        `Here's our team — tap anyone to see their full profile:<br><br>` +
        `<div class="therapist-grid">${buttons}</div>`
      );

      chatState.phase = 'browsing';
    })
    .catch(() => {
      hideTypingIndicator();
      appendBotMessage("I couldn't load the team right now. Please try again in a moment.");
    });
}


// Handles text input while the therapist list is visible
function handleBrowsingInput(text) {
  const lower = text.toLowerCase();
  if (lower.includes('main menu')) {
    resetToWelcome();
  } else {
    appendBotMessage("Tap a therapist above to see their profile, or go back to the main menu.");
  }
}

// Handles button clicks from inside the therapist card
function handleBrowsingCardInput(text) {
  const lower = text.toLowerCase();

  if (lower.startsWith('book:')) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      startBooking();
    }, 800);

  } else if (lower.includes('back to team')) {
    handleBrowseTeam();

  } else if (lower.includes('main menu')) {
    resetToWelcome();
  }
}

// ----------- BOOKING FLOW -----------------


// create a new patient profile and start the intake process
function startIntake() {
  chatState.phase = 'intake_q1';

  chatState.patientProfile = {
    presentingIssue: null,
    sessionFor: null,
    ageGroup: null,
    language: null,
    sessionType: null,
    therapistPrefs: { gender: null, background: null },
    availability: [],
    priorTherapy: null,
    priorType: null,
    priorWorked: null,
  };

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Let's find the right therapist for you. I'll ask a few short questions and " +
      "it takes about a minute.<br><br>" +
      "First, in your own words, what's bringing you to therapy? " +
      "This helps us find someone with the right experience for you."
    );

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message bot-message';
    wrapper.style.padding = '0';
    wrapper.style.background = 'none';
    wrapper.id = 'intake-q1-widget';
    wrapper.innerHTML = `
      <div class="presenting-widget">
        <textarea
          id="intake-presenting-input"
          class="presenting-textarea"
          maxlength="300"
          placeholder="e.g. I've been feeling anxious at work and struggling to sleep..."
          oninput="intakePresentingCount(this)"
        ></textarea>
        <div class="presenting-footer">
          <span class="presenting-counter" id="intake-presenting-counter">300 characters remaining</span>
          <button class="presenting-submit" onclick="intakePresentingSubmit()">Continue →</button>
        </div>
      </div>
    `;
    document.querySelector('#chat-messages').appendChild(wrapper);
    scrollToBottom();
    setTimeout(() => document.getElementById('intake-presenting-input')?.focus(), 100);
  }, 800);
}

function intakePresentingCount(textarea) {
  const remaining = 300 - textarea.value.length;
  const counter = document.getElementById('intake-presenting-counter');
  if (counter) {
    counter.textContent = `${remaining} character${remaining === 1 ? '' : 's'} remaining`;
    counter.style.color = remaining < 50 ? '#c0392b' : '';
  }
}


//update intakePresentingSubmit function to validate input length and add sanitisation check
function intakePresentingSubmit() {
  const input = document.getElementById('intake-presenting-input');
  if (!input) return;
  const value = input.value.trim();

  if (value.length < 10) {
    input.style.borderColor = '#c0392b';
    const counter = document.getElementById('intake-presenting-counter');
    if (counter) counter.textContent = 'Please share a little more. Even a sentence helps us find the right match.';
    return;
  }

  const result = sanitiseInput(value);

  if (!result.passed) {
    if (result.reason === 'crisis') {
      handlePhase('crisis');
    } else {
      input.style.borderColor = '#c0392b';
      showSanitiseBlockMessage();
    }
    return;
  }

  chatState.patientProfile.presentingIssue = result.text;
  appendUserMessage(result.text.length > 60 ? result.text.substring(0, 60) + '...' : result.text);
  askIntakeQ2();
}







// Get the second intake question: Who is this session for? (individual, couple, family, group)
function askIntakeQ2() {
  chatState.phase = 'intake_q2';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Who is this session for?<br><br>" +
      "<button class='menu-option' onclick='selectIntakeQ2(\"Individual\")'>🙋 Just me</button>" +
      "<button class='menu-option' onclick='selectIntakeQ2(\"Couples\")'>👫 My partner and I</button>" +
      "<button class='menu-option' onclick='selectIntakeQ2(\"Family\")'>👨‍👩‍👧 My family</button>" +
      "<button class='menu-option' onclick='selectIntakeQ2(\"Group\")'>👥 A group</button>"
    );
  }, 800);
}

function selectIntakeQ2(answer) {
  chatState.patientProfile.sessionFor = answer;
  appendUserMessage(answer);
  if (answer === 'Individuals') {
    askIntakeQ3();
  } else {
    chatState.patientProfile.ageGroup = null;
    askIntakeQ4();
  }
}

// Get the third intake question: What age group best describes you? (only for individuals)
function askIntakeQ3() {
  chatState.phase = 'intake_q3';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "What age group best describes you?<br><br>" +
      "<button class='menu-option' onclick='selectIntakeQ3(\"Child/Teen\")'>🧒 Child or Teen (under 18)</button>" +
      "<button class='menu-option' onclick='selectIntakeQ3(\"Adult\")'>🧑 Adult (18 to 64)</button>" +
      "<button class='menu-option' onclick='selectIntakeQ3(\"Elder\")'>🧓 Elder (65+)</button>"
    );
  }, 800);
}

function selectIntakeQ3(answer) {
  chatState.patientProfile.ageGroup = answer;
  appendUserMessage(answer);
  askIntakeQ4();
}

// function to get the fourth intake question: What language do you prefer for your session?
function askIntakeQ4() {
  chatState.phase = 'intake_q4';

  const languages = [
    'Afrikaans', 'English', 'French', 'Mandarin', 'Northern Sotho',
    'Ndebele', 'Portuguese', 'Sesotho', 'Spanish', 'Swahili',
    'Swati', 'Tamil', 'Tsonga', 'Tswana', 'Vietnamese',
    'Xhosa', 'Zulu'
  ];

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage("What language would you prefer your sessions to be in?");

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message bot-message';
    wrapper.style.padding = '0';
    wrapper.style.background = 'none';
    wrapper.innerHTML = `
      <div class="intake-dropdown-widget">
        <select id="intake-language-select" class="intake-dropdown">
          <option value="" disabled selected>Select a language...</option>
          ${languages.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <button class="presenting-submit" onclick="handleIntakeQ4()">Continue →</button>
      </div>
    `;
    document.querySelector('#chat-messages').appendChild(wrapper);
    scrollToBottom();
  }, 800);
}

function handleIntakeQ4() {
  const select = document.getElementById('intake-language-select');
  const value = select ? select.value : '';

  if (!value) {
    select.style.borderColor = '#c0392b';
    return;
  }

  chatState.patientProfile.language = value;
  appendUserMessage(value);
  askIntakeQ5();
}

// function to get the fifth intake question: Would you prefer your sessions online or in-person?
function askIntakeQ5() {
  chatState.phase = 'intake_q5';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Would you prefer your sessions online or in-person?<br><br>" +
      "<button class='menu-option' onclick='selectIntakeQ5(\"Online\")'>💻 Online</button>" +
      "<button class='menu-option' onclick='selectIntakeQ5(\"In-person\")'>🏢 In-person</button>" +
      "<button class='menu-option' onclick='selectIntakeQ5(\"No preference\")'>🤷 No preference</button>"
    );
  }, 800);
}

function selectIntakeQ5(answer) {
  chatState.patientProfile.sessionType = answer;
  appendUserMessage(answer);
  askIntakeQ6();
}

//function to get the sixth intake question: Do you have any preferences for your therapist's
function askIntakeQ6() {
  chatState.phase = 'intake_q6';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Do you have a preference for your therapist's gender?<br><br>" +
      "<button class='menu-option' onclick='selectIntakeQ6(\"Female\")'>👩 Female</button>" +
      "<button class='menu-option' onclick='selectIntakeQ6(\"Male\")'>👨 Male</button>" +
      "<button class='menu-option' onclick='selectIntakeQ6(\"No preference\")'>🤷 No preference</button>"
    );
  }, 800);
}

function selectIntakeQ6(answer) {
  chatState.patientProfile.therapistPrefs.gender = answer === 'No preference' ? null : answer;
  appendUserMessage(answer);
  askIntakeQ7();
}


//function to get the seventh intake question: Have you seen a therapist before?
function askIntakeQ7() {
  chatState.phase = 'intake_q7';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Have you seen a therapist before?<br><br>" +
      "<button class='menu-option' onclick='selectIntakeQ7(\"Yes\")'>Yes</button>" +
      "<button class='menu-option' onclick='selectIntakeQ7(\"No\")'>No</button>"
    );
  }, 800);
}

function selectIntakeQ7(answer) {
  chatState.patientProfile.priorTherapy = answer;
  appendUserMessage(answer);

  if (answer === 'Yes') {
    askIntakeQ7b();
  } else {
    chatState.patientProfile.priorWorked = null;
    runGeminiMatch();
  }
}

function askIntakeQ7b() {
  chatState.phase = 'intake_q7b';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "What worked for you, or what didn't? This helps us find an approach that fits.<br><br>" +
      "<span style='opacity:0.6;font-size:0.85rem;'>Keep it brief, a sentence or two is fine.</span>"
    );
  }, 800);
}

function handleIntakeQ7b(text) {
  const value = text.trim();

  if (value.length < 5) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("Please share just a little more so we can find the best approach for you.");
    }, 500);
    return;
  }

  chatState.patientProfile.priorWorked = value;
  appendUserMessage(value.length > 60 ? value.substring(0, 60) + '...' : value);
  runGeminiMatch();
}









// ----------- BOOKING FLOW -----------------



























// Validates a single booking field — returns an error string or null if valid
function validateBookingInput(step, value) {
  const v = value.trim();

  if (step === 0) {
    // Full name — at least two words, letters and spaces only
    if (!/^[a-zA-Z\s'-]{2,}$/.test(v) || v.split(' ').filter(w => w).length < 2)
      return "Please enter your full name (first and last name).";
  }

  if (step === 1) {
    // Date of birth — accepts DD/MM/YYYY or DD-MM-YYYY
    const parts = v.split(/[\/\-]/);
    if (parts.length !== 3) return "Please use the format DD/MM/YYYY — for example 15/03/1990.";
    const day = parseInt(parts[0]), month = parseInt(parts[1]), year = parseInt(parts[2]);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month - 1)
      return "That doesn't look like a valid date. Please use DD/MM/YYYY.";
    const age = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    if (age < 5 || age > 120)
      return "Please check your date of birth — the age doesn't seem right.";
  }

  if (step === 2) {
    // SA phone number — 10 digits starting with 0, or +27 followed by 9 digits
    const digits = v.replace(/[\s\-]/g, '');
    if (!/^(0\d{9}|\+27\d{9})$/.test(digits))
      return "Please enter a valid South African number — e.g. 0821234567 or +27821234567.";
  }

  if (step === 3) {
    // Email — standard format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return "That doesn't look like a valid email address. Please try again.";
  }

  if (step === 4) {
    // Emergency contact name — at least two words
    if (v.split(' ').filter(w => w).length < 2)
      return "Please enter their full name (first and last name).";
  }

  if (step === 5) {
    // Emergency relationship — non-empty
    if (v.length < 2)
      return "Please tell us their relationship to you — for example: mother, friend, partner.";
  }

  if (step === 6) {
    // Emergency contact number — SA phone
    const digits = v.replace(/[\s\-]/g, '');
    if (!/^(0\d{9}|\+27\d{9})$/.test(digits))
      return "Please enter a valid South African number — e.g. 0821234567 or +27821234567.";
  }

  if (step === 9) {
    // Presenting concern — at least 10 characters
    if (v.length < 10)
      return "Please share a little more — this helps your therapist prepare for your session.";
  }

  if (step === 10) {
    // Medications — non-empty
    if (v.length < 2)
      return "Please enter your current medications, or say 'none' if you're not taking any.";
  }

  return null; // valid
}

// Initialises the booking flow for the selected doctor
function startBooking() {
  chatState.bookingData = {};
  chatState.bookingStep = 0;
  const name = `Dr ${chatState.selectedDoctor.first_name} ${chatState.selectedDoctor.last_name}`;
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      `Great — let's get your appointment with <strong>${name}</strong> booked. ` +
      `I just need a few details. This takes about 2 minutes.`
    );
    setTimeout(() => askBookingQuestion(), 800);
  }, 800);
}

// Asks the correct question based on the current bookingStep
function askBookingQuestion() {
  const b    = chatState.bookingData;
  const step = chatState.bookingStep;
  const isEditing = Object.keys(b).length > 0;

  function hint(val) {
    return isEditing && val
      ? ` <span style="opacity:0.6;font-size:0.8rem;">(currently: ${val} — type to change or say <em>next</em>)</span>`
      : '';
  }

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    chatState.phase = 'booking_intake';

    if (step === 0) {
      appendBotMessage(`What's your full name?${hint(b.patient_name)}`);

    } else if (step === 1) {
      appendBotMessage(`What's your date of birth? Use DD/MM/YYYY — for example 15/03/1990.${hint(b.patient_dob)}`);

    } else if (step === 2) {
      appendBotMessage(`What's your phone number?${hint(b.patient_phone)}`);

    } else if (step === 3) {
      appendBotMessage(`And your email address?${hint(b.patient_email)}`);

    } else if (step === 4) {
      appendBotMessage(`Who should we contact in an emergency? What's their full name?${hint(b.emergency_name)}`);

    } else if (step === 5) {
      appendBotMessage(`What's their relationship to you? For example: mother, friend, partner.${hint(b.emergency_relationship)}`);

    } else if (step === 6) {
      appendBotMessage(`And their phone number?${hint(b.emergency_number)}`);

    } else if (step === 7) {
      chatState.phase = 'booking_prev_therapy';
      const yesClass = b.prev_therapy === 'Yes' ? ' seen' : '';
      const noClass  = b.prev_therapy === 'No'  ? ' seen' : '';
      appendBotMessage(
        `Have you seen a therapist before?<br><br>` +
        `<button class="menu-option${yesClass}" onclick="sendMessage('prev: Yes')">Yes</button>` +
        `<button class="menu-option${noClass}"  onclick="sendMessage('prev: No')">No</button>`
      );

    } else if (step === 8) {
      chatState.phase = 'booking_intake';
      appendBotMessage(`Briefly — what worked, or what didn't?${hint(b.prev_detail)}`);

    } else if (step === 9) {
      chatState.phase = 'booking_presenting';
      const doctor = `Dr ${chatState.selectedDoctor.first_name} ${chatState.selectedDoctor.last_name}`;
      appendBotMessage(`What brings you to therapy? This goes directly to ${doctor}.${hint(b.presenting)}`);
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message bot-message';
      wrapper.style.padding = '0';
      wrapper.style.background = 'none';
      wrapper.innerHTML = `
        <div class="presenting-widget">
          <textarea
            id="presenting-input"
            class="presenting-textarea"
            maxlength="500"
            placeholder="Share what's brought you here — in your own words..."
            oninput="presentingCount(this)"
          ></textarea>
          <div class="presenting-footer">
            <span class="presenting-counter" id="presenting-counter">500 characters remaining</span>
            <button class="presenting-submit" onclick="presentingSubmit()">Continue →</button>
          </div>
        </div>
      `;
      document.querySelector('#chat-messages').appendChild(wrapper);
      scrollToBottom();
      setTimeout(() => document.getElementById('presenting-input')?.focus(), 100);

    } else if (step === 10) {
      appendBotMessage(`Are you currently taking any medications? If not, just say none.${hint(b.medications)}`);

    } else if (step === 11) {
      showCalendarPicker();
    }

  }, 700);
}

// Processes each intake answer, validates, and advances to the next step
function handleBookingInput(text) {
  const trimmed = text.trim();
  const lower   = trimmed.toLowerCase();
  const step    = chatState.bookingStep;
  const b       = chatState.bookingData;
  const isNext  = lower === 'next';

  // Yes / No buttons for previous therapy
  if (lower.startsWith('prev:')) {
    const answer = trimmed.replace('prev:', '').trim();
    b.prev_therapy = answer;
    chatState.bookingStep++;
    if (answer === 'No') {
      b.prev_detail = null;
      chatState.bookingStep++; // skip B5b
    }
    askBookingQuestion();
    return;
  }

  // If editing and user says next, keep the existing value — skip validation
  if (isNext && b[fieldKeyForStep(step)]) {
    chatState.bookingStep++;
    askBookingQuestion();
    return;
  }

  // Validate before storing
  const error = validateBookingInput(step, trimmed);
  if (error) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage(` ${error}`);
    }, 500);
    return; // stay on same step
  }

  // Store the validated answer
  if (step === 0)  b.patient_name          = trimmed;
  if (step === 1)  b.patient_dob           = trimmed;
  if (step === 2)  b.patient_phone         = trimmed;
  if (step === 3)  b.patient_email         = trimmed;
  if (step === 4)  b.emergency_name        = trimmed;
  if (step === 5)  b.emergency_relationship = trimmed;
  if (step === 6)  b.emergency_number      = trimmed;
  if (step === 8)  b.prev_detail           = trimmed;
  if (step === 9)  b.presenting            = trimmed;
  if (step === 10) b.medications           = trimmed;

  chatState.bookingStep++;
  askBookingQuestion();
}

// Maps a step number to its bookingData key — used for edit/next detection
function fieldKeyForStep(step) {
  const map = {
    0:  'patient_name',
    1:  'patient_dob',
    2:  'patient_phone',
    3:  'patient_email',
    4:  'emergency_name',
    5:  'emergency_relationship',
    6:  'emergency_number',
    8:  'prev_detail',
    9:  'presenting',
    10: 'medications'
  };
  return map[step] || null;
}


// Handles confirm / edit / cancelfrom the booking summary/ update: give warning before canceling.
function handleBookingSummaryInput(text) {
  const lower = text.toLowerCase();

  if (lower.includes('confirm booking')) {
    writeBooking();
  } else if (lower.includes('edit booking')) {
    chatState.bookingStep = 0;
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("No problem — let's go through your details. Say <em>next</em> to keep any answer as is.");
      setTimeout(() => askBookingQuestion(), 600);
    }, 700);
  } else if (lower.includes('cancel booking')) {
    chatState.phase = 'booking_cancel_confirm';
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage(
        "Are you sure you want to cancel? Your details will be lost.<br><br>" +
        "<button class='menu-option' onclick='sendMessage(\"cancel yes\")'>Yes, cancel my booking</button>" +
        "<button class='menu-option' onclick='sendMessage(\"cancel no\")'>No, go back to summary</button>"
      );
    }, 600);
  }
}

// Handles the cancel confirmation step
function handleCancelConfirm(text) {
  const lower = text.toLowerCase();

  if (lower.includes('cancel yes')) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("Your booking has been cancelled. We hope to see you again soon.");
      setTimeout(() => resetToWelcome(), 2500);
    }, 600);
  } else if (lower.includes('cancel no')) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("Good — let's pick up where you left off.");
      setTimeout(() => showBookingSummary(), 600);
    }, 600);
  }
}


// --------------------CALENDER WIDGET FUNCTIONS ----------------------------------------------
// Fetches availability and renders the calendar widget
function showCalendarPicker() {
  const doctorId = chatState.selectedDoctor.id;
  chatState.phase = 'booking_calendar';

  showTypingIndicator();
  fetch(`http://127.0.0.1:5000/api/availability?doctor_id=${doctorId}`)
    .then(res => res.json())
    .then(data => {
      hideTypingIndicator();
      chatState.calAvailability = data; // { working_days: [], booked_slots: [] }
      chatState.calSelectedDate =  chatState.bookingData.appt_date || null; // store the Date incase user wants to edit
      chatState.calSelectedTime = chatState.bookingData.appt_time || null; // store the time incase user wants to edit

      appendBotMessage("Almost there — pick a date and time for your session:");
      const widget = buildCalendarWidget();
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message bot-message';
      wrapper.style.padding = '0';
      wrapper.style.background = 'none';
      wrapper.appendChild(widget);
      document.querySelector('#chat-messages').appendChild(wrapper);
      scrollToBottom();
    })
    .catch(() => {
      hideTypingIndicator();
      appendBotMessage("I couldn't load the calendar right now. Please try again in a moment.");
    });
}

// Builds the calendar DOM element
function buildCalendarWidget() {
  // Fixed 50-min slots with lunch break 13:00-13:50
  const ALL_SLOTS = [
    '08:00','08:50','09:40','10:30','11:20','12:10',
    '14:00','14:50','15:40','16:30'
  ];

  const today = new Date();
  const preselected = chatState.calSelectedDate
    ? new Date(chatState.calSelectedDate + 'T12:00:00')
    : null;
  let viewYear  = preselected ? preselected.getFullYear() : today.getFullYear();
  let viewMonth = preselected ? preselected.getMonth()    : today.getMonth();

  const widget = document.createElement('div');
  widget.className = 'cal-widget';
  widget.id = 'cal-widget';

  function render() {
    const workingDays  = chatState.calAvailability.working_days;  // e.g. ['Monday','Wednesday']
    const bookedSlots  = chatState.calAvailability.booked_slots;  // e.g. [{date:'2026-07-07',time:'09:40'}]
    const selDate      = chatState.calSelectedDate;
    const selTime      = chatState.calSelectedTime;

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const dayNames   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    const firstDay     = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Cut-off: today is the earliest bookable date
    const todayStr = today.toISOString().split('T')[0];

    // 8-week limit from today
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 56);

    let html = `
      <div class="cal-header">
        <button class="cal-nav-btn" onclick="calNavigate(-1)">&#8249;</button>
        <span>${monthNames[viewMonth]} ${viewYear}</span>
        <button class="cal-nav-btn" onclick="calNavigate(1)">&#8250;</button>
      </div>
      <div class="cal-day-labels">
        ${dayNames.map(d => `<div class="cal-day-label">${d}</div>`).join('')}
      </div>
      <div class="cal-grid">
        ${Array(firstDay).fill('<div class="cal-day-btn empty"></div>').join('')}
    `;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj  = new Date(viewYear, viewMonth, d);
      const dateStr  = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayName  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dateObj.getDay()];
      const isPast   = dateStr < todayStr;
      const isFuture = dateObj > maxDate;
      const isWorking = workingDays.includes(dayName);
      const disabled  = isPast || isFuture || !isWorking;
      const isSelected = dateStr === selDate;
      const isToday    = dateStr === todayStr;

      let cls = 'cal-day-btn';
      if (isSelected) cls += ' selected';
      if (isToday && !isSelected) cls += ' today';

      html += `<button class="${cls}" ${disabled ? 'disabled' : ''} onclick="calSelectDate('${dateStr}')">${d}</button>`;
    }

    html += `</div>`;

    // Time slots — shown only after a date is selected
    if (selDate) {
      const bookedTimesForDate = bookedSlots
        .filter(s => s.date === selDate)
        .map(s => s.time);

      html += `
        <div class="cal-time-section">
          <div class="cal-time-label">Available times for ${formatCalDate(selDate)}</div>
          <div class="cal-time-grid">
            ${ALL_SLOTS.map(slot => {
              const isBooked   = bookedTimesForDate.includes(slot);
              const isSelected = slot === selTime;
              let cls = 'cal-time-btn';
              if (isSelected) cls += ' selected';
              return `<button class="${cls}" ${isBooked ? 'disabled' : ''} onclick="calSelectTime('${slot}')">${slot}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    const btnLabel = selDate && selTime
      ? `Confirm — ${formatCalDate(selDate)} at ${selTime}`
      : 'Select a date and time';

    html += `<button class="cal-confirm-btn" ${!(selDate && selTime) ? 'disabled' : ''} onclick="calConfirm()">${btnLabel}</button>`;

    widget.innerHTML = html;
  }

  // Expose navigation to global scope so onclick can reach it
  window.calNavigate = function(dir) {
    viewMonth += dir;
    if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
    render();
  };

  window.calSelectDate = function(dateStr) {
    chatState.calSelectedDate = dateStr;
    chatState.calSelectedTime = null;
    render();
    scrollToBottom();
  };

  window.calSelectTime = function(time) {
    chatState.calSelectedTime = time;
    render();
  };

  window.calConfirm = function() {
    const b = chatState.bookingData;
    b.appt_date = chatState.calSelectedDate;
    b.appt_time = chatState.calSelectedTime;
    chatState.bookingStep++;
    showBookingSummary();
  };

  render();
  return widget;
}

// Formats a YYYY-MM-DD date string to a readable label
function formatCalDate(str) {
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long' });
}

// --------------------CALENDER WIDGET FUNCTIONS ----------------------------------------------

//-----------BOOKING SUMMARY -----------------
// Renders the booking summary card for the user to confirm
function showBookingSummary() {
  const b = chatState.selectedDoctor;
  const d = chatState.bookingData;
  const doctorName = `Dr ${b.first_name} ${b.last_name}`;

  chatState.phase = 'booking_summary';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage("Here's a summary of your booking — please check everything before confirming.");

    const card = document.createElement('div');
    card.className = 'chat-message bot-message';
    card.style.padding = '0';
    card.style.background = 'none';
    card.innerHTML = `
      <div class="booking-summary-card">
        <div class="bsc-header">Booking summary</div>
        <div class="bsc-row"><span class="bsc-label">Therapist</span><span class="bsc-value">${doctorName}</span></div>
        <div class="bsc-row"><span class="bsc-label">Date</span><span class="bsc-value">${formatCalDate(d.appt_date)}</span></div>
        <div class="bsc-row"><span class="bsc-label">Time</span><span class="bsc-value">${d.appt_time}</span></div>
        <div class="bsc-row"><span class="bsc-label">Name</span><span class="bsc-value">${d.patient_name}</span></div>
        <div class="bsc-row"><span class="bsc-label">Date of birth</span><span class="bsc-value">${d.patient_dob}</span></div>
        <div class="bsc-row"><span class="bsc-label">Phone</span><span class="bsc-value">${d.patient_phone}</span></div>
        <div class="bsc-row"><span class="bsc-label">Email</span><span class="bsc-value">${d.patient_email}</span></div>
        <div class="bsc-row"><span class="bsc-label">Emergency</span><span class="bsc-value">${d.emergency_name}, ${d.emergency_relationship}, ${d.emergency_number}</span></div>
        <div class="bsc-row"><span class="bsc-label">Medications</span><span class="bsc-value">${d.medications}</span></div>
        <div class="bsc-actions">
          <button class="bsc-btn-confirm" onclick="sendMessage('confirm booking')">Confirm</button>
          <button class="bsc-btn-edit"    onclick="sendMessage('edit booking')">Edit</button>
          <button class="bsc-btn-cancel"  onclick="sendMessage('cancel booking')">Cancel</button>
        </div>
      </div>
    `;
    document.querySelector('#chat-messages').appendChild(card);
    scrollToBottom();
  }, 900);
}

// Posts the completed booking to Flask and shows the confirmation
function writeBooking() {
  const b = chatState.bookingData;
  const doc = chatState.selectedDoctor;

  showTypingIndicator();

  fetch('http://127.0.0.1:5000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctor_id:         doc.id,
      patient_name:      b.patient_name,
      patient_dob:       b.patient_dob,
      patient_phone:     b.patient_phone,
      patient_email:     b.patient_email,
      emergency_contact: `${b.emergency_name}, ${b.emergency_relationship}, ${b.emergency_number}`,
      prev_therapy:      b.prev_therapy,
      prev_detail:       b.prev_detail || null,
      presenting:        b.presenting,
      medications:       b.medications,
      appt_date:         b.appt_date,
      appt_time:         b.appt_time
    })
  })
  .then(res => res.json())
  .then(data => {
    hideTypingIndicator();
    if (data.error) {
      appendBotMessage("Something went wrong saving your booking. Please try again.");
      return;
    }

    const doctorName = `Dr ${doc.first_name} ${doc.last_name}`;
    const card = document.createElement('div');
    card.className = 'chat-message bot-message';
    card.style.padding = '0';
    card.style.background = 'none';
    card.innerHTML = `
      <div class="booking-confirm-card">
        <div class="bcc-icon">✓</div>
        <div class="bcc-title">You're all booked!</div>
        <div class="bcc-ref">${data.reference}</div>
        <div class="bcc-note">
          Your session with <strong>${doctorName}</strong> is confirmed for
          <strong>${formatCalDate(b.appt_date)} at ${b.appt_time}</strong>.<br><br>
          A confirmation email has been sent to ${b.patient_email}. Payment and medical aid details will be handled on arrival.,
          30–45 minutes before your first session. Please bring your ID and medical aid card.
        </div>
      </div>
    `;
    document.querySelector('#chat-messages').appendChild(card);
    scrollToBottom();

    setTimeout(() => {
      appendBotMessage(
        "Is there anything else I can help you with?<br><br>" +
        "<button class='menu-option' onclick='sendMessage(\"book another session\")'>📅 Book another session</button>" +
        "<button class='menu-option' onclick='sendMessage(\"nav: main menu\")'>🏠 Back to main menu</button>"
      );
      chatState.phase = 'booking_complete';
    }, 800);
  })
  .catch(() => {
    hideTypingIndicator();
    appendBotMessage("I couldn't reach the server. Please check your connection and try again.");
  });
}//-----BOOKING SUMMARY-------------------

// Updates the character counter on the presenting textarea
function presentingCount(textarea) {
  const remaining = 500 - textarea.value.length;
  const counter = document.getElementById('presenting-counter');
  if (counter) {
    counter.textContent = `${remaining} character${remaining === 1 ? '' : 's'} remaining`;
    counter.style.color = remaining < 50 ? '#c0392b' : '';
  }
}

// Submits the presenting concern and advances to next step
function presentingSubmit() {
  const input = document.getElementById('presenting-input');
  if (!input) return;
  const value = input.value.trim();
  if (value.length < 10) {
    input.style.borderColor = '#c0392b';
    const counter = document.getElementById('presenting-counter');
    if (counter) counter.textContent = 'Please share a little more before continuing.';
    return;
  }
  chatState.bookingData.presenting = value;
  appendUserMessage(value.length > 60 ? value.substring(0, 60) + '…' : value);
  chatState.bookingStep++;
  chatState.phase = 'booking_intake';
  askBookingQuestion();
}

// Renders the booking summary card
function showBookingSummary() {
  const doc = chatState.selectedDoctor;
  const d   = chatState.bookingData;
  const doctorName = `Dr ${doc.first_name} ${doc.last_name}`;

  chatState.phase = 'booking_summary';

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage("Here's a summary of your booking — please check everything before confirming.");

    const card = document.createElement('div');
    card.className = 'chat-message bot-message';
    card.style.padding = '0';
    card.style.background = 'none';
    card.innerHTML = `
      <div class="booking-summary-card">
        <div class="bsc-header">Booking summary</div>
        <div class="bsc-row"><span class="bsc-label">Therapist</span><span class="bsc-value">${doctorName}</span></div>
        <div class="bsc-row"><span class="bsc-label">Date</span><span class="bsc-value">${formatCalDate(d.appt_date)}</span></div>
        <div class="bsc-row"><span class="bsc-label">Time</span><span class="bsc-value">${d.appt_time}</span></div>
        <div class="bsc-row"><span class="bsc-label">Name</span><span class="bsc-value">${d.patient_name}</span></div>
        <div class="bsc-row"><span class="bsc-label">Date of birth</span><span class="bsc-value">${d.patient_dob}</span></div>
        <div class="bsc-row"><span class="bsc-label">Phone</span><span class="bsc-value">${d.patient_phone}</span></div>
        <div class="bsc-row"><span class="bsc-label">Email</span><span class="bsc-value">${d.patient_email}</span></div>
        <div class="bsc-row"><span class="bsc-label">Emergency</span><span class="bsc-value">${d.emergency_name}, ${d.emergency_relationship}, ${d.emergency_number}</span></div>
        <div class="bsc-row"><span class="bsc-label">Medications</span><span class="bsc-value">${d.medications}</span></div>
        <div class="bsc-row"><span class="bsc-label">Reason</span><span class="bsc-value presenting-preview">${d.presenting}</span></div>
        <div class="bsc-actions">
          <button class="bsc-btn-confirm" onclick="sendMessage('confirm booking')">Confirm</button>
          <button class="bsc-btn-edit"    onclick="sendMessage('edit booking')">Edit</button>
          <button class="bsc-btn-cancel"  onclick="sendMessage('cancel booking')">Cancel</button>
        </div>
      </div>
    `;
    document.querySelector('#chat-messages').appendChild(card);
    scrollToBottom();
  }, 900);
}

// Posts the completed booking to Flask and shows the confirmation
function writeBooking() {
  const b   = chatState.bookingData;
  const doc = chatState.selectedDoctor;

  showTypingIndicator();

  fetch('http://127.0.0.1:5000/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctor_id:         doc.id,
      patient_name:      b.patient_name,
      patient_dob:       b.patient_dob,
      patient_phone:     b.patient_phone,
      patient_email:     b.patient_email,
      emergency_contact: `${b.emergency_name}, ${b.emergency_relationship}, ${b.emergency_number}`,
      prev_therapy:      b.prev_therapy,
      prev_detail:       b.prev_detail || null,
      presenting:        b.presenting,
      medications:       b.medications,
      appt_date:         b.appt_date,
      appt_time:         b.appt_time
    })
  })
  .then(res => res.json())
  .then(data => {
    hideTypingIndicator();
    if (data.error) {
      appendBotMessage("Something went wrong saving your booking. Please try again.");
      return;
    }
    const doctorName = `Dr ${doc.first_name} ${doc.last_name}`;
    const card = document.createElement('div');
    card.className = 'chat-message bot-message';
    card.style.padding = '0';
    card.style.background = 'none';
    card.innerHTML = `
      <div class="booking-confirm-card">
        <div class="bcc-icon">✓</div>
        <div class="bcc-title">You're all booked!</div>
        <div class="bcc-ref">${data.reference}</div>
        <div class="bcc-note">
          Your session with <strong>${doctorName}</strong> is confirmed for
          <strong>${formatCalDate(b.appt_date)} at ${b.appt_time}</strong>.<br><br>
          Payment and medical aid are handled on arrival,
          30–45 minutes before your first session. Please bring your ID and medical aid card.
        </div>
      </div>
    `;
    document.querySelector('#chat-messages').appendChild(card);
    scrollToBottom();

    setTimeout(() => {
      appendBotMessage(
        "Is there anything else I can help you with?<br><br>" +
        "<button class='menu-option' onclick='sendMessage(\"👤 Browse the team\")'>📅 Book another session</button>" +
        "<button class='menu-option' onclick='sendMessage(\"nav: main menu\")'>🏠 Back to main menu</button>"
      );
      chatState.phase = 'booking_complete';
    }, 800);
  })
  .catch(() => {
    hideTypingIndicator();
    appendBotMessage("I couldn't reach the server. Please check your connection and try again.");
  });
}







 

// Render the full detail card for the selected therapist
function showTherapistCard(id) {
  const t = chatState.browseList.find(d => d.id === id);
  if (!t) return;

  chatState.selectedDoctor = t;

  const initials = t.first_name.charAt(0) + t.last_name.charAt(0);

  appendBotMessage(
    `<div class="bot-therapist-card">
      <div class="btc-header">
        <div class="btc-avatar">${initials}</div>
        <div>
          <span class="btc-name">Dr ${t.first_name} ${t.last_name}</span>
          <span class="btc-title">${t.title} · ${t.specialisation}</span>
        </div>
      </div>
      <div class="btc-body">
        <p class="btc-bio">${t.bio}</p>
        <span class="btc-fee"> R${t.price} / session</span>
        <div class="btc-actions">
          <button class="btc-btn-book" onclick="appendUserMessage('Book a session'); startBooking();">Book a session</button>
          <button class="btc-btn-back" onclick="sendMessage('nav: back to team')">Back to team</button>
        </div>
        <button class="btc-btn-menu" onclick="sendMessage('nav: main menu')">Back to main menu</button>
      </div>
    </div>`
  );

  chatState.phase = 'browsing_card';
}



// Function to display Crisis Line when Flagged words detected
function handleCrisis() {
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "I can hear that you're going through something really difficult. " +
      "Please reach out to one of these resources right now — they're free and available 24/7:<br><br>" +
      "<strong>SADAG:</strong> 0800 456 789<br>" +
      "<strong>Lifeline:</strong> 0861 322 322<br>" +
      "<strong>SMS:</strong> 31393<br>" +
      "<strong>Emergency:</strong> 10111<br><br>" +
      "Is there anything else I can help you with today?"
    );
    chatState.phase = 'crisis_closing';
  }, 1500);
}

//Function to handle conversation after crisis message given
function handleCrisisClosing(text) {
  const lower = text.toLowerCase();
  const isNo = ['no', 'nope', 'im fine', "i'm fine", 'no thanks', 'nah','its ok'].some(w => lower.includes(w));

  if (isNo) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("You've taken a brave step today. Please be gentle with yourself. Reach out when you need any help");
      setTimeout(() => {
        resetToWelcome(); // Reset chatbot message to welcome screen and clear previous message
      }, 3000);
    }, 10000);
  } else {
    chatState.crisisDetected = false;
    chatState.phase = 'menu'; // continue conversation
    showMenuOptions();
  }

}
// function to switch between different states 
function handlePhase(text) {
  switch (chatState.phase) {
    case 'menu':
      handleMenuInput(text);
      break;
    case 'crisis':
      handleCrisis();
      break;
    case 'crisis_closing':
      handleCrisisClosing(text);
      break;
    case 'faq':
      handleFAQInput(text);
      break;
    case 'therapy_style':
      handleTherapyStyleInput(text);
      break;
    case 'therapy_style_closing':
      handleTherapyStyleClosing(text);
      break;
    case 'therapy_groups':
      handleTherapyGroupInput(text);
      break;
    case 'browsing':
      handleBrowsingInput(text);
      break;
    case 'browsing_card':
      handleBrowsingCardInput(text);
      break;
    case 'booking_intake':
      handleBookingInput(text);
      break;
    case 'booking_prev_therapy':
      handleBookingInput(text);
      break;
    case 'booking_summary':
      handleBookingSummaryInput(text);
      break;
    case 'booking_calendar':
      break;
    case 'booking_complete':
      handleMenuInput(text);
      break;
    case 'booking_presenting':
      break;
    case 'booking_cancel_confirm':
      handleCancelConfirm(text);
      break;
    case 'intake_q1':
      break;
    case 'intake_q2':
      break;
    case 'intake_q3':
      break;
    case 'intake_q4':
      break;
    case 'intake_q5':
      break;
    case 'intake_q6':
      break;
    default:
      break;
  }
}

// function to display FAQ menu
function handleFAQ() {
  chatState.phase = 'faq';
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Here are some common questions — tap one to get an answer:<br><br>" +
      "<button class='menu-option' onclick='sendMessage(\"💰 How much does a session cost?\")'>💰 How much does a session cost?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"⏱️ How long is a session?\")'>⏱️ How long is a session?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"💻 Do you offer online sessions?\")'>💻 Do you offer online sessions?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"🧠 What therapy styles do you offer?\")'>🧠 What therapy styles do you offer?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"🔒 Is everything confidential?\")'>🔒 Is everything confidential?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"🌍 What languages are available?\")'>🌍 What languages are available?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"💳 Do you accept medical aid?\")'>💳 Do you accept medical aid?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"📅 How do I cancel or reschedule?\")'>📅 How do I cancel or reschedule?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"🧩 How do I find the right therapist?\")'>🧩 How do I find the right therapist?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"🌱 I have never done therapy before\")'>🌱 I\'ve never done therapy before</button>" +
      "<button class='menu-option' onclick='sendMessage(\"👶 Do you work with children?\")'>👶 Do you work with children?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"👫 Do you offer couples or family therapy?\")'>👫 Do you offer couples or family therapy?</button>" +
      "<button class='menu-option' onclick='sendMessage(\"🏥 What conditions do you work with?\")'>🏥 What conditions do you work with?</button>"
    );
  }, 1000);
}


// function to reroute user to next phase of the chat flow
function handleMenuInput(text) {
  const lower = text.toLowerCase();

  if (lower.includes('find my match') || lower.includes('🔍')) {
    startIntake();
    // handleQ1() will go here next session
  } else if (lower.includes('browse the team') || lower.includes('👤')) {
     handleBrowseTeam();
    // handleBrowse() will go here next session
  } else if (lower.includes('faq') || lower.includes('📋')) {
    handleFAQ();
    // handleFAQ() will go here next session
  } else if (lower.includes('crisis support') || lower.includes('🆘')) {
    chatState.crisisDetected = true;
    chatState.phase = 'crisis';
    handleCrisis();
  } else {
    appendBotMessage("Please select one of the options above, so I can best help you :)");
    showMenuOptions();
  }
}

//function that routes the user based on the input FAQ
function handleFAQInput(text) {
  const lower = text.toLowerCase();
  let answer = '';

  if (lower.includes('cost') || lower.includes('much')) {
    answer = "Sessions range from <strong>R1,000 to R1,500</strong> depending on the therapist. If cost is a concern, let us know — we'll do our best to find a workable option.";

  } else if (lower.includes('how long') || lower.includes('length')) {
    answer = "Standard sessions are <strong>50 minutes</strong>. Couples and family sessions may run slightly longer depending on the therapist.";

  } else if (lower.includes('online')) {
    answer = "Yes — all our therapists offer both <strong>in-person and online</strong> sessions via a secure video platform. Choose whatever feels most comfortable.";

  } else if (lower.includes('therapy style') || lower.includes('what therapy')) {
    showTherapyStyleGroups(); // updated to include the group version
    return; // therapy styles has its own flow — exit early

  } else if (lower.includes('confidential')) {
    answer = "Everything shared in sessions is <strong>strictly confidential</strong>. The only exception is where there is risk of harm to yourself or others, as required by South African law.";

  } else if (lower.includes('language')) {
    answer = "Our therapists collectively offer sessions in <strong>English, Afrikaans, Zulu, Xhosa, Sesotho, Tswana, Swati, Ndebele, Tsonga, Tamil, French, Portuguese, Spanish, Mandarin, Vietnamese,</strong> and <strong>Swahili</strong>.";

  } else if (lower.includes('medical aid')) {
    answer = "Yes — we are registered with most major medical aids including <strong>Discovery, Momentum, and Bonitas</strong>. Confirm your specific benefits with your scheme before booking.";

  } else if (lower.includes('cancel') || lower.includes('reschedule')) {
    answer = "Sessions can be cancelled or rescheduled with at least <strong>24 hours' notice</strong> at no charge. Late cancellations may incur a fee at the therapist's discretion.";

  } else if (lower.includes('right therapist') || lower.includes('find')) {
    answer = "That's exactly what our matching tool is for! It asks a few questions about what you're looking for and finds therapists who fit your needs, preferences, and availability.";

  } else if (lower.includes('never') || lower.includes('first time') || lower.includes('never done')) {
    answer = "That's completely okay — most people feel nervous the first time. Your first session is simply a conversation. There's no pressure, no right or wrong answers.";

  } else if (lower.includes('children') || lower.includes('child')) {
    answer = "Yes — we have therapists who specialise in working with children using <strong>Play Therapy</strong> and other age-appropriate approaches.";

  } else if (lower.includes('couples') || lower.includes('family')) {
    answer = "Yes — several therapists are trained in <strong>Gottman Method, Family/Marital Therapy,</strong> and <strong>Interpersonal</strong> approaches for couples and families.";

  } else if (lower.includes('condition')) {
    answer = "Our therapists work with <strong>anxiety, depression, trauma, grief, relationship difficulties, life transitions, burnout, ADHD, eating concerns, substance use, anger, self-esteem,</strong> and more.";

  } else {
    // fallback if nothing matched
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("I didn't quite catch that. Here are the questions I can help with:");
      handleFAQ();
    }, 1000);
    return;
  }

  // show answer then ask follow-up
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(answer);
    setTimeout(() => {
      appendBotMessage(
        "Do you have another question?<br><br>" +
        "<button class='menu-option' onclick='sendMessage(\"yes another question\")'>❓ Yes, another question</button>" +
        "<button class='menu-option' onclick='sendMessage(\"no find match\")'>🔍 No, help me find a match</button>" +
        "<button class='menu-option' onclick='sendMessage(\"no thanks faq done\")'>✅ No thanks, I'm done</button>"
      );
      chatState.phase = 'faq_closing';
    }, 12000);
  }, 1000);
}

// function to show therapy approach group menu
function showTherapyStyleGroups() {
  chatState.phase = 'therapy_groups';
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      "Our therapists work across a wide range of approaches. Choose a category to explore:<br><br>" +
      "<button class='menu-option' onclick='sendMessage(\"group: Cognitive & Behavioural\")'>🧠 Cognitive & Behavioural</button>" +
      "<button class='menu-option' onclick='sendMessage(\"group: Depth & Insight\")'>🔍 Depth & Insight</button>" +
      "<button class='menu-option' onclick='sendMessage(\"group: Relational & Systemic\")'>🤝 Relational & Systemic</button>" +
      "<button class='menu-option' onclick='sendMessage(\"group: Trauma & Mindfulness\")'>🛡️ Trauma & Mindfulness</button>" +
      "<button class='menu-option' onclick='sendMessage(\"group: Narrative & Strengths\")'>📖 Narrative & Strengths</button>" +
      "<button class='menu-option' onclick='sendMessage(\"group: Integrative & Specialist\")'>🔀 Integrative & Specialist</button>"
    );
  }, 1000);
}

function handleTherapyGroupInput(text) {
  const lower = text.toLowerCase();
  const key = lower.replace('group: ', '').trim();
  const matched = Object.keys(THERAPY_GROUPS).find(g => g === key);

  if (matched) {
    showTherapyStyles(matched);
  } else {
    appendBotMessage("I didn't catch that — here are the categories again:");
    showTherapyStyleGroups();
  }
}





// updated therapyStyle function to include the group updated
// List of therapy groups and the therapy approaches that belong to those groups
const THERAPY_GROUPS = {
  'cognitive & behavioural': ['CBT', 'DBT', 'ACT', 'Motivational Interviewing'],
  'depth & insight': ['Psychodynamic', 'Psychoanalytic', 'Jungian', 'AEDP'],
  'relational & systemic': ['Person-Centred', 'Relational', 'Attachment-Based', 'Interpersonal', 'Gottman Method', 'Family/Marital'],
  'trauma & mindfulness': ['Trauma-Focused', 'Mindfulness-Based', 'Compassion-Focused'],
  'narrative & strengths': ['Narrative', 'Strength-Based', 'Positive Psychology'],
  'integrative & specialist': ['Integrative', 'Coaching', 'Neuropsychology', 'Play Therapy'],
};

function showTherapyStyles(group) {
  chatState.faqContext.therapyGroup = group;
  chatState.phase = 'therapy_style';

  const key = group.toLowerCase();
  const styles = THERAPY_GROUPS[key];

  if (!styles) {
    appendBotMessage("I couldn't find that group. Let's try again:");
    showTherapyStyleGroups();
    return;
  }

  const buttons = styles.map(style => {
    const seen = chatState.faqContext.seenStyles.includes(style);
    return `<button class='menu-option${seen ? ' seen' : ''}' onclick='sendMessage("style: ${style}")'>${style}</button>`;
  }).join('');

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(
      `Here are the <strong>${group}</strong> approaches — tap any to learn more:<br><br>${buttons}`
    );
  }, 1000);
}


 
// function displays the different therapy descriptions based on the user selection
function handleTherapyStyleInput(text) {
  const lower = text.toLowerCase();

  // extract style name from "style: CBT" format and track it
  const styleMatch = text.replace('style: ', '').trim();
  if (!chatState.faqContext.seenStyles.includes(styleMatch)) {
    chatState.faqContext.seenStyles.push(styleMatch);
  }

  let answer = '';

  if (lower.includes('mindfulness')) {
    answer = "<strong>Mindfulness-Based Therapy</strong><br>Helps you develop calm, non-judgmental awareness of your thoughts and feelings in the present moment. Rather than suppressing what you're experiencing, you learn to observe it with curiosity — reducing stress, anxiety, and emotional reactivity over time.";
  } else if (lower.includes('cbt')) {
    answer = "<strong>CBT (Cognitive Behavioural Therapy)</strong><br>Explores the connection between your thoughts, feelings, and behaviours. By identifying unhelpful thinking patterns and gently challenging them, you learn to respond to situations in healthier, more balanced ways. Practical, structured, and often produces results within a relatively short time.";
  } else if (lower.includes('dbt')) {
    answer = "<strong>DBT (Dialectical Behaviour Therapy)</strong><br>Combines acceptance and change strategies to help you manage intense emotions, reduce harmful behaviours, and improve relationships. You'll build skills across four areas: mindfulness, distress tolerance, emotion regulation, and interpersonal effectiveness.";
  } else if (lower.includes('act')) {
    answer = "<strong>ACT (Acceptance and Commitment Therapy)</strong><br>Teaches you to stop fighting your thoughts and feelings and instead make room for them, while moving toward what matters most to you. By clarifying your values and committing to meaningful action, you build a richer, more purposeful life — even in the presence of pain.";
  } else if (lower.includes('motivational')) {
    answer = "<strong>Motivational Interviewing</strong><br>A collaborative, conversation-based approach designed to help you explore and strengthen your own motivation to change. You're guided to uncover your own reasons for change — making it especially useful when you feel stuck, conflicted, or ambivalent.";
  } else if (lower.includes('psychodynamic')) {
    answer = "<strong>Psychodynamic Therapy</strong><br>Explores how unconscious patterns, early life experiences, and unresolved emotions shape who you are today. By bringing these hidden influences into awareness, you gain deeper self-understanding and greater freedom to make different choices.";
  } else if (lower.includes('person')) {
    answer = "<strong>Person-Centred Therapy</strong><br>Built on the belief that you are the expert on your own life. Your therapist provides a warm, non-judgmental space where you feel safe to explore your feelings at your own pace — helping you reconnect with your own inner wisdom.";
  } else if (lower.includes('gottman')) {
    answer = "<strong>Gottman Method</strong><br>Developed from decades of relationship research, this approach helps couples build deeper friendship, manage conflict constructively, and create shared meaning. Particularly effective for improving trust, respect, and connection.";
  } else if (lower.includes('interpersonal')) {
    answer = "<strong>Interpersonal Therapy (IPT)</strong><br>Focuses on how your relationships and life circumstances affect your emotional wellbeing. Particularly effective for depression and grief, helping you navigate role changes, communication difficulties, and relationship conflicts.";
  } else if (lower.includes('narrative')) {
    answer = "<strong>Narrative Therapy</strong><br>Helps you separate your identity from your problems, recognise the strengths already present in your story, and rewrite unhelpful narratives that may be holding you back. You are never the problem — the problem is the problem.";
  } else if (lower.includes('trauma')) {
    answer = "<strong>Trauma-Focused Therapy</strong><br>Designed to help you process and recover from traumatic experiences. Using evidence-based techniques in a safe, paced environment, your therapist will help you reduce distressing symptoms and gradually reclaim a sense of safety and control.";
  } else if (lower.includes('relational')) {
    answer = "<strong>Relational Therapy</strong><br>Recognises that healing happens in connection with others. Your therapist pays close attention to the dynamic between the two of you as a window into broader relationship patterns in your life.";
  } else if (lower.includes('play')) {
    answer = "<strong>Play Therapy</strong><br>Primarily used with children, allowing young clients to express what they cannot yet put into words — through play, art, storytelling, and imagination. Provides a safe, natural space to process emotions and develop coping skills.";
  } else if (lower.includes('aedp')) {
    answer = "<strong>AEDP (Accelerated Experiential Dynamic Psychotherapy)</strong><br>A healing-focused therapy that works with emotions deeply and safely. Your therapist actively creates a warm, secure relationship that helps you process difficult emotional experiences you may have had to face alone.";
  } else if (lower.includes('attachment')) {
    answer = "<strong>Attachment-Based Therapy</strong><br>Rooted in the understanding that early relationships with caregivers shape how we connect with others throughout life. Helps you understand relationship anxiety, avoidance, or difficulty trusting others — and develop more secure connections.";
  } else if (lower.includes('coaching')) {
    answer = "<strong>Coaching</strong><br>Future-focused and goal-oriented. Designed for people who want to clarify direction, overcome obstacles, and unlock their potential — whether in career, relationships, or personal growth.";
  } else if (lower.includes('positive')) {
    answer = "<strong>Positive Psychology</strong><br>Shifts the focus from what's wrong to what's strong. Helps you identify and build on your strengths, cultivate gratitude and optimism, and design a life that feels meaningful and fulfilling.";
  } else if (lower.includes('integrative')) {
    answer = "<strong>Integrative Therapy</strong><br>Draws from multiple evidence-based approaches tailored to your unique needs. Your therapist blends techniques that best suit your personality, history, and goals — not one-size-fits-all.";
  } else if (lower.includes('strength')) {
    answer = "<strong>Strength-Based Therapy</strong><br>Begins with the belief that you already carry within you the resources needed to heal and grow. Instead of cataloguing problems, your therapist helps you identify and amplify your existing strengths and resilience.";
  } else if (lower.includes('neuro')) {
    answer = "<strong>Neuropsychology</strong><br>Bridges the brain and behaviour, assessing how neurological factors affect thinking, memory, emotion, and daily functioning. Often assessment-focused, helping inform tailored support plans for learning, rehabilitation, or mental health care.";
  } else if (lower.includes('compassion')) {
    answer = "<strong>Compassion-Focused Therapy (CFT)</strong><br>Especially helpful if you struggle with high levels of self-criticism, shame, or guilt. Teaches you to cultivate genuine warmth and understanding toward yourself — the same care you might offer a good friend.";
  } else if (lower.includes('jungian')) {
    answer = "<strong>Jungian Therapy</strong><br>Explores the unconscious through symbols, dreams, archetypes, and imagination. Helps you understand the deeper layers of your psyche — including parts of yourself you may have hidden or denied — leading toward greater wholeness.";
  } else if (lower.includes('psychoanalytic')) {
    answer = "<strong>Psychoanalytic Therapy</strong><br>Explores how early experiences and unconscious conflicts formed in childhood continue to influence your adult life. Through open-ended dialogue and careful attention to patterns, this approach fosters lasting insight and deep personal transformation.";
  } else if (lower.includes('family') || lower.includes('marital')) {
    answer = "<strong>Family / Marital Therapy</strong><br>Works with couples or family units as a whole system. Helps identify recurring patterns, improve communication, and resolve conflict in ways that strengthen the relationships that matter most.";
  } else {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      appendBotMessage("Please select one of the therapy styles provided below:");
      showTherapyStyles();
    }, 1000);
    return;
  }

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendBotMessage(answer);
    setTimeout(() => {

      const group = chatState.faqContext.therapyGroup;
      const key = group.toLowerCase();
      const styles = THERAPY_GROUPS[key];
      const allSeen = styles.every(s => chatState.faqContext.seenStyles.includes(s));

      if (allSeen) {
        // all styles in this group have been explored
        appendBotMessage(
          "You've explored all the approaches in this group! What would you like to do?<br><br>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: back to groups\")'>📂 Back to therapy categories</button>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: back to faqs\")'>❓ Back to FAQs</button>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: main menu\")'>🏠 Back to main menu</button>"
        );
      } else {
        appendBotMessage(
          "What would you like to do next?<br><br>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: more styles\")'>🔄 More styles in this group</button>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: back to groups\")'>📂 Back to therapy categories</button>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: back to faqs\")'>❓ Back to FAQs</button>" +
          "<button class='menu-option' onclick='sendMessage(\"nav: main menu\")'>🏠 Back to main menu</button>"
        );
      }
      chatState.phase = 'therapy_style_closing';
    }, 800);
  }, 1000);
 
}

// function to help the user navigate after providing a therapy style.
//updated to include all 4 options 
function handleTherapyStyleClosing(text) {
  const lower = text.toLowerCase();

  if (lower.includes('more styles')) {
    showTherapyStyles(chatState.faqContext.therapyGroup);
  } else if (lower.includes('back to groups')) {
    chatState.faqContext.seenStyles = [];   // clear seen styles when leaving group
    showTherapyStyleGroups();
  } else if (lower.includes('back to faqs')) {
    chatState.faqContext.seenStyles = [];
    chatState.faqContext.therapyGroup = null;
    handleFAQ();
  } else if (lower.includes('main menu')) {
    chatState.faqContext.seenStyles = [];
    chatState.faqContext.therapyGroup = null;
    showMenuOptions();
    chatState.phase = 'menu';
  }
}




//----------EVENT LISTENERS ------------------------------

//When X button on chatheader selected, hide chatbot window//
closeBtn.addEventListener("click",function(){
    chatWindow.classList.remove("open");
    resetToWelcome();
});


// Send button click
sendBtn.addEventListener("click", function() {
    sendMessage(chatInput.value);
});

// Send on Enter key
chatInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") sendMessage(chatInput.value);
});


toggleBtn.addEventListener("click", function() {
  chatWindow.classList.add("open");
  if (chatState.phase === 'idle') {
    chatState.phase = 'menu';
    showMenuOptions();
  }
});

