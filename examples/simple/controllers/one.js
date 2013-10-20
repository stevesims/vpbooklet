var oneController = new VPController({
  name: "one",
  viewClassName: "one-controller",  // this controller's view will get this class name set
  displayReference: "main",         // controllers can be given a displayReference...
  actions: [
    { selector: ".home", action: "show", arguments: ["home"] },
  ],
  outlets: [
    { selector: ".counter", name: "counterSpan" }   // for this controller, we're defining a "counterSpan" outlet
  ],
  showAnimation: { name: 'slide-in-left', timingFunction: 'ease-out', duration: 1 },
  hideAnimation: { name: 'slide-out-right', timingFunction: 'ease-in', duration: 1 },
  // set up a variable that this controller can use to track number of times it's been shown
  shownCounter: 0
});

// this controller gets a handleWillAppear method which will be called when this controller is about to appear
oneController.handleWillAppear = function handleWillAppear() {
  // first up, increment the shownCounter value
  this.shownCounter = this.shownCounter + 1;
  // then we'll set the textContent of the counterSpan outlet to be this new value
  this.counterSpan.textContent = this.shownCounter;
};
