on.input.in = function() {
  var errors = input.editor.validate(input.in);
  if(errors.length) {
    output({errors: errors});
  } else {
    output({out: input.in});
  }
};
