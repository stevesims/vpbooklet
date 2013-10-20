var twoController = new VPController({
  name: "two",
  viewID: "two",      // this controller's view element will get this set as its "id" value
  parentSelector: "#other",   // explicitly set the selector for the parent element...
  displayReference: "main",   // only one controller with this reference can be visible at a time
  actions: [
    // this time, to show controller one we'll call the "show" action targetting the controller named "one"
    // the displayReference system ensures that this controller will be hidden
    { selector: ".one", action: "show", target: "one" },
    // but for "home" we'll use this.show
    { selector: ".home", action: "show", arguments: ["home"] },
    // and wire up an action for the "hello" button
    { selector: ".hello", action: "sayHello" }
  ],
  // this time we're going to delay the showing animation a little bit
  // VPBooklet will automatically set the animation-fill-mode to help ensure styles are applied correctly
  showAnimation: { name: 'fade-in', timingFunction: 'ease-in-out', duration: 1, delay: 0.5 },
  hideAnimation: { name: 'fade-out', timingFunction: 'ease-in-out', duration: 1 }
});
// a very simple action
twoController.sayHello = function sayHello() {
  window.alert("Hello!");
}
