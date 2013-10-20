A Simple VPBooklet Example
==========================

This simple VPBooklet example is based on the self-contained example.

The structure of this example is intended to reflect that of a typical VPBooklet app.

Rather than lumping all the controllers in a single file, or in index.html, they are individually defined inside separate JavaScript files in the "controllers" folder. These controllers are all exactly as they were in the self-contained example but with their "viewDefinition" objects removed.

The "css" folder contains a "shared.css" file inside which style definitions that are shared across multiple controllers are placed. There are also controller-specific CSS files named after their corresponding controllers.

The "views" folder contains HTML files with names that match their corresponding controllers. As the controllers no longer have viewDefinition objects defined, VPController will automatically load up a view from a correspondingly named view file.

By convention, images are typically placed in an "images" folder (or sub-folders inside that), and libraries placed in a "lib" folder.


NB Owing to Google Chrome's default security policies this example will not work in Chrome when accessing it using a "file:" URI unless you have started Chrome passing in the --allow-file-access-from-files command line argument.
