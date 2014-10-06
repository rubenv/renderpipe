module.exports = function (grunt) {
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-jscs-checker");
    grunt.loadNpmTasks("grunt-bump");

    grunt.initConfig({
        jshint: {
            all: ["*.js"],
            options: {
                jshintrc: ".jshintrc"
            }
        },

        jscs: {
            src: {
                options: {
                    config: ".jscs.json"
                },
                files: {
                    src: ["*.js"]
                }
            }
        },

        watch: {
            test: {
                files: ["*.js"],
                tasks: ["test"]
            }
        },

        bump: {
            options: {
                files: ["package.json"],
                commitFiles: ["-a"],
                pushTo: "origin"
            }
        }
    });

    grunt.registerTask("default", ["test"]);
    grunt.registerTask("build", ["jshint", "jscs"]);
    grunt.registerTask("test", ["build"]);
};
