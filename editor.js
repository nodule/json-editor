module.exports = {
  name: "editor",
  ns: "json-editor",
  title: "JSON Editor",
  description: "JSON Editor",
  async: true,
  phrases: {
    active: "Creating JSON Editor"
  },
  dependencies: {
    npm: {
      "json-editor": require('json-editor')
    }
  },
  ports: {
    input: {
      element: {
        title: "Element",
        description: "Element",
        type: "HTMLElement"
      },
      "in": {
        title: "Json",
        type: "object",
        description: "JSON Object",
        async: true,
        fn: function __IN__(data, source, state, input, $, output, json_editor) {
          var r = function() {
            state.in = $.in;
            if (state.jsonEditor) {
              state.jsonEditor.setValue(state.in);
            }
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      schema: {
        title: "Schema",
        type: "object",
        description: "A valid JSON Schema to use for the editor. Version 3 and Version 4 of the draft specification are supported.",
        async: true,
        fn: function __SCHEMA__(data, source, state, input, $, output, json_editor) {
          var r = function() {
            state.schema = $.options.schema = $.schema;
            if (state.jsonEditor) {
              state.jsonEditor.off('change', state.changeHandler);
              state.jsonEditor.destroy();
            }
            state.jsonEditor = new json_editor($.element, $.options);
            // problem if state.in is not about this schema..
            state.jsonEditor.on('ready', function() {
              if (state.in) {
                state.jsonEditor.setValue(state.in);
              }
              state.jsonEditor.on('change', state.changeHandler);
              output({
                editor: $.create(state.jsonEditor)
              });
            });
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      enable: {
        title: "Enable",
        description: "Enable",
        async: true,
        fn: function __ENABLE__(data, source, state, input, $, output, json_editor) {
          var r = function() {
            if (state.jsonEditor) {
              state.jsonEditor.enable();
            }
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      disable: {
        title: "Disable",
        description: "Disable",
        async: true,
        fn: function __DISABLE__(data, source, state, input, $, output, json_editor) {
          var r = function() {
            if (state.jsonEditor) {
              state.jsonEditor.disable();
            }
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      options: {
        title: "Options",
        type: "object",
        properties: {
          ajax: {
            title: "Ajax",
            description: "If true, JSON Editor will load external URLs in $ref via ajax.",
            type: "boolean",
            "default": false
          },
          disable_array_add: {
            title: "Disable array add",
            description: "If true, remove all `add row` buttons from arrays.",
            type: "boolean",
            "default": false
          },
          disable_array_delete: {
            title: "Disable array delete",
            description: "If true, remove all `delete row` buttons from arrays.",
            type: "boolean",
            "default": false
          },
          disable_array_reorder: {
            title: "Disable array reorder",
            description: "If true, remove all `move up` and `move down` buttons from arrays.",
            type: "boolean",
            "default": false
          },
          disable_collapse: {
            title: "Disable collapse",
            description: "If true, remove all collapse buttons from objects and arrays.",
            type: "boolean",
            "default": false
          },
          disable_edit_json: {
            title: "Disable edit json",
            description: "If true, remove all Edit JSON buttons from objects.",
            type: "boolean",
            "default": false
          },
          disable_properties: {
            title: "Disable properties",
            description: "If true, remove all Edit Properties buttons from objects.",
            type: "boolean",
            "default": false
          },
          form_name_root: {
            title: "Form name root",
            description: "The first part of the `name` attribute of form inputs in the editor. An full example name is `root[person][name]` where `root` is the form_name_root.",
            type: "boolean",
            "default": "root"
          },
          iconlib: {
            title: "Iconlib",
            description: "The icon library to use for the editor. See the CSS Integration section below for more info.",
            type: "string",
            "enum": ["bootstrap3",
              "bootstrap2",
              "foundation3",
              "foundation2",
              "jqueryui",
              "fontawesome4",
              "fontawesome3"
            ],
            "default": null
          },
          no_additional_properties: {
            title: "No additional properties",
            description: "If true, objects can only contain properties defined with the properties keyword.",
            type: "boolean",
            "default": false
          },
          refs: {
            title: "Refs",
            description: "An object containing schema definitions for URLs. Allows you to pre-define external schemas.",
            type: "object",
            "default": {}
          },
          required_by_default: {
            title: "Required by default",
            description: "If true, all schemas that don't explicitly set the required property will be required.",
            type: "boolean",
            "default": false
          },
          show_errors: {
            title: "Show errors",
            description: "When to show validation errors in the UI. Valid values are interaction, change, always, and never.",
            type: "string",
            "enum": ["interaction",
              "change",
              "always",
              "never"
            ],
            "default": "interaction"
          },
          startval: {
            title: "Start value",
            description: " Seed the editor with an initial value. This should be valid against the editor's schema.",
            type: "any",
            "default": null
          },
          template: {
            title: "Template",
            description: "The JS template engine to use. See the Templates and Variables section below for more info.",
            type: "string",
            "enum": ["default",
              "ejs",
              "hogan",
              "markup",
              "mustache",
              "swig",
              "underscore"
            ],
            "default": "default"
          },
          theme: {
            title: "Theme",
            description: "The CSS theme to use. See the CSS Integration section below for more info.",
            type: "string",
            "enum": ["html",
              "bootstrap3",
              "bootstrap2",
              "foundation5",
              "foundation4",
              "foundation3",
              "jqueryui"
            ],
            "default": "html"
          }
        }
      }
    },
    output: {
      out: {
        title: "out",
        type: "string"
      },
      editor: {
        title: "Editor",
        type: "JSONEditor"
      }
    }
  },
  state: {
    jsonEditor: null,
    changeHandler: function() {
      output({
        out: $.clone('in', state.jsonEditor.getValue())
      });
    }
  }
}