// CHATBOT Functionality //

const toggleBtn = document.querySelector("#chat-toggle-btn")
const chatWindow= document.querySelector("#chat-window")
const closeBtn = document.querySelector("#close-button")
const hamburger = document.querySelector(".hamburger")
const navMenu = document.querySelector(".navbar-menu")

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


