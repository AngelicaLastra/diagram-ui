/* Stitches src/ back into the single diagram-studio.html that people open.

     node build.js          write diagram-studio.html
     node build.js --check  fail if diagram-studio.html is out of date

   The shell holds the page around two markers: the stylesheet goes in
   place of the first, and every file in src/js, in name order, in place
   of the second. Nothing else is touched, so the output is exactly the
   pieces laid end to end. */
"use strict";
var fs = require("fs");
var path = require("path");

var SRC = path.join(__dirname, "src");
var OUT = path.join(__dirname, "diagram-studio.html");

function read(file) { return fs.readFileSync(file, "utf8"); }

function swap(text, marker, content) {
  var line = marker + "\n";
  if (text.split(line).length !== 2) throw new Error("expected one " + marker + " line in src/shell.html");
  return text.replace(line, function () { return content; });
}

function build() {
  var js = fs.readdirSync(path.join(SRC, "js"))
    .filter(function (name) { return /\.js$/.test(name); })
    .sort()
    .map(function (name) { return read(path.join(SRC, "js", name)); })
    .join("");
  var page = read(path.join(SRC, "shell.html"));
  page = swap(page, "/* @include styles.css */", read(path.join(SRC, "styles.css")));
  page = swap(page, "/* @include js */", js);
  return page;
}

var page = build();
if (process.argv.indexOf("--check") !== -1) {
  var current = fs.existsSync(OUT) ? read(OUT) : "";
  if (current !== page) {
    console.error("diagram-studio.html is out of date. Run: node build.js");
    process.exit(1);
  }
  console.log("diagram-studio.html is up to date.");
} else {
  fs.writeFileSync(OUT, page);
  console.log("Wrote diagram-studio.html (" + Math.round(page.length / 1024) + " KB)");
}
