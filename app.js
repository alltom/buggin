var connect = require('connect')
  , falafel = require('falafel')
  , fs = require('fs')
  , jshint = require('jshint');

/**
 * tom's shim that processes JavaScript in js and html files
 */
function filter(req, res, path, type) {
  if (type == 'application/javascript') {
    var content = fs.readFileSync(path, 'utf8');

    // parse with jshint
    jshint.JSHINT(content);
    var jshintData = jshint.JSHINT.data();

    content = falafel({
      source: content,
      loc: true
    }, function (node) {

      // wrap with Prebugger.snapshot():
      //  - all non-literal function arguments
      //  - anonymous functions
      // TODO: don't wrap anonymous functions passed as arguments ;p
      if (node.type === 'CallExpression') {
        for (var i in node.arguments) {
          var arg = node.arguments[i];
          if (arg.type !== 'Literal') {

            // find all variables in scope, then
            // make a string containing JavaScript like { 'var1' : var1 }
            // which we'll append to the argument list so that
            // Prebugger.snapshot receives a copy of all the local variables
            var vars = findVariablesInScope(jshintData, arg.loc.start.line, arg.loc.start.column);
            var captureVarsJS = '';
            for (var i = 0; i < vars.length; i++) {
              if (i > 0) {
                captureVarsJS += ',';
              }
              captureVarsJS += "'" + vars[i] + "':" + vars[i];
            }
            captureVarsJS = '{' + captureVarsJS + '}';

            // perform the replacement
            arg.update('Prebugger.snapshot(' + arg.source() + ', ' + JSON.stringify(arg.loc) + ', ' + captureVarsJS + ')');
          }
        }
      } else if (node.type === 'FunctionExpression') {
        node.update('Prebugger.snapshot(' + node.source() + ', ' + JSON.stringify(node.loc) + ')');
      }

      // TODO: later-transformation
      // if (node.type === 'Identifier' && node.name === 'later') {
      //   if (node.parent.type === 'ExpressionStatement') {
      //     node.parent.update('debugger;');
      //   } else {
      //     node.update('function () { debugger; }');
      //   }
      // }

    });
    content = content.toString();
    res.setHeader('Content-Length', content.length);
    res.end(content);
    return true;
  } else if (type == 'text/html') {
    var content = fs.readFileSync(path, 'utf8');
    content = '<!-- inside html -->\n' + content;
    res.setHeader('Content-Length', content.length);
    res.end(content);
    return true;
  }
}

/*
finds the variables that are in scope at the given line/col using the
provided jshintData object, which you can obtain like this:

  jshint(src);
  var jshintData = jshint.data();

*/
function findVariablesInScope(jshintData, line, col) {
  var fInfo = jshintData.functions;

  // comparator for positions in the form { line: XXX, character: YYY }
  var compare = function (pos1, pos2) {
    var c = pos1.line - pos2.line;
    if (c == 0) {
      c = pos1.character - pos2.character;
    }
    return c;
  };

  // finds all functions in fInfo surrounding line/col
  var findContainingFunctions = function () {
    var functions = [];
    for (var i in fInfo) {
      var startsBefore = compare({ line: fInfo[i].line, character: fInfo[i].last },
                     { line: line, character: col }) <= 0;
      var endsAfter    = compare({ line: fInfo[i].last, character: fInfo[i].lastcharacter },
                     { line: line, character: col }) >= 0;
      if (startsBefore && endsAfter) {
        functions.push(fInfo[i]);
      }
    }
    return functions;
  };

  // returns all variables that are in scope (except globals) from the given list of functions
  var collectVars = function (functions) {
    // add vars as keys in an object (de-dup)
    var varsO = {};
    for (var i in functions) {
      var newVars = [].concat(functions[i]['closure'] || [],
                  functions[i]['outer'] || [],
                  functions[i]['var'] || [],
                  functions[i]['unused'] || []);
      for (var v in newVars) {
        varsO[newVars[v]] = true;
      }
    }

    // pull them out into a sorted array
    var vars = [];
    for (var i in varsO) {
      vars.push(i);
    }
    return vars.sort();
  };

  return collectVars(findContainingFunctions());
}

var app = connect()
  .use(connect.logger('dev'))
  .use(connect.staticTom('/', { filter: filter }))
  .listen(3000, '127.0.0.1');
