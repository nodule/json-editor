module.exports = {
  name: "validate",
  ns: "json-editor",
  title: "JSON Editor Validate",
  description: "JSON Editor Validate",
  async: true,
  phrases: {
    active: "Validating form"
  },
  ports: {
    input: {
      "in": {
        title: "Json",
        type: "object",
        description: "JSON Object",
        async: true,
        fn: function __IN__(data, source, state, input, $, output) {
          var r = function() {
            var errors = $.editor.validate($.in);
            if (errors.length) {
              output({
                errors: $.create(errors)
              });
            } else {
              output({
                out: $.get('in')
              });
            }
          }.call(this);
          return {
            state: state,
            return: r
          };
        }
      },
      editor: {
        title: "Editor",
        type: "function",
        description: "JSONEditor instance"
      }
    },
    output: {
      out: {
        title: "Output",
        type: "string"
      },
      errors: {
        title: "Errors",
        type: "array",
        items: {
          type: "object",
          properties: {
            path: {
              title: "Path",
              description: "a dot separated path into the JSON object (e.g. `root.path.to.field`)",
              type: "string"
            },
            property: {
              title: "Property",
              description: "schema keyword that triggered the validation error (e.g. `minLength`)",
              type: "string"
            },
            message: {
              title: "Message",
              type: "string"
            }
          }
        }
      }
    }
  },
  state: {}
}