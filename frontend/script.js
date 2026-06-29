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
  faqContext: {
    therapyGroup: null,   // stores the group name while user browses styles
    seenStyles: [], 
  }
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
    case 'therapy_style':
      handleTherapyStyleInput(text);
      break;
    case 'therapy_style_closing':
      handleTherapyStyleClosing(text);
      break;
    case 'therapy_groups':
      handleTherapyGroupInput(text);
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





//function to show sub-menu for therapy style explanation [ non- group version]
// function showTherapyStyles() {
//   chatState.phase = 'therapy_style';
//   showTypingIndicator();
//   setTimeout(() => {
//     hideTypingIndicator();
//     appendBotMessage(
//       "Here are the therapy approaches our therapists work with — tap any to learn more:<br><br>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Mindfulness-Based\")'>🧘 Mindfulness-Based</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: CBT\")'>🧠 CBT</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: DBT\")'>⚖️ DBT</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: ACT\")'>🎯 ACT</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Motivational Interviewing\")'>💬 Motivational Interviewing</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Psychodynamic\")'>🔍 Psychodynamic</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Person-Centred\")'>🤝 Person-Centred</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Gottman Method\")'>💑 Gottman Method</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Interpersonal\")'>🔗 Interpersonal (IPT)</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Narrative\")'>📖 Narrative</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Trauma-Focused\")'>🛡️ Trauma-Focused</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Relational\")'>🌐 Relational</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Play Therapy\")'>🎨 Play Therapy</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: AEDP\")'>✨ AEDP</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Attachment-Based\")'>🔒 Attachment-Based</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Coaching\")'>🚀 Coaching</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Positive Psychology\")'>🌟 Positive Psychology</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Integrative\")'>🔀 Integrative</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Strength-Based\")'>💪 Strength-Based</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Neuropsychology\")'>🧬 Neuropsychology</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Compassion-Focused\")'>💛 Compassion-Focused (CFT)</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Jungian\")'>🌙 Jungian</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Psychoanalytic\")'>🛋️ Psychoanalytic</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Family Marital\")'>👨‍👩‍👧 Family / Marital</button>" +
//       "<button class='menu-option' onclick='sendMessage(\"style: Positive Psychology\")'>🌱 Positive Psychology</button>"
//     );
//   }, 1000);
// }

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

