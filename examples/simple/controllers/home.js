// a simple homeController, which shows two buttons
var homeController = new VPController({
  name: "home",       // all controllers must have a name
  actions: [          // some simple actions to go off to different controllers
    { selector: ".one", action: "show", arguments: ["one"] },
    { selector: ".two", action: "show", arguments: ["two"] }
  ],
  autoStart: true,    // we want this controller to automatically start
  // (optionaly) define some animations to use when showing and hiding this controller
  showAnimation: { name: 'slide-in-down', duration: 1 },
  hideAnimation: { name: 'slide-out-up', duration: 1 }
});
