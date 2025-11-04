(function () {
  var myElement = document?.getElementById("simple-bar");
  if (myElement)
    new SimpleBar(myElement, { autoHide: true });
})();
