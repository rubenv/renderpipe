var async = require("async");
var express = require("express");
var fs = require("fs");
var jade = require("jade");
var mkdirp = require("mkdirp");
var path = require("path");
var walk = require("walk");

// Not found
function NotFoundError(file) {
    this.name = "NotFoundError";
    this.message = file + " not found";
    this.stack = (new Error(this.message)).stack;
}
NotFoundError.prototype = new Error;

// Not an output file
function NoExtendsError(file) {
    this.name = "NoExtendsError";
    this.message = file + " does not use a template";
    this.stack = (new Error(this.message)).stack;
}
NoExtendsError.prototype = new Error;

function RenderPipe(dir) {
    this.dir = dir || __dirname;
    this.renderRequest = this.renderRequest.bind(this);
}

RenderPipe.prototype.listen = function (port) {
    if (this.app) {
        return;
    }

    this.app = express();
    this.app.get(/.*/, this.renderRequest);
    this.app.listen(port || 3000);
};

RenderPipe.prototype.renderRequest = function (req, res, next) {
    var file = path.join(this.dir, req.path).replace(/\.html$/, ".jade");

    this.renderFile(file, function (err, html) {
        if (err) {
            if (err instanceof NotFoundError) {
                return next();
            } else {
                return next(err);
            }
        }

        res.send(html);
    });
};

RenderPipe.prototype.renderFile = function (file, cb) {
    fs.exists(file, function (exists) {
        if (!exists) {
            return cb(new NotFoundError(file));
        }

        if (!file.match(/\.jade/)) {
            return cb(new Error(file + " does not look like a Jade file"));
        }

        fs.readFile(file, "utf8", function (err, src) {
            if (err) {
                return cb(err);
            }

            if (!src.match(/^extends/)) {
                return cb(new NoExtendsError(file));
            }

            try {
                var render = jade.compileFile(file, {});
                cb(null, render({}));
            } catch (e) {
                cb(e);
            }
        });
    });
};

RenderPipe.prototype.renderStatic = function (out, cb) {
    var self = this;

    var walker = walk.walk(this.dir);    
    walker.on("file", function (root, stats, next) {
        if (!stats.name.match(/\.jade$/)) {
            return next();
        }

        var srcPath = path.join(root, stats.name);
        var outDir = path.join(out, root.replace(self.dir, ""));
        var outName = stats.name.replace(/\.jade$/, ".html");

        mkdirp(outDir, function (err) {
            if (err) {
                return next(err);
            }

            self.renderFile(srcPath, function (err, html) {
                if (err instanceof NoExtendsError) {
                    return next(); // Skip it
                }

                fs.writeFile(path.join(outDir, outName), html, next);
            });
        });
    });
    walker.on("end", cb);
};

module.exports = RenderPipe;
