/*-----------------------------------------------------------------------------------

 Template Name:Chitchat
 Template URI: themes.pixelstrap.com/chitchat
 Description: This is Chat website
 Author: Pixelstrap
 Author URI: https://themeforest.net/user/pixelstrap

 ----------------------------------------------------------------------------------- */
// 01. Switchery  js
// 03 .Add class to body for identify this is application page
// 04. Mobile responsive screens

 "use strict";
 /*=====================
   01. Switchery  js
  ==========================*/

   var elem = document.querySelector('.js-switch');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch1');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch2');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch5');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch6');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch7');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch8');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch9');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch10');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch11');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch12');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch13');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch14');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });
   var elem = document.querySelector('.js-switch16');
   var init = new Switchery(elem, { color: '#1c9dea', size: 'small' });


  /*=====================
   03 .Add class to body for identify this is application page
  ==========================*/
  document.body.classList.add("main-page");

  /*=====================
   04. Mobile responsive screens
  ==========================*/
  if (window.innerWidth <= 992) {
    document.querySelector(".main-nav")?.classList.remove("on");
    document.body.classList.remove("sidebar-active");

    document.querySelector(".app-sidebar")?.classList.remove("active");
    document.querySelector(".chitchat-main")?.classList.remove("small-sidebar");
  }

  if (window.innerWidth <= 800) {
    const chatItems = document.querySelectorAll("ul.chat-main li");
    chatItems.forEach((li) => {
      li.addEventListener("click", () => {
        document.querySelector(".main-nav")?.classList.remove("on");
      });
    });
  }

  /*=====================
   05. Function to remove default sidebar
  ==========================*/
  function removedefault() {
    document.body.classList.remove("sidebar-active");
    document.querySelector(".app-sidebar")?.classList.remove("active");
  }
