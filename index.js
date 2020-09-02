const core = require("@actions/core");
const RssParser = require("rss-parser");
const { Octokit } = require('@octokit/core');
const fs = require('fs');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const rssParser = new RssParser();

String.prototype.isEmpty = function () {
    return (this.length === 0 || !this.trim());
};

let doAsync = (func, ...params) => {
    return new Promise((resolve, reject) => {
        params.push((error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
        func(...params);
    });
}

(async () => {

    const YOUTUBE_CHANNEL_ID = core.getInput("youtubeChannelId", {required: true});

    let feed = await rssParser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`)

    let channelName = feed.title;
    let channelLink = feed.link;

    let template = await doAsync(fs.readFile, "TEMPLATE.md", "UTF-8").catch(console.error);

    let data = "";
    data += `[![](https://img.shields.io/badge/youtube-${encodeURIComponent(channelName).replace("-","--")}-red?style=plastic&logo=youtube)](${channelLink})\n`

    let items = feed.items;
    items.length = Math.min(10, items.length);

    if (items) {
        data += "\n\n";
        data += "#### Latest uploads:\n\n"
        for (let item in items) {
            if (items.hasOwnProperty(item)) {
                data += `- [${items[item].title}](${items[item].link})\n\n`;
            }
        }
    }

    if (template) {
        console.log("Template found, replacing");
        data = template.replace("<!-- YT_RECENTS -->", data);
    }

    const username = process.env.GITHUB_REPOSITORY.split("/")[0]
    const repo = process.env.GITHUB_REPOSITORY.split("/")[1]
    const getReadme = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: username,
        repo: repo,
        path: "README.md",
    }).catch(e => {
        console.error("Failed: ", e)
        core.setFailed("Failed: " + e.message)
    })
    const sha = getReadme.data.sha

    let oldContent = await doAsync(fs.readFile, "README.md", "UTF-8").catch(console.error);

    if (!oldContent || oldContent !== data) {
        console.log("Content didn't match, updating");
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner: username,
            repo: repo,
            path: "README.md",
            message: '(Automated) Update README.md',
            content: Buffer.from(data, "utf8").toString('base64'),
            sha: sha,
        }).catch((e) => {
            console.error("Failed: ", e)
            core.setFailed("Failed: " + e.message)
        });
    } else {
        console.log("Content matched, no update required");
    }
})()
