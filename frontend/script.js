// CHATBOT Functionality //

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
// When Book session clicked, open up chatbot window //
toggleBtn.addEventListener("click",function(){
    chatWindow.classList.add("open");
});

//When X button on chatheader selected, hide chatbot window//
closeBtn.addEventListener("click",function(){
    chatWindow.classList.remove("open");
});

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



