// CHATBOT Functionality //

// chatbot memory container
const chatState = {
  phase: 'idle',
  patientProfile: {
    presentingIssue: null,
    sessionFor: null,
    ageGroup: null,
    language: null,
    therapistPrefs: { gender: null, background: null },
    availability: [],
    priorTherapy: null,
    priorType: null,
    priorWorked: null,
  },
  selectedDoctor: null,
  messages: [],
  crisisDetected: false,
};

// List of Keywords that Trigger crisis line
const CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
  'self harm', 'self-harm', 'cutting myself', 'hurt myself',
  'no reason to live', 'cant go on', "can't go on", 'hopeless',
  'overdose', 'not worth living'
];


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

function handleMenuInput(text) {
  const lower = text.toLowerCase();

  if (lower.includes('find my match') || lower.includes('🔍')) {
    chatState.phase = 'intake_q1';
    // handleQ1() will go here next session
  } else if (lower.includes('browse the team') || lower.includes('👤')) {
    chatState.phase = 'browsing';
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

//function that routes the user based on the input 
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
    showTherapyStyles();
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

