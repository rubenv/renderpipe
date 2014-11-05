var express = require("express");
var fs = require("fs");
var jade = require("jade");
var mkdirp = require("mkdirp");
var path = require("path");
var walk = require("walk");
var url = require("url");

// Not found
function NotFoundError(file) {
    this.name = "NotFoundError";
    this.message = file + " not found";
    this.stack = (new Error(this.message)).stack;
}
NotFoundError.prototype = new Error();

// Not an output file
function NoExtendsError(file) {
    this.name = "NoExtendsError";
    this.message = file + " does not use a template";
    this.stack = (new Error(this.message)).stack;
}
NoExtendsError.prototype = new Error();

function RenderPipe(dir) {
    this.dir = dir || __dirname;
    this.renderRequest = this.renderRequest.bind(this);
    this.renderInclude = this.renderInclude.bind(this);
    this.readAsset = this.readAsset.bind(this);
    this.readJsonAsset = this.readJsonAsset.bind(this);

    this.assets = {};
    this.jsonAssets = {};
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
    var reqpath = url.parse(req.url).pathname;
    var file = path.join(this.dir, reqpath).replace(/\.html$/, ".jade");

    this.renderFile(file, function (err, html) {
        if (err) {
            if (err instanceof NotFoundError) {
                return next();
            } else {
                return next(err);
            }
        }

        res.end(html);
    });
};

RenderPipe.prototype.renderFile = function (file, cb) {
    try {
        var html = this.renderJade(file, true);
        cb(null, html);
    } catch (e) {
        cb(e);
    }
};

RenderPipe.prototype.renderInclude = function (file) {
    return this.renderJade(path.join(this.dir, file), false, {
        pretty: true,
    });
};

RenderPipe.prototype.renderJade = function (file, require_extends, options) {
    var exists = fs.existsSync(file);
    if (!exists) {
        throw new NotFoundError(file);
    }

    if (!file.match(/\.jade/)) {
        throw new Error(file + " does not look like a Jade file");
    }

    var src = fs.readFileSync(file, "utf8");
    if (require_extends && !src.match(/(^|\n)extends/)) {
        throw new NoExtendsError(file);
    }

    var render = jade.compileFile(file, options || {});
    return render({
        render: this.renderInclude,
        read: this.readAsset,
        readJson: this.readJsonAsset,
        filename: path.basename(file),
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
                return cb(err);
            }

            self.renderFile(srcPath, function (err, html) {
                if (err) {
                    if (err instanceof NoExtendsError) {
                        return next(); // Skip it
                    } else {
                        return cb(err);
                    }
                }

                fs.writeFile(path.join(outDir, outName), html, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        next();
                    }
                });
            });
        });
    });
    walker.on("end", cb);
};

RenderPipe.prototype.readAsset = function (filename) {
    if (!this.assets[filename]) {
        this.assets[filename] = fs.readFileSync(path.join(this.dir, filename), "utf8");
    }
    return this.assets[filename];
};

RenderPipe.prototype.readJsonAsset = function (filename) {
    if (!this.jsonAssets[filename]) {
        this.jsonAssets[filename] = JSON.parse(this.readAsset(filename));
    }
    return this.jsonAssets[filename];
};

RenderPipe.prototype.flushCache = function () {
    this.assets = {};
    this.jsonAssets = {};
};

module.exports = RenderPipe;
