JSON Editor
====

Component wrapping [JSON Editor](https://github.com/jdorn/json-editor).


Build the example:

`fbpx browserify graph/example.fbp --debug > example/bundle.js`

`http-server example/` or whatever tool to serve up a directory.

The example uses a schema's from the [JSON Resume](https://github.com/jsonresume/) project using the [Flat theme](https://github.com/erming/jsonresume-theme-flat).

Graph:

![JSON Editor Example](https://raw.githubusercontent.com/nodule/json-editor/master/graphs/example.png)

Can be generated using:

`fbpx graph graph/example.fbp | dot -Tsvg > graph/example.svg`
