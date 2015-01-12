module.exports = {
  name: "editor",
  ns: "json-editor",
  title: "JSON Editor",
  description: "JSON Editor",
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
      "element": {
        title: "Element",
        description: "Element",
        type: "HTMLElement"
      },
      "in": {
        title: "Json",
        description: "JSON Object",
        "default": {},
        fn: function __IN__(data, x, source, state, input, output) {
          var r = function() {
            state.in = data;
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
        description: "A valid JSON Schema to use for the editor. Version 3 and Version 4 of the draft specification are supported.",
        fn: function __SCHEMA__(data, x, source, state, input, output) {
          var r = function() {
            state.schema = input.options.schema = input.schema;
            if (state.jsonEditor) {
              state.jsonEditor.destroy();
            }
            state.jsonEditor = json_editor(input.options);
            // problem if state.in is not about this schema..
            if (state.in) {
              state.jsonEditor.setValue(state.in);
            }
            state.jsonEditor.on('change', function() {
              output({
                out: state.jsonEditor.getValue()
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
        fn: function __ENABLE__(data, x, source, state, input, output) {
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
        fn: function __DISABLE__(data, x, source, state, input, output) {
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
            "default": false
          },
          disable_array_add: {
            title: "Disable array add",
            description: "If true, remove all `add row` buttons from arrays.",
            "default": false
          },
          disable_array_delete: {
            title: "Disable array delete",
            description: "If true, remove all `delete row` buttons from arrays.",
            "default": false
          },
          disable_array_reorder: {
            title: "Disable array reorder",
            description: "If true, remove all `move up` and `move down` buttons from arrays.",
            "default": false
          },
          disable_collapse: {
            title: "Disable collapse",
            description: "If true, remove all collapse buttons from objects and arrays.",
            "default": false
          },
          disable_edit_json: {
            title: "Disable edit json",
            description: "If true, remove all Edit JSON buttons from objects.",
            "default": false
          },
          disable_properties: {
            title: "Disable properties",
            description: "If true, remove all Edit Properties buttons from objects.",
            "default": false
          },
          form_name_root: {
            title: "Form name root",
            description: "The first part of the `name` attribute of form inputs in the editor. An full example name is `root[person][name]` where `root` is the form_name_root.",
            "default": "root"
          },
          iconlib: {
            title: "Iconlib",
            description: "The icon library to use for the editor. See the CSS Integration section below for more info.",
            "default": null
          },
          no_additional_properties: {
            title: "No additional properties",
            description: "If true, objects can only contain properties defined with the properties keyword.",
            "default": false
          },
          refs: {
            title: "Refs",
            description: "An object containing schema definitions for URLs. Allows you to pre-define external schemas.",
            "default": {}
          },
          required_by_default: {
            title: "Required by default",
            description: "If true, all schemas that don't explicitly set the required property will be required.",
            "default": false
          },
          show_errors: {
            title: "Show errors",
            description: "When to show validation errors in the UI. Valid values are interaction, change, always, and never.",
            "default": "interaction"
          },
          startval: {
            title: "Start value",
            description: " Seed the editor with an initial value. This should be valid against the editor's schema.",
            "default": null
          },
          template: {
            title: "Template",
            description: "The JS template engine to use. See the Templates and Variables section below for more info.",
            "default": "default"
          },
          theme: {
            title: "Theme",
            description: "The CSS theme to use. See the CSS Integration section below for more info.",
            "default": "html"
          }
        }
      }
    },
    output: {
      out: {
        title: "out",
        type: "string"
      }
    }
  },
  state: {}
}