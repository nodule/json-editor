on.input.in = function() {
  var errors = input.editor.validate(data);
  if(errors.length) {
    output({errors: errors});
  } else {
    output({out: data});
  }
};
