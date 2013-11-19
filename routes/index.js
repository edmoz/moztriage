#!/usr/bin/env node

var fs = require("fs");
var http = require("https");
var path = require("path");
var format = require("util").format;

var mkdirp = require("mkdirp");
var moment = require("moment");
var Promise = require("promise");
var shell = require("shelljs");

var DATA_DIR = "data";


exports.index = function (req, res) {
  var repos = shell.find(DATA_DIR).filter(function (file) {
    return file.match(/\.json$/i);
  }).map(function (file) {
    var str = "^" + DATA_DIR + "\/(.*?)\/(.*?)\.json$",
      re = new RegExp(str),
      data = re.exec(file),
      org = data[1],
      repo = data[2];
    return {
      "org": org,
      "repo": repo,
      "str": org + "/" + repo
    };
  });
  res.render("index", {"repos": repos});
};

exports.triage = function (req, res) {
  var org = req.param("org"),
    repo = req.param("repo"),
    fname = path.join(DATA_DIR, org, repo + ".json");
  if (fs.existsSync(fname)) {
    fs.readFile(fname, "utf8", function (err, data) {
      data = JSON.parse(data);
      data.lastSync = moment(data.now).fromNow();
      res.render("triage", {"title": repo, "data": data});
    });
  } else {
    res.render("unknownrepo", {"title": "Unknown repo", "org": org, "repo": repo, "str": org + "/" + repo});
  }
};

exports.cache = function (req, res) {
  var org = req.param("org"),
    repo = req.param("repo");
  loadAndCache(org, repo).done(function (data) {
    var uri = format("/triage/%s/%s", org, repo);
    console.log("caching %s/%s", org, repo);
    res.redirect(uri);
  }, function (err) {
    res.send(500, err.message);
  });
};

// curl -i "https://api.github.com/repos/mozilla/fxa-auth-server/issues" -k


function loadAndCache(org, repo) {
  var fname = path.join(DATA_DIR, org, repo + ".json"),
    uri = format("https://api.github.com/repos/%s/%s/issues", org, repo);
  return getIssues(uri).then(function (issues) {
    if (!Array.isArray(issues)) {
      throw new Error("No issues found");
    }
    return issues.filter(function (issue) {
      return ((issue.state === "open") && !issue.milestone);
    });
  }).then(function (issues) {
    issues = issues.map(function (issue) {
      var type = issue.html_url.match(/^https?:\/\/.*\/(.*?)\/\d+$/i);
      return {
        "html_url": issue.html_url,
        "type": type[1],
        "number": issue.number,
        "user": {
          "name": issue.user.login
        },
        "title": issue.title.trim(),
        "fromNow": moment(issue.created_at).fromNow(),
        "assignee": {
          "avatar_url": (issue.assignee) ? issue.assignee.avatar_url : undefined,
          "login": (issue.assignee) ? issue.assignee.login : undefined
        }
      };
    });
    var data = {
      "org": org,
      "repo": repo,
      "uri": uri.replace("https://api.github.com/repos/", "https://github.com/"),
      "issues": issues,
      "now": Date.now()
    };
    mkdirp.sync(path.dirname(fname));
    fs.writeFileSync(fname, JSON.stringify(data, null, 2) + "\n");
    return data;
  });
}



function getIssues(uri) {
    return new Promise(function (resolve, reject) {
        http.get(uri, function (res) {
          var data = "";
          var remaining = res.headers["x-ratelimit-remaining"],
            limit = res.headers["x-ratelimit-limit"];
          console.log("%d of %d remaining", remaining, limit);
          if (remaining === 0) {
            reject(new Error("Rate limit exceeded"));
          }
          res.on('data', function (chunk) {
            data += chunk.toString();
          });
          res.on('end', function () {
            resolve(JSON.parse(data));
          });
        }).on('error', function (err) {
          reject(err);
        });
    });
}

