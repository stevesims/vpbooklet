A Self-Contained VPBooklet Example
==================================

self-contained.html is a relatively simple self-contained example of a VPBooklet app (excepting of course the need to load in libraries).

This example only ever shows one controller active at a time, but it includes three separate controllers that one can move between.

Normally with VPBooklet apps, the view for a controller would be an HTML file loaded in from a "views" sub-folder, however it is also possible to include a "viewDefinition". If a viewDefinition object is present it overrides the view loading mechanism. The value of the viewDefinition will be passed to VPUtils.buildElement, a utility function that can make views from a pure JS (or JSON) view definition. The buildElement object structure is fairly straightforward and self-explanatory.

The three controllers demonstrate many of the basics of how VPBooklet apps are put together.

homeController is a rather simple home menu. It includes a couple of simple actions to show the other two controllers, and is set to automatically start.

oneController has a slightly more complex view definition, includes just one action (to go back home) but also includes an outlet. There's a simple handleWillAppear method for this controller that updates the contents of the outlet.

twoController is also very simple. This controller demonstrates adding in a simple custom action.
