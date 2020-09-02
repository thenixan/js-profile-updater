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

    fs.readdir('.', (err, files) => {
        files.forEach(file => {
            console.log(file);
        });
    });

    const YOUTUBE_CHANNEL_ID = core.getInput("youtubeChannelId", {required: true});

    let feed = await rssParser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`)

    let channelName = feed.title;
    let channelLink = feed.link;

    let data = "";
    data += "## YouTube\n\n";
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
    })
})()
