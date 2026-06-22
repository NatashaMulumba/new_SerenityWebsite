// CHATBOT Functionality //

const toggleBtn = document.querySelector("#chat-toggle-btn")
const chatWindow= document.querySelector("#chat-window")
const closeBtn = document.querySelector("#close-button")

toggleBtn.addEventListener("click",function(){
    chatWindow.classList.add("open");
});

closeBtn.addEventListener("click",function(){
    chatWindow.classList.remove("open");
});